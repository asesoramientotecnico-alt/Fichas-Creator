import type { Bloque } from "@/lib/tipos";

/**
 * Reordenar e insertar bloques. Son funciones puras y viven acá, y no dentro
 * del editor, para poder probarlas sin navegador: el índice de destino de un
 * arrastre es justo la clase de cálculo donde un error de uno pasa inadvertido
 * y aparece como "el bloque cae en el lugar de al lado".
 */

/** El bloque `id` queda justo antes de `antesDe`, o al final si es null. */
export function moverAntesDe(bloques: Bloque[], id: string, antesDe: string | null): Bloque[] {
  const bloque = bloques.find((b) => b.id === id);
  if (!bloque) return bloques;
  // Soltar un bloque sobre sí mismo no es un movimiento.
  if (id === antesDe) return bloques;

  const sinEl = bloques.filter((b) => b.id !== id);
  if (antesDe === null) return [...sinEl, bloque];

  const destino = sinEl.findIndex((b) => b.id === antesDe);
  if (destino < 0) return bloques;

  const copia = [...sinEl];
  copia.splice(destino, 0, bloque);
  return copia;
}

/**
 * El bloque `id` queda en la posición `destino`, contada sobre la lista
 * ORIGINAL —con el bloque todavía en su lugar—, que es lo que informa una zona
 * de soltar entre dos ítems. Mover el bloque 1 a la posición 3 lo deja en el
 * índice 2, porque al sacarlo los de abajo suben uno.
 */
export function moverA(bloques: Bloque[], id: string, destino: number): Bloque[] {
  const desde = bloques.findIndex((b) => b.id === id);
  if (desde < 0) return bloques;
  if (destino < 0 || destino > bloques.length) return bloques;
  // Las dos zonas que rodean al bloque lo dejan donde está.
  if (destino === desde || destino === desde + 1) return bloques;

  const copia = [...bloques];
  const [bloque] = copia.splice(desde, 1);
  copia.splice(desde < destino ? destino - 1 : destino, 0, bloque);
  return copia;
}

/** Inserta un bloque en la posición dada, acotada a la lista. */
export function insertarEn(bloques: Bloque[], bloque: Bloque, destino: number): Bloque[] {
  const copia = [...bloques];
  copia.splice(Math.max(0, Math.min(destino, copia.length)), 0, bloque);
  return copia;
}

/** Inserta un bloque justo antes de `antesDe`, o al final si es null. */
export function insertarAntesDe(
  bloques: Bloque[],
  bloque: Bloque,
  antesDe: string | null,
): Bloque[] {
  if (antesDe === null) return [...bloques, bloque];
  const destino = bloques.findIndex((b) => b.id === antesDe);
  return insertarEn(bloques, bloque, destino < 0 ? bloques.length : destino);
}

/**
 * El campo donde cada tipo guarda su imagen. La cabecera usa `fotoAssetId`
 * porque su imagen es la foto de producto, no una figura del cuerpo.
 */
export function conAsset(bloques: Bloque[], id: string, assetId: string): Bloque[] {
  return bloques.map((b) => {
    if (b.id !== id) return b;
    if (b.tipo === "header") return { ...b, fotoAssetId: assetId };
    if (b.tipo === "imagen" || b.tipo === "croquis" || b.tipo === "codigos") {
      return { ...b, assetId };
    }
    // Un tipo sin imagen no se toca: soltarle una encima no hace nada.
    return b;
  });
}
