import type { AnchoBloque, Bloque } from "@/lib/tipos";
import { PISTAS_GRILLA, PISTAS_POR_ANCHO } from "@/lib/tipos";

/**
 * Reparto de bloques en hojas A4.
 *
 * La estética es invariante (§1 requisito 1), así que el corte no puede
 * cambiar tamaños ni espaciados: sólo decide qué bloque va en qué hoja. Si el
 * contenido no entra en dos hojas, se agregan las que hagan falta — decisión
 * de producto: antes se recortaba en silencio, que es peor.
 *
 * El alto de cada bloque lo mide el navegador (ver medir.ts): estimarlo desde
 * el contenido sería adivinar, porque depende del wrapping y de las métricas
 * reales de la fuente.
 */

export interface Medidas {
  /** Alto de cada bloque en px, por id. */
  altoBloque: Record<string, number>;
  /**
   * Alto libre para bloques en la primera hoja, ya descontados su cabecera,
   * su pie y su padding. La primera hoja lleva el logo grande y más aire
   * arriba, así que tiene menos lugar que las interiores.
   */
  altoUtilPrimera: number;
  /** Ídem para las hojas interiores. */
  altoUtilInterior: number;
  /** Separación entre filas de la grilla. */
  separacionFilas: number;
  /** Separación entre el cuerpo y los bloques anclados al pie. */
  separacionPie: number;
}

/** Ancho por omisión de cada tipo. El mismo que aplican los componentes. */
export function anchoDe(b: Bloque): AnchoBloque {
  if (b.ancho) return b.ancho;
  return b.tipo === "texto-rico" || b.tipo === "chips" || b.tipo === "tabla-kv"
    ? "medio"
    : "completo";
}

export function pistasDe(b: Bloque): number {
  return PISTAS_POR_ANCHO[anchoDe(b)];
}

/**
 * Agrupa los bloques en filas como lo hace la grilla de 12 pistas con
 * colocación automática: se van sumando pistas hasta llenar la fila, y el
 * bloque que no entra abre la siguiente. El alto de la fila es el del bloque
 * más alto.
 *
 * Un bloque más ancho que la grilla igual ocupa su propia fila: la alternativa
 * sería descartarlo, y perder contenido en silencio es peor que desbordar.
 */
export function agruparEnFilas(
  bloques: Bloque[],
  altoBloque: Record<string, number>,
  separacionFilas = 0,
): { bloques: Bloque[]; alto: number }[] {
  const filas: { bloques: Bloque[]; alto: number }[] = [];
  let abierta: { bloques: Bloque[]; alto: number; pistas: number } | null = null;

  const cerrar = () => {
    if (abierta) filas.push({ bloques: abierta.bloques, alto: abierta.alto });
    abierta = null;
  };

  for (let i = 0; i < bloques.length; i += 1) {
    const b = bloques[i];
    const alto = altoBloque[b.id] ?? 0;
    const pistas = pistasDe(b);

    // Fila compuesta: un bloque alto y, a su costado, los bloques que lo
    // siguen apilados en las pistas que sobran. La grilla lo resuelve con
    // grid-row: span N; acá se calcula el alto de la fila entera.
    const apiladas = b.filasGrilla && b.filasGrilla > 1 ? b.filasGrilla : 0;
    if (apiladas) {
      cerrar();
      const sobran = PISTAS_GRILLA - pistas;
      const costado: Bloque[] = [];
      while (costado.length < apiladas && i + 1 < bloques.length) {
        const siguiente = bloques[i + 1];
        if (pistasDe(siguiente) > sobran) break;
        costado.push(siguiente);
        i += 1;
      }
      const altoCostado = costado.reduce(
        (t, c, j) => t + (altoBloque[c.id] ?? 0) + (j > 0 ? separacionFilas : 0),
        0,
      );
      filas.push({ bloques: [b, ...costado], alto: Math.max(alto, altoCostado) });
      continue;
    }

    if (!abierta) {
      abierta = { bloques: [b], alto, pistas };
    } else if (abierta.pistas + pistas <= PISTAS_GRILLA) {
      abierta.bloques.push(b);
      abierta.alto = Math.max(abierta.alto, alto);
      abierta.pistas += pistas;
    } else {
      cerrar();
      abierta = { bloques: [b], alto, pistas };
    }

    if (abierta && abierta.pistas >= PISTAS_GRILLA) cerrar();
  }

  cerrar();
  return filas;
}

/**
 * Título por omisión de una hoja interior.
 *
 * Antes acá decía "Tabla de cotas y dimensiones", que es el título de la
 * segunda hoja de la ficha de la tuerca y estaba hardcodeado en cuatro
 * lugares. No todas las segundas hojas son cotas: el título lo declara el
 * bloque que abre la hoja, con `tituloHoja`, y esto es sólo lo que se usa
 * cuando ninguno lo declaró.
 */
export const TITULO_INTERIOR_POR_OMISION = "Continuación";

/**
 * Título de una hoja interior: el del primer bloque que declare uno, o el
 * título general de la ficha si ninguno lo hace.
 */
export function tituloDeHoja(bloques: Bloque[], porOmision: string): string {
  return bloques.find((b) => b.tituloHoja)?.tituloHoja ?? porOmision;
}

export interface HojaRepartida {
  bloques: Bloque[];
  /** Bloques anclados al pie de la hoja (barra destacada). */
  alPie: Bloque[];
}

export function repartirEnHojas(bloques: Bloque[], m: Medidas): HojaRepartida[] {
  // La barra destacada no fluye: se ancla al pie de la última hoja, como en
  // las dos fichas de producción.
  const cuerpo = bloques.filter((b) => b.tipo !== "barra-destacada");
  const anclados = bloques.filter((b) => b.tipo === "barra-destacada");

  const filas = agruparEnFilas(cuerpo, m.altoBloque, m.separacionFilas);

  const capacidad = (esPrimera: boolean) =>
    esPrimera ? m.altoUtilPrimera : m.altoUtilInterior;

  const hojas: HojaRepartida[] = [];
  let actual: Bloque[] = [];
  let usado = 0;

  const abrir = () => {
    actual = [];
    usado = 0;
  };
  const cerrar = () => {
    hojas.push({ bloques: actual, alPie: [] });
  };

  abrir();

  for (const fila of filas) {
    const disponible = capacidad(hojas.length === 0);
    const costo = fila.alto + (usado > 0 ? m.separacionFilas : 0);

    // Una fila que no entra abre hoja nueva. Si tampoco entra en una hoja
    // vacía, se deja igual: un bloque más alto que la hoja se recortaría, y
    // moverlo a otra hoja no lo arreglaría — es un problema de contenido que
    // hay que ver en el editor, no acá.
    if (usado > 0 && usado + costo > disponible) {
      cerrar();
      abrir();
      usado = fila.alto;
    } else {
      usado += costo;
    }

    actual.push(...fila.bloques);
  }

  cerrar();

  if (anclados.length === 0) return hojas;

  // Los anclados van al pie de la última hoja si entran; si no, a una nueva.
  const altoAnclados =
    anclados.reduce((t, b) => t + (m.altoBloque[b.id] ?? 0), 0) + m.separacionPie;
  const ultima = hojas[hojas.length - 1];
  const disponible = capacidad(hojas.length === 1);

  if (usado + altoAnclados <= disponible) {
    ultima.alPie = anclados;
  } else {
    hojas.push({ bloques: [], alPie: anclados });
  }

  return hojas;
}
