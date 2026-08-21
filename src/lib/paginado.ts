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

/**
 * Un tramo vertical de una hoja.
 *
 * `fila` es lo de siempre: uno o más bloques lado a lado, con la altura del más
 * alto. `columnas` es el tramo donde dos columnas fluyen independientes — cada
 * una apila sus bloques sin esperar a la otra, que es como están armadas las
 * fichas de referencia. Con filas, un bloque corto al lado de uno largo deja un
 * hueco del tamaño de la diferencia; con columnas ese hueco no existe.
 */
export type Region =
  | { clase: "fila"; bloques: Bloque[]; alto: number }
  | { clase: "columnas"; izquierda: Bloque[]; derecha: Bloque[]; alto: number };

/** Los bloques de una región, en orden de lectura. */
export function bloquesDeRegion(r: Region): Bloque[] {
  return r.clase === "fila" ? r.bloques : [...r.izquierda, ...r.derecha];
}

/** Un bloque entra al flujo de dos columnas si ocupa exactamente media hoja. */
function esDeColumna(b: Bloque): boolean {
  // `filasGrilla` es una fila compuesta declarada a mano: se respeta como fila.
  if (b.filasGrilla && b.filasGrilla > 1) return false;
  return pistasDe(b) === PISTAS_GRILLA / 2;
}

export interface HojaRepartida {
  /** Los tramos de la hoja, en orden. Es lo que dibuja la vista. */
  regiones: Region[];
  /** Los mismos bloques, aplanados en orden de lectura. */
  bloques: Bloque[];
  /** Bloques anclados al pie de la hoja (barra destacada). */
  alPie: Bloque[];
}

export function repartirEnHojas(bloques: Bloque[], m: Medidas): HojaRepartida[] {
  // La barra destacada no fluye: se ancla al pie de la última hoja, como en las
  // fichas de referencia.
  const cuerpo = bloques.filter((b) => b.tipo !== "barra-destacada");
  const anclados = bloques.filter((b) => b.tipo === "barra-destacada");

  const capacidad = (indiceHoja: number) =>
    indiceHoja === 0 ? m.altoUtilPrimera : m.altoUtilInterior;
  const alto = (b: Bloque) => m.altoBloque[b.id] ?? 0;

  const hojas: HojaRepartida[] = [];
  /** Regiones ya cerradas de la hoja en curso, y lo que ocupan. */
  let regiones: Region[] = [];
  let usado = 0;
  /**
   * Alto ocupado de la última hoja cerrada. Hace falta para decidir si los
   * bloques anclados al pie entran: `usado` se reinicia al cerrar la hoja.
   */
  let usadoUltima = 0;

  /** Zona de dos columnas abierta. */
  let izq: Bloque[] = [];
  let der: Bloque[] = [];
  let altoIzq = 0;
  let altoDer = 0;
  /** Fila abierta, para los bloques que no son de media hoja. */
  let fila: { bloques: Bloque[]; alto: number; pistas: number } | null = null;

  const hayZona = () => izq.length > 0 || der.length > 0;
  const altoZona = () => Math.max(altoIzq, altoDer);
  const abierto = () => hayZona() || fila !== null;
  /** Separación que hay que pagar antes de una región más. */
  const sep = () => (regiones.length > 0 ? m.separacionFilas : 0);

  const cerrarAbierto = () => {
    if (fila) {
      usado += sep() + fila.alto;
      regiones.push({ clase: "fila", bloques: fila.bloques, alto: fila.alto });
      fila = null;
      return;
    }
    if (!hayZona()) return;
    usado += sep() + altoZona();
    regiones.push({ clase: "columnas", izquierda: izq, derecha: der, alto: altoZona() });
    izq = [];
    der = [];
    altoIzq = 0;
    altoDer = 0;
  };

  const cerrarHoja = () => {
    cerrarAbierto();
    hojas.push({ regiones, bloques: regiones.flatMap(bloquesDeRegion), alPie: [] });
    usadoUltima = usado;
    regiones = [];
    usado = 0;
  };

  /** Si lo abierto midiera `nuevoAlto`, ¿se pasa de la hoja? */
  const noEntra = (nuevoAlto: number) =>
    usado + sep() + nuevoAlto > capacidad(hojas.length) && (regiones.length > 0 || abierto());

  for (let i = 0; i < cuerpo.length; i += 1) {
    const b = cuerpo[i];
    const h = alto(b);
    const pistas = pistasDe(b);

    // --- Fila compuesta declarada a mano: el bloque alto y, al costado, los
    // que lo siguen apilados en las pistas que sobran. Es una decisión de
    // maqueta explícita (§4 `filasGrilla`) y no entra al flujo de columnas.
    const apiladas = b.filasGrilla && b.filasGrilla > 1 ? b.filasGrilla : 0;
    if (apiladas) {
      cerrarAbierto();
      const sobran = PISTAS_GRILLA - pistas;
      const costado: Bloque[] = [];
      while (costado.length < apiladas && i + 1 < cuerpo.length) {
        const siguiente = cuerpo[i + 1];
        if (pistasDe(siguiente) > sobran) break;
        costado.push(siguiente);
        i += 1;
      }
      const altoCostado = costado.reduce(
        (t, c, j) => t + alto(c) + (j > 0 ? m.separacionFilas : 0),
        0,
      );
      const altoFila = Math.max(h, altoCostado);
      if (noEntra(altoFila)) cerrarHoja();
      usado += sep() + altoFila;
      regiones.push({ clase: "fila", bloques: [b, ...costado], alto: altoFila });
      continue;
    }

    // --- Media hoja: entra al flujo de dos columnas.
    if (pistas === PISTAS_GRILLA / 2) {
      if (fila) cerrarAbierto();

      /** Lo que mediría la zona si el bloque va a la columna más corta. */
      const proyectada = () => {
        const aIzquierda = altoIzq <= altoDer;
        const actual = aIzquierda ? altoIzq : altoDer;
        const cantidad = aIzquierda ? izq.length : der.length;
        const columna = actual + h + (cantidad > 0 ? m.separacionFilas : 0);
        return Math.max(columna, aIzquierda ? altoDer : altoIzq);
      };

      // No entra: se cierra la hoja y el bloque abre la zona de la siguiente.
      // Si tampoco entra en una hoja vacía se deja igual: un bloque más alto
      // que la hoja es un problema de contenido, no de reparto.
      if (noEntra(proyectada())) cerrarHoja();

      // La columna se elige DESPUÉS del corte: una hoja nueva arranca con las
      // dos vacías.
      if (altoIzq <= altoDer) {
        altoIzq += h + (izq.length > 0 ? m.separacionFilas : 0);
        izq.push(b);
      } else {
        altoDer += h + (der.length > 0 ? m.separacionFilas : 0);
        der.push(b);
      }
      continue;
    }

    // --- El resto se empaqueta en filas por pistas, como la grilla con
    // colocación automática: un tercio junto a dos tercios comparten fila.
    if (hayZona()) cerrarAbierto();

    if (fila && fila.pistas + pistas <= PISTAS_GRILLA) {
      const altoFila = Math.max(fila.alto, h);
      if (noEntra(altoFila)) {
        // La fila ya abierta se va con la hoja; el bloque abre otra.
        cerrarHoja();
        fila = { bloques: [b], alto: h, pistas };
      } else {
        fila.bloques.push(b);
        fila.alto = altoFila;
        fila.pistas += pistas;
      }
    } else {
      if (fila) cerrarAbierto();
      if (noEntra(h)) cerrarHoja();
      fila = { bloques: [b], alto: h, pistas };
    }

    if (fila && fila.pistas >= PISTAS_GRILLA) cerrarAbierto();
  }

  cerrarHoja();

  if (anclados.length === 0) return hojas;

  // Los anclados van al pie de la última hoja si entran; si no, a una nueva.
  const altoAnclados = anclados.reduce((t, b) => t + alto(b), 0) + m.separacionPie;
  const ultima = hojas[hojas.length - 1];

  if (usadoUltima + altoAnclados <= capacidad(hojas.length - 1)) {
    ultima.alPie = anclados;
  } else {
    hojas.push({ regiones: [], bloques: [], alPie: anclados });
  }

  return hojas;
}
