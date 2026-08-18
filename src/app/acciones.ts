"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";

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
