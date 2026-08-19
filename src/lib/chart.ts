/**
 * SVG del bloque `chart` (§4, §7): generado server-side desde los datos del
 * bloque, determinístico, sin IA. La misma entrada produce siempre el mismo
 * SVG — no hay fecha, azar ni medición del navegador acá.
 *
 * Paleta: validada con el validador de la guía de visualización, contra
 * superficie blanca de impresión. El orden es fijo y no se cicla: una quinta
 * serie no genera un color nuevo.
 *
 *   rojo   #D62717  (el rojo de marca, protagonista)
 *   verde  #0E8040  (paso oscurecido: el #49B170 del sistema no llegaba a 3:1)
 *   azul   #1F5F9E  (separa verde de ámbar, que adyacentes no se distinguen)
 *   ámbar  #B4741B
 *
 * El grafito de marca NO entra: con croma 0.002 lee como gris y el validador
 * lo rechaza como color categórico. Se usa para ejes y texto, que es su rol.
 */

export const SERIES_MAX = 4;

const COLORES = ["#D62717", "#0E8040", "#1F5F9E", "#B4741B"] as const;

const TINTA = "#474746";
const TINTA_SUAVE = "#8A8A8A";
const GRILLA = "#E6E6E5";

export interface Punto {
  x: number;
  y: number;
}
export interface Serie {
  nombre: string;
  puntos: Punto[];
}
export interface OpcionesChart {
  series: Serie[];
  etiquetaX?: string;
  etiquetaY?: string;
}

/** Paso de grilla "redondo": 1, 2 o 5 por decada. Determinístico. */
function pasoLindo(rango: number, objetivo: number): number {
  if (rango <= 0) return 1;
  const crudo = rango / objetivo;
  const decada = Math.pow(10, Math.floor(Math.log10(crudo)));
  const normal = crudo / decada;
  const paso = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10;
  return paso * decada;
}

function ticks(min: number, max: number, objetivo = 5): number[] {
  const paso = pasoLindo(max - min, objetivo);
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;
  const salida: number[] = [];
  // El bucle va sobre enteros para que el redondeo no acumule error.
  const n = Math.round((hasta - desde) / paso);
  for (let i = 0; i <= n; i++) salida.push(Number((desde + i * paso).toPrecision(12)));
  return salida;
}

function formatear(v: number): string {
  // Un entero se escribe sin decimales: un tick "0,00" en el eje es ruido.
  if (Number.isInteger(v)) return String(v);

  const abs = Math.abs(v);
  const texto = abs >= 10 ? v.toFixed(1) : abs >= 1 ? v.toFixed(1) : v.toFixed(2);
  // Coma decimal: es el separador del castellano técnico, como en las tablas.
  return texto.replace(".", ",");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * El viewBox está en unidades lógicas. A ancho completo de ficha (183 mm ≈
 * 692 px) la escala es ~1,15, así que un trazo de 1,75 aterriza en los 2 px
 * que pide la guía de marcas.
 */
const ANCHO = 600;
const ALTO = 320;
const TRAZO_LINEA = 1.75;
const TRAZO_HAIRLINE = 0.9;
const RADIO_MARCA = 3.6; // ~8 px de diámetro al tamaño final

export function generarChartSvg({ series, etiquetaX, etiquetaY }: OpcionesChart): string {
  const conDatos = series.filter((s) => s.puntos.length > 0).slice(0, SERIES_MAX);

  if (conDatos.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} 60" role="img" aria-label="Gráfico sin datos"><text x="0" y="20" fill="${TINTA_SUAVE}" font-size="13" font-family="Roboto, sans-serif">Sin datos para graficar.</text></svg>`;
  }

  const todos = conDatos.flatMap((s) => s.puntos);
  const xs = todos.map((p) => p.x);
  const ys = todos.map((p) => p.y);

  const ticksX = ticks(Math.min(...xs), Math.max(...xs), 6);
  // El eje Y arranca en 0 cuando los datos son todos positivos: en un dato
  // técnico, recortar la base exagera las diferencias.
  const minY = Math.min(...ys) >= 0 ? 0 : Math.min(...ys);
  const ticksY = ticks(minY, Math.max(...ys), 5);

  const x0 = ticksX[0];
  const x1 = ticksX[ticksX.length - 1];
  const y0 = ticksY[0];
  const y1 = ticksY[ticksY.length - 1];

  // Márgenes: el de abajo y el izquierdo incluyen la banda de etiquetas del
  // eje, para que el contenedor no las recorte.
  const m = {
    top: 14,
    right: 74, // deja lugar a la etiqueta directa del último punto
    bottom: etiquetaX ? 46 : 32,
    left: etiquetaY ? 62 : 46,
  };
  const anchoPlot = ANCHO - m.left - m.right;
  const altoPlot = ALTO - m.top - m.bottom - (conDatos.length > 1 ? 26 : 0);

  const px = (v: number) => m.left + ((v - x0) / (x1 - x0 || 1)) * anchoPlot;
  const py = (v: number) => m.top + altoPlot - ((v - y0) / (y1 - y0 || 1)) * altoPlot;

  const partes: string[] = [];

  // Grilla horizontal: hairline sólida, un tono sobre la superficie. Nunca
  // punteada: el punteado lee como umbral o proyección.
  for (const t of ticksY) {
    partes.push(
      `<line x1="${m.left}" y1="${py(t).toFixed(2)}" x2="${(m.left + anchoPlot).toFixed(2)}" y2="${py(t).toFixed(2)}" stroke="${GRILLA}" stroke-width="${TRAZO_HAIRLINE}"/>`,
    );
    partes.push(
      `<text x="${m.left - 6}" y="${(py(t) + 3.5).toFixed(2)}" text-anchor="end" fill="${TINTA_SUAVE}" font-size="10.5" font-family="Roboto, sans-serif" style="font-variant-numeric:tabular-nums">${formatear(t)}</text>`,
    );
  }

  // Eje X: sólo la línea base y sus etiquetas.
  partes.push(
    `<line x1="${m.left}" y1="${(m.top + altoPlot).toFixed(2)}" x2="${(m.left + anchoPlot).toFixed(2)}" y2="${(m.top + altoPlot).toFixed(2)}" stroke="${TINTA}" stroke-width="${TRAZO_HAIRLINE}"/>`,
  );
  for (const t of ticksX) {
    partes.push(
      `<text x="${px(t).toFixed(2)}" y="${(m.top + altoPlot + 15).toFixed(2)}" text-anchor="middle" fill="${TINTA_SUAVE}" font-size="10.5" font-family="Roboto, sans-serif" style="font-variant-numeric:tabular-nums">${formatear(t)}</text>`,
    );
  }

  if (etiquetaX) {
    partes.push(
      `<text x="${(m.left + anchoPlot / 2).toFixed(2)}" y="${ALTO - (conDatos.length > 1 ? 30 : 4)}" text-anchor="middle" fill="${TINTA}" font-size="11" font-family="Roboto Condensed, Roboto, sans-serif" letter-spacing="1">${esc(etiquetaX.toUpperCase())}</text>`,
    );
  }
  if (etiquetaY) {
    partes.push(
      `<text transform="translate(14 ${(m.top + altoPlot / 2).toFixed(2)}) rotate(-90)" text-anchor="middle" fill="${TINTA}" font-size="11" font-family="Roboto Condensed, Roboto, sans-serif" letter-spacing="1">${esc(etiquetaY.toUpperCase())}</text>`,
    );
  }

  // Series: línea de 2 px y marcas. El color sale del orden fijo, nunca ciclado.
  conDatos.forEach((serie, i) => {
    const color = COLORES[i];
    const ordenados = [...serie.puntos].sort((a, b) => a.x - b.x);
    const d = ordenados
      .map((p, j) => `${j === 0 ? "M" : "L"}${px(p.x).toFixed(2)} ${py(p.y).toFixed(2)}`)
      .join(" ");

    partes.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${TRAZO_LINEA}" stroke-linejoin="round" stroke-linecap="round"/>`,
    );

    for (const p of ordenados) {
      // Anillo del color de la superficie, no borde: separa marcas que se
      // solapan sin agregar una línea de contorno.
      partes.push(
        `<circle cx="${px(p.x).toFixed(2)}" cy="${py(p.y).toFixed(2)}" r="${RADIO_MARCA}" fill="${color}" stroke="#fff" stroke-width="1.6"/>`,
      );
    }

    // Etiqueta directa sólo en el último punto: un número en cada punto es ruido.
    const ultimo = ordenados[ordenados.length - 1];
    partes.push(
      `<text x="${(px(ultimo.x) + 8).toFixed(2)}" y="${(py(ultimo.y) + 3.5).toFixed(2)}" fill="${TINTA}" font-size="10.5" font-family="Roboto, sans-serif" style="font-variant-numeric:tabular-nums">${formatear(ultimo.y)}</text>`,
    );
  });

  // Leyenda: siempre que haya dos o más series, para que la identidad no
  // dependa sólo del color. Una sola serie no la lleva: la nombra el título.
  if (conDatos.length > 1) {
    let cursor = m.left;
    const yLeyenda = ALTO - 8;
    conDatos.forEach((serie, i) => {
      partes.push(
        `<rect x="${cursor.toFixed(2)}" y="${(yLeyenda - 7).toFixed(2)}" width="9" height="9" rx="1" fill="${COLORES[i]}"/>`,
      );
      partes.push(
        `<text x="${(cursor + 14).toFixed(2)}" y="${yLeyenda.toFixed(2)}" fill="${TINTA}" font-size="10.5" font-family="Roboto, sans-serif">${esc(serie.nombre)}</text>`,
      );
      cursor += 14 + serie.nombre.length * 5.4 + 16;
    });
  }

  const descripcion = conDatos.map((s) => s.nombre).join(", ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="Gráfico: ${esc(descripcion)}">${partes.join("")}</svg>`;
}

/** Los datos también van en una tabla: el color nunca es el único canal. */
export function seriesATabla(
  series: Serie[],
  etiquetaX = "x",
): { columnas: string[]; filas: string[][] } {
  const xs = [...new Set(series.flatMap((s) => s.puntos.map((p) => p.x)))].sort((a, b) => a - b);
  return {
    columnas: [etiquetaX, ...series.map((s) => s.nombre)],
    filas: xs.map((x) => [
      formatear(x),
      ...series.map((s) => {
        const p = s.puntos.find((q) => q.x === x);
        return p ? formatear(p.y) : "—";
      }),
    ]),
  };
}
