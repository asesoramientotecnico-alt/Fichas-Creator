"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { comoBloques } from "@/lib/tipos";
import { vaciarParaPlantilla, instanciarPlantilla } from "@/lib/plantilla";

export async function crearProducto(_previo: unknown, datos: FormData) {
  const sku = String(datos.get("sku") ?? "").trim();
  const nombreEs = String(datos.get("nombre_es") ?? "").trim();

  if (!sku || !nombreEs) {
    return { error: "El SKU y el nombre en castellano son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("producto").insert({
    sku,
    nombre_es: nombreEs,
    nombre_en: String(datos.get("nombre_en") ?? "").trim() || null,
    categoria: String(datos.get("categoria") ?? "").trim() || null,
    subcategoria: String(datos.get("subcategoria") ?? "").trim() || null,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `Ya existe un producto con el SKU "${sku}".`
          : `No pudimos guardar el producto: ${error.message}`,
    };
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function crearFicha(_previo: unknown, datos: FormData) {
  const productoId = String(datos.get("producto_id") ?? "");
  const version = String(datos.get("version") ?? "1.0").trim() || "1.0";
  const anio = Number(datos.get("anio")) || new Date().getFullYear();

  if (!productoId) {
    return { error: "Elegí un producto." };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sesión vencida. Volvé a entrar." };
  }

  const { data: ficha, error } = await supabase
    .from("ficha")
    .insert({ producto_id: productoId, version, anio })
    .select("id")
    .single();

  if (error || !ficha) {
    return { error: `No pudimos crear la ficha: ${error?.message ?? "error desconocido"}` };
  }

  // Toda ficha nace con su revisión 1: el historial arranca desde el origen,
  // no desde la primera corrección (§1 requisito 2).
  const { error: errorRevision } = await supabase.from("ficha_revision").insert({
    ficha_id: ficha.id,
    bloques: [],
    autor_id: user.id,
    comentario: "Ficha creada",
  });

  if (errorRevision) {
    return { error: `Creamos la ficha pero falló su revisión inicial: ${errorRevision.message}` };
  }

  revalidatePath("/");
  redirect(`/fichas/${ficha.id}`);
}

/**
 * Guarda la estructura de una ficha como plantilla de su familia (§5, M6).
 * Se vacía el contenido: la plantilla es forma, no datos.
 */
export async function guardarComoPlantilla(
  fichaId: string,
  nombreFamilia: string,
): Promise<{ error?: string; familiaId?: string }> {
  const nombre = nombreFamilia.trim();
  if (!nombre) return { error: "Ponele un nombre a la familia." };

  const supabase = await crearClienteServidor();

  const { data: revision } = await supabase
    .from("ficha_revision")
    .select("bloques")
    .eq("ficha_id", fichaId)
    .order("n", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bloques = comoBloques(revision?.bloques);
  if (bloques.length === 0) {
    return { error: "Esta ficha no tiene bloques, así que no hay estructura que guardar." };
  }

  const { data: ficha } = await supabase
    .from("ficha")
    .select("producto_id")
    .eq("id", fichaId)
    .maybeSingle();

  const { data: familia, error } = await supabase
    .from("familia")
    .insert({ nombre, plantilla_bloques: vaciarParaPlantilla(bloques) })
    .select("id")
    .single();

  if (error || !familia) {
    return { error: `No pudimos guardar la plantilla: ${error?.message ?? "error desconocido"}` };
  }

  // El producto queda asociado a la familia que acaba de definir.
  if (ficha?.producto_id) {
    await supabase.from("producto").update({ familia_id: familia.id }).eq("id", ficha.producto_id);
  }

  revalidatePath("/familias");
  return { familiaId: familia.id };
}

/** Crea una ficha nueva a partir de la plantilla de una familia (M6). */
export async function crearFichaDesdePlantilla(
  _previo: unknown,
  datos: FormData,
): Promise<{ error?: string }> {
  const productoId = String(datos.get("producto_id") ?? "");
  const familiaId = String(datos.get("familia_id") ?? "");
  const version = String(datos.get("version") ?? "1.0").trim() || "1.0";
  const anio = Number(datos.get("anio")) || new Date().getFullYear();

  if (!productoId) return { error: "Elegí un producto." };
  if (!familiaId) return { error: "Elegí una familia." };

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Volvé a entrar." };

  const { data: familia } = await supabase
    .from("familia")
    .select("nombre, plantilla_bloques")
    .eq("id", familiaId)
    .maybeSingle();

  if (!familia) return { error: "No encontramos esa familia." };

  const { data: ficha, error } = await supabase
    .from("ficha")
    .insert({ producto_id: productoId, version, anio })
    .select("id")
    .single();

  if (error || !ficha) {
    return { error: `No pudimos crear la ficha: ${error?.message ?? "error desconocido"}` };
  }

  // Los ids se renuevan al instanciar: dos fichas de la misma plantilla no
  // pueden compartirlos, porque el diff y los hallazgos emparejan por id.
  const { error: errorRevision } = await supabase.from("ficha_revision").insert({
    ficha_id: ficha.id,
    bloques: instanciarPlantilla(comoBloques(familia.plantilla_bloques)),
    autor_id: user.id,
    comentario: `Ficha creada desde la plantilla «${familia.nombre}»`,
  });

  if (errorRevision) {
    return { error: `Creamos la ficha pero falló su revisión inicial: ${errorRevision.message}` };
  }

  revalidatePath("/");
  redirect(`/fichas/${ficha.id}/editar`);
}
