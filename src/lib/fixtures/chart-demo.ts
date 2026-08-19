import type { Bloque } from "@/lib/tipos";

/**
 * Fixture SÓLO para probar el bloque `chart`.
 *
 * Va aparte a propósito: el fixture de la tuerca es la ficha de referencia de
 * §6 y §8, y tiene que salir en exactamente dos hojas A4. Agregarle un gráfico
 * la llevaba a tres y rompía el criterio de aceptación de M4.
 */
export const BLOQUES_CHART: Bloque[] = [
  {
    id: "b-torque",
    tipo: "chart",
    ancho: "completo",
    etiqueta: "Par de apriete orientativo",
    etiquetaX: "Diámetro nominal (mm)",
    etiquetaY: "Par (N·m)",
    series: [
      { nombre: "A2-70 (304)", puntos: [{ x: 6, y: 8 }, { x: 8, y: 20 }, { x: 10, y: 39 }, { x: 12, y: 68 }, { x: 16, y: 168 }] },
      { nombre: "A4-80 (316)", puntos: [{ x: 6, y: 11 }, { x: 8, y: 26 }, { x: 10, y: 52 }, { x: 12, y: 91 }, { x: 16, y: 224 }] },
    ],
  }
,
];
