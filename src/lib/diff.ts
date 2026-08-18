import type { Bloque, TipoBloque } from "@/lib/tipos";

/**
 * Diff entre dos revisiones, a nivel de bloque y de campo (§5).
 * Es la materialización del requisito 2 de §1: poder reconstruir qué cambió.
 *
 * Los bloques se emparejan por `id`, no por posición: así mover un bloque se
 * reporta como movimiento y no como un borrado más un alta, que perdería el
 * rastro de los cambios de campo que además haya tenido.
 */

export type ClaseCambio = "alta" | "baja" | "modificacion" | "movimiento" | "sin-cambios";

export interface CambioCampo {
  /** Ruta legible dentro del bloque, p. ej. "filas[2].value". */
  campo: string;
  antes: string | null;
  despues: string | null;
}

export interface CambioBloque {
  bloqueId: string;
  tipo: TipoBloque;
  clase: ClaseCambio;
  posicionAntes: number | null;
  posicionDespues: number | null;
  campos: CambioCampo[];
}

export interface ResumenDiff {
  cambios: CambioBloque[];
  altas: number;
  bajas: number;
  modificaciones: number;
  movimientos: number;
  hayCambios: boolean;
}

/** Aplana un bloque a pares ruta → valor, para comparar campo por campo. */
function aplanar(valor: unknown, prefijo = ""): Map<string, string> {
  const salida = new Map<string, string>();

  const recorrer = (v: unknown, ruta: string) => {
    if (v === null || v === undefined) return;

    if (Array.isArray(v)) {
      v.forEach((item, i) => recorrer(item, `${ruta}[${i}]`));
      return;
    }

    if (typeof v === "object") {
      for (const [k, sub] of Object.entries(v as Record<string, unknown>)) {
        // `id` y `tipo` identifican al bloque, no son contenido editable.
        if (ruta === "" && (k === "id" || k === "tipo")) continue;
        recorrer(sub, ruta ? `${ruta}.${k}` : k);
      }
      return;
    }

    salida.set(ruta, String(v));
  };

  recorrer(valor, prefijo);
  return salida;
}

function compararCampos(antes: Bloque, despues: Bloque): CambioCampo[] {
  const a = aplanar(antes);
  const b = aplanar(despues);
  const rutas = new Set([...a.keys(), ...b.keys()]);
  const cambios: CambioCampo[] = [];

  for (const ruta of [...rutas].sort()) {
    const va = a.get(ruta) ?? null;
    const vb = b.get(ruta) ?? null;
    if (va !== vb) cambios.push({ campo: ruta, antes: va, despues: vb });
  }

  return cambios;
}

export function compararRevisiones(antes: Bloque[], despues: Bloque[]): ResumenDiff {
  const indiceAntes = new Map(antes.map((b, i) => [b.id, { bloque: b, pos: i }]));
  const indiceDespues = new Map(despues.map((b, i) => [b.id, { bloque: b, pos: i }]));

  const cambios: CambioBloque[] = [];

  // Bajas: estaban y ya no están.
  for (const [id, { bloque, pos }] of indiceAntes) {
    if (indiceDespues.has(id)) continue;
    cambios.push({
      bloqueId: id,
      tipo: bloque.tipo,
      clase: "baja",
      posicionAntes: pos,
      posicionDespues: null,
      campos: [],
    });
  }

  // Altas, modificaciones y movimientos, en el orden de la revisión nueva.
  for (const [id, { bloque, pos }] of indiceDespues) {
    const previo = indiceAntes.get(id);

    if (!previo) {
      cambios.push({
        bloqueId: id,
        tipo: bloque.tipo,
        clase: "alta",
        posicionAntes: null,
        posicionDespues: pos,
        campos: [],
      });
      continue;
    }

    const campos = compararCampos(previo.bloque, bloque);
    const seMovio = previo.pos !== pos;

    // Un bloque que además de moverse cambió de contenido se reporta como
    // modificación: el movimiento queda visible en las posiciones.
    const clase: ClaseCambio =
      campos.length > 0 ? "modificacion" : seMovio ? "movimiento" : "sin-cambios";

    if (clase === "sin-cambios") continue;

    cambios.push({
      bloqueId: id,
      tipo: bloque.tipo,
      clase,
      posicionAntes: previo.pos,
      posicionDespues: pos,
      campos,
    });
  }

  const contar = (c: ClaseCambio) => cambios.filter((x) => x.clase === c).length;

  return {
    cambios,
    altas: contar("alta"),
    bajas: contar("baja"),
    modificaciones: contar("modificacion"),
    movimientos: contar("movimiento"),
    hayCambios: cambios.length > 0,
  };
}

export const ETIQUETA_CLASE: Record<ClaseCambio, string> = {
  alta: "Agregado",
  baja: "Eliminado",
  modificacion: "Modificado",
  movimiento: "Movido",
  "sin-cambios": "Sin cambios",
};
