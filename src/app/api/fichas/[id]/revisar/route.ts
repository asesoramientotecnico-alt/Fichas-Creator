import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { comoBloques } from "@/lib/tipos";
import { revisarFicha, ErrorRevision } from "@/lib/ia/revisor";

/**
 * "Revisar con IA" (§6). Recibe los bloques de la revisión actual, pide
 * hallazgos y los persiste en sugerencia_ia como pendientes.
 *
 * Nada se aplica automáticamente (§6 regla 3): esta ruta sólo deja los
 * hallazgos anotados para que una persona los acepte o rechace uno por uno.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _peticion: Request,
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

  const { data: revision } = await supabase
    .from("ficha_revision")
    .select("id, n, bloques")
    .eq("ficha_id", id)
    .order("n", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<{ id: string; n: number; bloques: unknown }>();

  if (!revision) {
    return NextResponse.json({ error: "No encontramos la ficha." }, { status: 404 });
  }

  const bloques = comoBloques(revision.bloques);
  if (bloques.length === 0) {
    return NextResponse.json(
      { error: "La ficha no tiene bloques para revisar." },
      { status: 409 },
    );
  }

  try {
    const { hallazgos, descartados, uso } = await revisarFicha(bloques);

    if (descartados.length > 0) {
      // No se le muestran al usuario: son hallazgos que no se pueden apuntar
      // a un campo real. Pero quedan en el log para poder ajustar el prompt.
      console.warn("[revisor] hallazgos descartados", descartados);
    }

    // Las sugerencias previas de esta revisión que siguen pendientes se
    // reemplazan: son de una corrida anterior sobre el mismo contenido y
    // tenerlas duplicadas confundiría el panel. Las ya decididas no se tocan,
    // porque §5 invariante 3 exige conservar el rastro de cada decisión.
    await supabase
      .from("sugerencia_ia")
      .delete()
      .eq("revision_id", revision.id)
      .eq("estado", "pendiente");

    if (hallazgos.length > 0) {
      const { error } = await supabase.from("sugerencia_ia").insert(
        hallazgos.map((h) => ({
          revision_id: revision.id,
          bloque_id: h.bloque_id,
          campo: h.campo,
          texto_original: h.original,
          texto_propuesto: h.propuesta || null,
          motivo: h.motivo,
          severidad: h.severidad,
        })),
      );

      if (error) {
        return NextResponse.json(
          { error: `No pudimos guardar los hallazgos: ${error.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      revision: revision.n,
      hallazgos: hallazgos.length,
      descartados: descartados.length,
      uso,
    });
  } catch (e) {
    if (e instanceof ErrorRevision) {
      // §6 regla 4: el fallo se informa, no se intenta recuperar.
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("[revisor] falló la revisión", e);
    return NextResponse.json(
      { error: "No pudimos completar la revisión. Revisá el log del servidor." },
      { status: 500 },
    );
  }
}
