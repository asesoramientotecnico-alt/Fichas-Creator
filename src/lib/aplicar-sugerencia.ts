import type { Bloque } from "@/lib/tipos";

/**
 * Aplica una propuesta a un campo de un bloque, con la misma notación de ruta
 * que usan el diff y el revisor (`filas[0].value`, `parrafos[1]`, `valor`).
 *
 * Devuelve null si la ruta no existe o si el valor actual no es el que la
 * sugerencia dice haber visto: en ese caso el contenido cambió desde que se
 * generó el hallazgo, y aplicarlo a ciegas pisaría una corrección más nueva.
 */
export function aplicarEnBloques(
  bloques: Bloque[],
  bloqueId: string,
  campo: string,
  original: string,
  propuesta: string,
): Bloque[] | null {
  const indice = bloques.findIndex((b) => b.id === bloqueId);
  if (indice === -1) return null;

  // structuredClone para no mutar la revisión previa: el diff la compara.
  const copia = structuredClone(bloques);
  const tramos = descomponerRuta(campo);
  if (tramos.length === 0) return null;

  let cursor: unknown = copia[indice];
  for (const tramo of tramos.slice(0, -1)) {
    if (cursor === null || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string, unknown>)[tramo];
  }
  if (cursor === null || typeof cursor !== "object") return null;

  const ultimo = tramos[tramos.length - 1];
  const contenedor = cursor as Record<string, unknown>;
  const actual = contenedor[ultimo];

  if (typeof actual !== "string") return null;
  if (actual !== original) return null;

  contenedor[ultimo] = propuesta;
  return copia;
}

/** "filas[0].value" -> ["filas", "0", "value"] */
function descomponerRuta(campo: string): string[] {
  return campo
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((t) => t.length > 0);
}
