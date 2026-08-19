"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { comoBloques, type Bloque, type FichaEstado } from "@/lib/tipos";
import { aplicarEnBloques } from "@/lib/aplicar-sugerencia";

/**
 * Guarda una revisión nueva. NUNCA actualiza la anterior: ficha_revision es
 * append-only y la base lo impone con un trigger (§5 invariante 1). El número
 * `n` lo asigna la base, no el cliente.
 */
export async function guardarRevision(
  fichaId: string,
  bloques: Bloque[],
  comentario: string,
): Promise<{ error?: string; n?: number }> {
  const texto = comentario.trim();
  if (!texto) {
    return { error: "Escribí un comentario: es lo que explica el cambio en el historial." };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Sesión vencida. Volvé a entrar." };

  const { data, error } = await supabase
    .from("ficha_revision")
    .insert({ ficha_id: fichaId, bloques, autor_id: user.id, comentario: texto })
    .select("n")
    .single();

  if (error) return { error: `No pudimos guardar la revisión: ${error.message}` };

  revalidatePath(`/fichas/${fichaId}`);
  return { n: data.n as number };
}

/**
 * Transiciones válidas. Cualquier estado se puede anular, y una anulada vuelve
 * a borrador: anular es reversible, borrar no lo sería.
 */
const TRANSICIONES: Record<FichaEstado, FichaEstado[]> = {
  borrador: ["en_revision", "anulada"],
  en_revision: ["aprobada", "borrador", "anulada"],
  aprobada: ["publicada", "en_revision", "anulada"],
  publicada: ["en_revision", "anulada"],
  anulada: ["borrador"],
};

export async function cambiarEstado(
  fichaId: string,
  nuevo: FichaEstado,
): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();

  const { data: ficha } = await supabase
    .from("ficha")
    .select("estado")
    .eq("id", fichaId)
    .maybeSingle();

  if (!ficha) return { error: "No encontramos la ficha." };

  const actual = ficha.estado as FichaEstado;
  if (!TRANSICIONES[actual].includes(nuevo)) {
    return { error: `No se puede pasar de «${actual}» a «${nuevo}».` };
  }

  const { error } = await supabase.from("ficha").update({ estado: nuevo }).eq("id", fichaId);
  if (error) return { error: `No pudimos cambiar el estado: ${error.message}` };

  revalidatePath(`/fichas/${fichaId}`);
  return {};
}

export async function estadosPosibles(actual: FichaEstado): Promise<FichaEstado[]> {
  return TRANSICIONES[actual];
}

/**
 * Resuelve una sugerencia de la IA (§6 regla 3): cada decisión se persiste, y
 * aceptar aplica el cambio creando una revisión NUEVA — nunca editando la
 * anterior, que es append-only.
 */
export async function decidirSugerencia(
  fichaId: string,
  sugerenciaId: string,
  decision: "aceptada" | "rechazada",
): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Volvé a entrar." };

  const { data: sugerencia } = await supabase
    .from("sugerencia_ia")
    .select("id, bloque_id, campo, texto_original, texto_propuesto, estado, motivo")
    .eq("id", sugerenciaId)
    .maybeSingle();

  if (!sugerencia) return { error: "No encontramos la sugerencia." };
  if (sugerencia.estado !== "pendiente") {
    return { error: "Esa sugerencia ya fue resuelta." };
  }

  if (decision === "aceptada") {
    const propuesta = sugerencia.texto_propuesto;
    if (propuesta === null) {
      return {
        error:
          "Esta sugerencia no trae un valor para aplicar: reporta un dato que falta. " +
          "Cargalo a mano en el editor y después rechazala.",
      };
    }

    const { data: revision } = await supabase
      .from("ficha_revision")
      .select("bloques")
      .eq("ficha_id", fichaId)
      .order("n", { ascending: false })
      .limit(1)
      .maybeSingle();

    const bloques = comoBloques(revision?.bloques);
    const nuevos = aplicarEnBloques(
      bloques,
      sugerencia.bloque_id,
      sugerencia.campo,
      sugerencia.texto_original ?? "",
      propuesta,
    );

    if (!nuevos) {
      return {
        error:
          "El contenido de ese campo cambió desde que se generó el hallazgo. " +
          "Revisalo a mano para no pisar una corrección más nueva.",
      };
    }

    const { error } = await supabase.from("ficha_revision").insert({
      ficha_id: fichaId,
      bloques: nuevos,
      autor_id: user.id,
      comentario: `Acepta sugerencia de IA: ${sugerencia.motivo}`,
    });

    if (error) return { error: `No pudimos guardar la revisión: ${error.message}` };
  }

  // El trigger de 0002 sella decidido_por y decidido_at (§5 invariante 3).
  const { error } = await supabase
    .from("sugerencia_ia")
    .update({ estado: decision })
    .eq("id", sugerenciaId);

  if (error) return { error: `No pudimos registrar la decisión: ${error.message}` };

  revalidatePath(`/fichas/${fichaId}`);
  return {};
}
