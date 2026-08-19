import type { Bloque } from "@/lib/tipos";

/**
 * Plantilla de familia (§5: `familia.plantilla_bloques`, "estructura sin datos").
 *
 * Qué es estructura y qué es dato, para una familia de producto:
 *
 * - ESTRUCTURA (se conserva): el tipo y el orden de los bloques, su ancho, las
 *   etiquetas de sección, las etiquetas de fila de una tabla-kv, los títulos de
 *   columna, las unidades, y los símbolos de cota del croquis. Todo eso define
 *   la forma de la ficha para esa familia: una tuerca hexagonal siempre lleva
 *   "Normas aplicables" con las mismas seis filas y un croquis con d, s y h.
 *
 * - DATO (se vacía): los valores, las filas de las tablas, los párrafos, los
 *   chips, el título del producto y su nombre en inglés. Eso cambia ficha a
 *   ficha.
 *
 * Los ids se regeneran: si se conservaran, dos fichas creadas de la misma
 * plantilla compartirían ids de bloque, y el diff y los hallazgos de la IA
 * emparejan por id.
 */

let contador = 0;

function nuevoId(tipo: string): string {
  contador += 1;
  return `${tipo}-${Date.now().toString(36)}-${contador}`;
}

export function vaciarParaPlantilla(bloques: Bloque[]): Bloque[] {
  return bloques.map((bloque) => {
    const id = nuevoId(bloque.tipo);

    switch (bloque.tipo) {
      case "header":
        return {
          ...bloque, id,
          // La familia y la subfamilia SÍ son de la familia.
          tituloEs: "",
          subtituloEn: "",
          fotoAssetId: undefined,
        };

      case "tabla-kv":
        // Las etiquetas de fila son la estructura; los valores, el dato.
        return { ...bloque, id, filas: bloque.filas.map((f) => ({ label: f.label, value: "" })) };

      case "par-texto":
        return {
          ...bloque, id,
          izquierda: { etiqueta: bloque.izquierda.etiqueta, texto: "" },
          derecha: { etiqueta: bloque.derecha.etiqueta, texto: "" },
        };

      case "tabla":
        // Se conservan las columnas y una fila vacía para no arrancar de cero.
        return { ...bloque, id, filas: [bloque.columnas.map(() => "")] };

      case "inline-kv":
      case "barra-destacada":
        return { ...bloque, id, valor: "" };

      case "texto-rico":
        return { ...bloque, id, parrafos: [""] };

      case "chips":
        return { ...bloque, id, items: [] };

      case "croquis":
        // Los símbolos de cota son de la familia; el asset se elige por ficha
        // desde la librería.
        return { ...bloque, id, assetId: undefined };

      case "tabla-dim":
        return {
          ...bloque, id,
          tablas: bloque.tablas.map((t) => ({
            etiqueta: t.etiqueta,
            unidad: t.unidad,
            columnas: t.columnas,
            filas: [t.columnas.map(() => "")],
          })),
        };

      case "chart":
        return { ...bloque, id, series: [] };

      case "imagen":
        // El rótulo y el marco son de la familia; la imagen se elige por ficha.
        return { ...bloque, id, assetId: undefined };

      case "lista-componentes":
        // El despiece de una familia es siempre el mismo, así que los ítems y
        // sus materiales son estructura. Sólo se vacía la cantidad, que cambia
        // con la medida (una válvula de 2 1/2" lleva 6 pernos y una de 1/2", 4).
        return {
          ...bloque, id,
          items: bloque.items.map((i) => ({ ...i, cantidad: "" })),
        };

      case "tabla-ancha":
        // Se conservan columnas y nota —definen cómo se lee la tabla— y queda
        // una fila vacía para no arrancar de cero.
        return { ...bloque, id, filas: [bloque.columnas.map(() => "")] };

      case "codigos":
        return { ...bloque, id, pares: [], assetId: undefined };
    }
  });
}

/** Instancia una plantilla para una ficha nueva: sólo renueva los ids. */
export function instanciarPlantilla(plantilla: Bloque[]): Bloque[] {
  return plantilla.map((b) => ({ ...b, id: nuevoId(b.tipo) }));
}
