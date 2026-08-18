"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import type { Bloque, FichaEstado } from "@/lib/tipos";

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

const TRANSICIONES: Record<FichaEstado, FichaEstado[]> = {
  borrador: ["en_revision"],
  en_revision: ["aprobada", "borrador"],
  aprobada: ["publicada", "en_revision"],
  publicada: ["en_revision"],
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
