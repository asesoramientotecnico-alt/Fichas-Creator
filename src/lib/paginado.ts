import type { Bloque } from "@/lib/tipos";

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

export type AnchoBloque = "medio" | "completo";

export interface Medidas {
  /** Alto de cada bloque en px, por id. */
  altoBloque: Record<string, number>;
  /** Alto del chrome de la primera hoja (cabecera con logo + regla). */
  altoCabeceraPrimera: number;
  /** Alto del chrome de las hojas interiores (título + isotipo + regla). */
  altoCabeceraInterior: number;
  /** Alto del pie (nota + numeración). */
  altoPie: number;
  /** Alto útil de la hoja: 297mm menos el padding vertical. */
  altoUtil: number;
  /** Separación entre filas de la grilla. */
  separacionFilas: number;
  /** Separación entre el cuerpo y los bloques anclados al pie. */
  separacionPie: number;
}

function anchoDe(b: Bloque): AnchoBloque {
  if (b.ancho) return b.ancho;
  // Los mismos valores por omisión que usan los componentes.
  return b.tipo === "texto-rico" || b.tipo === "chips" || b.tipo === "tabla-kv"
    ? "medio"
    : "completo";
}

/**
 * Agrupa los bloques en filas como lo hace la grilla de dos columnas con
 * colocación automática: un bloque de ancho completo ocupa su propia fila, y
 * dos de media hoja comparten una. El alto de la fila es el del más alto.
 */
export function agruparEnFilas(
  bloques: Bloque[],
  altoBloque: Record<string, number>,
): { bloques: Bloque[]; alto: number }[] {
  const filas: { bloques: Bloque[]; alto: number }[] = [];
  let abierta: { bloques: Bloque[]; alto: number } | null = null;

  const cerrar = () => {
    if (abierta) filas.push(abierta);
    abierta = null;
  };

  for (const b of bloques) {
    const alto = altoBloque[b.id] ?? 0;

    if (anchoDe(b) === "completo") {
      cerrar();
      filas.push({ bloques: [b], alto });
      continue;
    }

    if (!abierta) {
      abierta = { bloques: [b], alto };
    } else {
      abierta.bloques.push(b);
      abierta.alto = Math.max(abierta.alto, alto);
      cerrar();
    }
  }

  cerrar();
  return filas;
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

  const filas = agruparEnFilas(cuerpo, m.altoBloque);

  const capacidad = (esPrimera: boolean) =>
    m.altoUtil - (esPrimera ? m.altoCabeceraPrimera : m.altoCabeceraInterior) - m.altoPie;

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
