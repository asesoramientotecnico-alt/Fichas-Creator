"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import type { AssetTipo } from "@/lib/tipos";
import { MAPA_UNIDADES_NEGOCIO } from "@/lib/unidades-negocio";

/**
 * Librería de assets por familia (§7): el croquis se sube una vez, se asocia a
 * la familia, y todas las fichas de esa familia lo reusan con su leyenda
 * editable. Prohibido generar croquis con IA en v1.
 */

const BUCKET = "assets-ficha";
const TIPOS_ACEPTADOS = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const TAMANO_MAX = 8 * 1024 * 1024;

export async function subirAsset(
  _previo: unknown,
  datos: FormData,
): Promise<{ error?: string; assetId?: string }> {
  const familiaId = String(datos.get("familia_id") ?? "");
  const tipo = String(datos.get("tipo") ?? "") as AssetTipo;
  const alt = String(datos.get("alt") ?? "").trim();
  const archivo = datos.get("archivo");

  if (!familiaId) return { error: "Elegí la familia a la que pertenece el asset." };
  if (tipo !== "foto" && tipo !== "croquis") return { error: "El tipo debe ser foto o croquis." };
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elegí un archivo." };

  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    return { error: `Formato no aceptado (${archivo.type}). Usá PNG, JPG, SVG o WebP.` };
  }
  if (archivo.size > TAMANO_MAX) {
    return { error: `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB; el máximo es 8 MB.` };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Volvé a entrar." };

  // La ruta lleva la familia adelante para que el bucket quede navegable, y un
  // sufijo para que subir dos veces el mismo nombre no pise el anterior.
  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "bin";
  const limpio = archivo.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .slice(0, 40);
  const ruta = `${familiaId}/${tipo}/${limpio}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (errorSubida) return { error: `No pudimos subir el archivo: ${errorSubida.message}` };

  const { data: asset, error } = await supabase
    .from("asset")
    .insert({ tipo, storage_path: ruta, familia_id: familiaId, alt: alt || null })
    .select("id")
    .single();

  if (error || !asset) {
    // El registro falló: se borra el archivo para no dejar huérfanos.
    await supabase.storage.from(BUCKET).remove([ruta]);
    return { error: `No pudimos registrar el asset: ${error?.message ?? "error desconocido"}` };
  }

  revalidatePath("/familias");
  return { assetId: asset.id };
}

export async function borrarAsset(assetId: string): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();

  const { data: asset } = await supabase
    .from("asset")
    .select("storage_path")
    .eq("id", assetId)
    .maybeSingle();

  if (!asset) return { error: "No encontramos el asset." };

  const { error } = await supabase.from("asset").delete().eq("id", assetId);
  if (error) return { error: `No pudimos borrar el asset: ${error.message}` };

  // El archivo se borra después del registro: si falla, queda un huérfano en
  // el bucket, que es preferible a una ficha apuntando a un archivo que ya no
  // existe.
  await supabase.storage.from(BUCKET).remove([asset.storage_path]);

  revalidatePath("/familias");
  return {};
}

/**
 * URL firmada para mostrar un asset. El bucket es privado: las fichas van a
 * cliente, pero los archivos no se sirven por un link permanente adivinable.
 */
export async function urlDeAsset(storagePath: string, segundos = 3600): Promise<string | null> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, segundos);
  return data?.signedUrl ?? null;
}

export interface AssetDisponible {
  id: string;
  tipo: AssetTipo;
  alt: string | null;
  url: string;
}

/**
 * Assets de la familia de un producto, listos para renderizar: la lista para
 * elegir en el editor y el mapa `assetId → URL firmada` que consumen los
 * bloques con imagen (§7).
 *
 * Los dos assets de demostración quedan como respaldo para que las fichas de
 * prueba, que apuntan a `producto` y `croquis`, sigan mostrando algo.
 */
export async function assetsDeFamilia(
  familiaId: string | null,
): Promise<{ lista: AssetDisponible[]; mapa: Record<string, string> }> {
  const mapa: Record<string, string> = {
    producto: "/ficha/producto.png",
    croquis: "/ficha/croquis.png",
    // Las unidades de negocio son un catálogo fijo, no de la familia: la
    // píldora de cualquier ficha puede elegir cualquiera de ellas.
    ...MAPA_UNIDADES_NEGOCIO,
  };
  if (!familiaId) return { lista: [], mapa };

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("asset")
    .select("id, tipo, alt, storage_path")
    .eq("familia_id", familiaId)
    .order("created_at", { ascending: false })
    .overrideTypes<{ id: string; tipo: AssetTipo; alt: string | null; storage_path: string }[]>();

  const lista: AssetDisponible[] = [];
  for (const a of data ?? []) {
    const url = await urlDeAsset(a.storage_path);
    // Un asset sin URL firmada no se puede mostrar; se omite en vez de dejar
    // un src roto en la ficha.
    if (!url) continue;
    lista.push({ id: a.id, tipo: a.tipo, alt: a.alt, url });
    mapa[a.id] = url;
  }

  return { lista, mapa };
}
