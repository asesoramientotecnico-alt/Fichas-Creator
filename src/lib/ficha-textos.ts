import type { Bloque } from "@/lib/tipos";

/**
 * Textos fijos de la ficha, y la lectura de su cabecera, aparte de la vista.
 *
 * Están acá y no en FichaVista porque ese módulo importa ficha.css: un script
 * o una prueba que sólo necesita el texto del pie no puede arrastrar CSS.
 */

/** El único bloque header de una ficha (§4: siempre uno, siempre primero). */
export function bloqueHeaderDe(
  bloques: Bloque[],
): Extract<Bloque, { tipo: "header" }> | undefined {
  return bloques.find((b): b is Extract<Bloque, { tipo: "header" }> => b.tipo === "header");
}

/**
 * Familia y píldora de unidad de negocio de la cabecera de la primera hoja.
 * Viven en el bloque header, no en el producto: la unidad de negocio es un
 * catálogo fijo (ver unidades-negocio.ts) que cualquier familia puede elegir,
 * así que no tiene sentido guardarla en `producto.categoria`.
 */
export function datosDeCabecera(
  bloques: Bloque[],
  assets: Record<string, string>,
): { familia: string; pildoraSrc?: string; pildoraAlt?: string } {
  const header = bloqueHeaderDe(bloques);
  return {
    familia: header?.familia ?? "",
    pildoraSrc: header?.pildoraAssetId ? assets[header.pildoraAssetId] : undefined,
    pildoraAlt: header?.pildoraAlt,
  };
}

/** Pie fijo de todas las hojas. Es texto legal de la ficha, no del contenido. */
export const NOTA_AL_PIE =
  "Información orientativa. Reservado el derecho de modificar cualquier material o característica sin previo aviso · famiq.com.ar";

/** "V26 · Rev. 01 · 2026". La revisión es el `n` de la revisión mostrada. */
export function identificacion(version: string, revision: number, anio: number): string {
  return `${version} · Rev. ${String(revision).padStart(2, "0")} · ${anio}`;
}
