import type { TipoBloque } from "@/lib/tipos";

/**
 * Protocolo de arrastrar y soltar del editor.
 *
 * Se usa el arrastre nativo del navegador y no eventos de puntero porque los
 * arrastres cruzan paneles —de la paleta al lienzo, de la librería a un
 * bloque— y el `DataTransfer` ya resuelve llevar el dato de un lado al otro.
 *
 * Todo lo que se arrastra viaja con un tipo MIME propio. Un `text/plain` lo
 * aceptaría cualquier campo de texto de la página y soltar un bloque sobre un
 * input escribiría un JSON adentro.
 */

export const MIME = "application/x-ficha";

export type Carga =
  /** Un tipo de bloque nuevo, tomado de la paleta. */
  | { clase: "tipo"; tipo: TipoBloque }
  /** Un bloque que ya está en la ficha y se está moviendo. */
  | { clase: "bloque"; id: string }
  /** Una imagen de la librería de la familia, para asignarla a un bloque. */
  | { clase: "asset"; assetId: string };

export function empezarArrastre(e: React.DragEvent, carga: Carga) {
  e.dataTransfer.setData(MIME, JSON.stringify(carga));
  // `move` para lo que ya está en la ficha y `copy` para lo que se agrega: el
  // cursor del sistema le dice a la persona qué va a pasar antes de soltar.
  e.dataTransfer.effectAllowed = carga.clase === "bloque" ? "move" : "copy";
}

export function cargaDe(e: React.DragEvent): Carga | null {
  const crudo = e.dataTransfer.getData(MIME);
  if (!crudo) return null;
  try {
    const carga = JSON.parse(crudo) as Carga;
    if (carga.clase === "tipo" || carga.clase === "bloque" || carga.clase === "asset") {
      return carga;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Si el arrastre en curso es de los nuestros. Durante `dragover` el contenido
 * no se puede leer —el navegador lo oculta hasta el drop— así que se pregunta
 * por el tipo, que sí está disponible.
 */
export function esNuestro(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(MIME);
}
