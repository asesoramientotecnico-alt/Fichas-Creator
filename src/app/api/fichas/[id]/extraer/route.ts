import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { extraerDePdf, ErrorExtraccion } from "@/lib/ia/extractor";

/**
 * "Cargar desde PDF": transcribe un PDF de ficha ya maquetado a bloques.
 *
 * NO guarda nada. Devuelve los bloques para que el editor los cargue como
 * borrador, y la persona revise antes de crear la revisión. Así
 * `ficha_revision` sigue teniendo sólo cambios que alguien aprobó (§1
 * requisito 2): la extracción ahorra tipeo, no reemplaza la revisión humana.
 */
export const runtime = "nodejs";
// 60 s es el techo del plan Hobby de Vercel. Medido con Haiku sobre una ficha
// de una hoja: ~32 s. Una ficha de tres hojas puede no entrar; si pasa, la
// salida es partir el PDF o pasar la extracción a un trabajo asincrónico.
export const maxDuration = 60;

export async function POST(
  peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta configurar ANTHROPIC_API_KEY en el servidor." },
      { status: 503 },
    );
  }

  // La ficha tiene que existir: extraer contra un id inventado sería gastar
  // una llamada al modelo para nada.
  const { data: ficha } = await supabase
    .from("ficha")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!ficha) {
    return NextResponse.json({ error: "No encontramos la ficha." }, { status: 404 });
  }

  let archivo: File;
  try {
    const datos = await peticion.formData();
    const valor = datos.get("pdf");
    if (!(valor instanceof File) || valor.size === 0) {
      return NextResponse.json({ error: "Elegí un archivo PDF." }, { status: 400 });
    }
    archivo = valor;
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer el archivo enviado." },
      { status: 400 },
    );
  }

  try {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const { bloques, omitido, descartados, uso } = await extraerDePdf(bytes);

    if (descartados > 0) {
      // No se le muestran: son bloques que el modelo devolvió sin contenido.
      // Quedan en el log para poder ajustar el prompt.
      console.warn(`[extractor] ${descartados} bloques descartados por venir vacíos`);
    }

    return NextResponse.json({ bloques, omitido, uso });
  } catch (e) {
    if (e instanceof ErrorExtraccion) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("[extractor] falló la extracción", e);
    return NextResponse.json(
      { error: "No pudimos leer el PDF. Revisá el log del servidor." },
      { status: 500 },
    );
  }
}
