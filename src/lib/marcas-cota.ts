import type { Bloque, MarcaCota } from "@/lib/tipos";

/**
 * Marcas de cota sobre una imagen: agregar, mover, borrar.
 *
 * Puro y aparte del editor para poder probarlo: el acotado de las coordenadas
 * es lo que impide que una marca termine fuera de la imagen, donde no se vería
 * ni se podría volver a agarrar.
 */

/** Los tipos que admiten marcas encima de su imagen. */
export function admiteMarcas(bloque: Bloque): boolean {
  return bloque.tipo === "croquis" || bloque.tipo === "imagen";
}

/** Entre 0 y 100, con un decimal: más precisión no la distingue nadie. */
export function acotar(valor: number): number {
  if (!Number.isFinite(valor)) return 50;
  return Math.round(Math.min(100, Math.max(0, valor)) * 10) / 10;
}

export function marcasDe(bloque: Bloque): MarcaCota[] {
  return admiteMarcas(bloque) && "marcas" in bloque ? (bloque.marcas ?? []) : [];
}

function conMarcas(bloque: Bloque, marcas: MarcaCota[]): Bloque {
  // El estrechamiento por tipo es lo que le dice a TypeScript que este bloque
  // tiene el campo: `admiteMarcas` devuelve boolean y no lo estrecha.
  if (bloque.tipo !== "croquis" && bloque.tipo !== "imagen") return bloque;
  // Un array vacío se guarda como ausente: el diff de revisiones no tiene que
  // ver un cambio donde no hay ninguno.
  return marcas.length === 0
    ? { ...bloque, marcas: undefined }
    : { ...bloque, marcas };
}

/**
 * Dónde nace la marca número `n` de un bloque.
 *
 * No todas en el centro: dos marcas en el mismo punto se tapan y sólo se puede
 * agarrar la de arriba. Se reparten en una espiral corta alrededor del centro,
 * determinística, para que cada una nazca agarrable y la persona la arrastre
 * al punto que mide.
 */
export function posicionInicial(n: number): { x: number; y: number } {
  const paso = 11;
  const columna = (n % 3) - 1;
  const fila = (Math.floor(n / 3) % 3) - 1;
  return { x: acotar(50 + columna * paso), y: acotar(50 + fila * paso) };
}

/** Agrega una marca. Sin posición, cae cerca del centro y sin taparse con otra. */
export function agregarMarca(bloque: Bloque, simbolo = "", x?: number, y?: number): Bloque {
  if (!admiteMarcas(bloque)) return bloque;
  const previas = marcasDe(bloque);
  const inicial = posicionInicial(previas.length);
  return conMarcas(bloque, [
    ...previas,
    { simbolo, x: acotar(x ?? inicial.x), y: acotar(y ?? inicial.y) },
  ]);
}

export function moverMarca(bloque: Bloque, indice: number, x: number, y: number): Bloque {
  const marcas = marcasDe(bloque);
  if (indice < 0 || indice >= marcas.length) return bloque;
  return conMarcas(
    bloque,
    marcas.map((m, i) => (i === indice ? { ...m, x: acotar(x), y: acotar(y) } : m)),
  );
}

export function cambiarSimbolo(bloque: Bloque, indice: number, simbolo: string): Bloque {
  const marcas = marcasDe(bloque);
  if (indice < 0 || indice >= marcas.length) return bloque;
  return conMarcas(bloque, marcas.map((m, i) => (i === indice ? { ...m, simbolo } : m)));
}

export function borrarMarca(bloque: Bloque, indice: number): Bloque {
  const marcas = marcasDe(bloque);
  if (indice < 0 || indice >= marcas.length) return bloque;
  return conMarcas(bloque, marcas.filter((_, i) => i !== indice));
}

/**
 * El índice que le corresponde a una marca del DOM.
 *
 * En la ficha sólo se dibujan las marcas CON símbolo, así que el índice del
 * elemento no es el del array cuando alguna está vacía. Esto traduce uno al
 * otro; sin la traducción, arrastrar una marca movería otra.
 */
export function indiceReal(marcas: MarcaCota[], indiceVisible: number): number {
  let vistas = -1;
  for (let i = 0; i < marcas.length; i++) {
    if (!marcas[i].simbolo.trim()) continue;
    vistas += 1;
    if (vistas === indiceVisible) return i;
  }
  return -1;
}
