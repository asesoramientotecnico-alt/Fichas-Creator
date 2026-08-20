import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImagenAsignada } from "@/lib/ia/extractor";

/**
 * Sube a la librería de la familia (§7) las imágenes que la transcripción de
 * un PDF asignó a un bloque, y devuelve `id del inventario → assetId`.
 *
 * La deduplicación es el punto importante. §7 dice que un croquis se sube una
 * vez y todas las fichas de la familia lo reusan; sin deduplicar, cada ficha
 * que se cargue desde su PDF metería su propia copia del mismo croquis y la
 * librería quedaría inservible a las diez fichas. La clave es el hash del
 * contenido, y va en el nombre del archivo: si el asset ya existe para esa
 * familia, se reusa su id en vez de crear otro.
 *
 * Se sube con el cliente de la sesión, así que la RLS aplica igual que cuando
 * la persona sube un asset a mano.
 */

const BUCKET = "assets-ficha";

export async function subirImagenesExtraidas(
  supabase: SupabaseClient,
  familiaId: string | null,
  imagenes: ImagenAsignada[],
): Promise<Map<string, string>> {
  const subidas = new Map<string, string>();
  if (imagenes.length === 0) return subidas;

  for (const im of imagenes) {
    // El hash en el nombre hace de clave de deduplicación. Doce caracteres de
    // un sha256 alcanzan de sobra para las imágenes de una familia.
    const corto = im.hash.slice(0, 12);
    const carpeta = familiaId ?? "sin-familia";
    const ruta = `${carpeta}/${im.tipoAsset}/pdf-${corto}.${im.extension}`;

    // ¿Ya está esta misma imagen en la librería? Se compara por ruta, que
    // lleva el hash del contenido.
    const { data: existente } = await supabase
      .from("asset")
      .select("id")
      .eq("storage_path", ruta)
      .maybeSingle();

    if (existente) {
      subidas.set(im.id, existente.id);
      continue;
    }

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, im.bytes, { contentType: im.tipoMime, upsert: true });

    if (errorSubida) {
      // Una imagen que no se pudo subir deja su bloque sin imagen; el resto de
      // la transcripción sigue sirviendo.
      console.error(`[extractor] no se pudo subir ${im.id}: ${errorSubida.message}`);
      continue;
    }

    const { data: asset, error } = await supabase
      .from("asset")
      .insert({
        tipo: im.tipoAsset,
        storage_path: ruta,
        familia_id: familiaId,
        alt: im.alt || null,
      })
      .select("id")
      .single();

    if (error || !asset) {
      // El registro falló: se borra el archivo para no dejar un huérfano en el
      // bucket, igual que en la subida manual.
      await supabase.storage.from(BUCKET).remove([ruta]);
      console.error(
        `[extractor] no se pudo registrar ${im.id}: ${error?.message ?? "error desconocido"}`,
      );
      continue;
    }

    subidas.set(im.id, asset.id);
  }

  return subidas;
}
