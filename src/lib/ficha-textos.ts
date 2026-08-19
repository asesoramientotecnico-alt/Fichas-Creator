/**
 * Textos fijos de la ficha, aparte de la vista.
 *
 * Están acá y no en FichaVista porque ese módulo importa ficha.css: un script
 * o una prueba que sólo necesita el texto del pie no puede arrastrar CSS.
 */

/** Pie fijo de todas las hojas. Es texto legal de la ficha, no del contenido. */
export const NOTA_AL_PIE =
  "Información orientativa. Reservado el derecho de modificar cualquier material o característica sin previo aviso · famiq.com.ar";

/** "V26 · Rev. 01 · 2026". La revisión es el `n` de la revisión mostrada. */
export function identificacion(version: string, revision: number, anio: number): string {
  return `${version} · Rev. ${String(revision).padStart(2, "0")} · ${anio}`;
}
