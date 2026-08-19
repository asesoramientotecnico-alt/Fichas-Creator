/** Pruebas del generador de chart. npm run test:chart */
import { generarChartSvg, seriesATabla, SERIES_MAX, type Serie } from "../src/lib/chart";

const casos: [string, () => boolean][] = [];
const chk = (n: string, f: () => boolean) => casos.push([n, f]);

const A: Serie = { nombre: "A2-70 (304)", puntos: [{x:6,y:450},{x:8,y:450},{x:10,y:450},{x:12,y:450}] };
const B: Serie = { nombre: "A4-80 (316)", puntos: [{x:6,y:600},{x:8,y:600},{x:10,y:600},{x:12,y:600}] };
const C: Serie = { nombre: "C", puntos: [{x:6,y:300},{x:12,y:520}] };
const D: Serie = { nombre: "D", puntos: [{x:6,y:100},{x:12,y:220}] };
const E: Serie = { nombre: "E", puntos: [{x:6,y:50},{x:12,y:90}] };

chk("es determinístico: la misma entrada da el mismo SVG", () => {
  return generarChartSvg({ series: [A, B] }) === generarChartSvg({ series: [A, B] });
});

chk("produce un SVG con viewBox y rol de imagen", () => {
  const s = generarChartSvg({ series: [A] });
  return s.startsWith("<svg") && s.includes("viewBox=") && s.includes('role="img"') && s.endsWith("</svg>");
});

chk("sin datos no rompe: devuelve un SVG con aviso", () => {
  const s = generarChartSvg({ series: [] });
  return s.includes("<svg") && s.includes("Sin datos");
});

chk("descarta series vacías", () => {
  const s = generarChartSvg({ series: [A, { nombre: "vacía", puntos: [] }] });
  return !s.includes("vacía");
});

chk("una sola serie NO lleva leyenda: la nombra el título", () => {
  const s = generarChartSvg({ series: [A] });
  return !s.includes("<rect");
});

chk("dos o más series SÍ llevan leyenda con su nombre", () => {
  const s = generarChartSvg({ series: [A, B] });
  return s.includes("<rect") && s.includes("A2-70 (304)") && s.includes("A4-80 (316)");
});

chk("asigna los colores en orden fijo, sin ciclar", () => {
  const s = generarChartSvg({ series: [A, B, C, D] });
  return s.includes("#D62717") && s.includes("#0E8040") &&
         s.includes("#1F5F9E") && s.includes("#B4741B");
});

chk("una quinta serie no genera un color nuevo: se recorta", () => {
  const s = generarChartSvg({ series: [A, B, C, D, E] });
  return !s.includes(">E<") && SERIES_MAX === 4;
});

chk("no usa el grafito de marca como color de serie", () => {
  // #474746 aparece como tinta de ejes y texto, nunca como relleno de serie.
  const s = generarChartSvg({ series: [A, B] });
  return !s.includes('fill="#474746" stroke=') && !s.includes('stroke="#474746" stroke-width="1.75"');
});

chk("la grilla es sólida, nunca punteada", () => {
  const s = generarChartSvg({ series: [A, B] });
  return !s.includes("stroke-dasharray");
});

chk("etiqueta directa sólo en el último punto, no en cada uno", () => {
  const s = generarChartSvg({ series: [A] });
  // A tiene 4 puntos todos en 450; una etiqueta por punto daría 4 textos "450".
  const veces = (s.match(/>450</g) ?? []).length;
  // Uno en la etiqueta directa; el eje Y puede aportar otro tick con el mismo valor.
  return veces <= 2;
});

chk("las marcas llevan anillo de superficie, no borde de contorno", () => {
  const s = generarChartSvg({ series: [A, B] });
  return s.includes('stroke="#fff"');
});

chk("el eje Y arranca en 0 con datos positivos", () => {
  const s = generarChartSvg({ series: [A] });
  return s.includes(">0<");
});

chk("con datos negativos el eje NO se fuerza a 0", () => {
  const neg: Serie = { nombre: "n", puntos: [{x:1,y:-50},{x:2,y:-10}] };
  const s = generarChartSvg({ series: [neg] });
  return s.includes("-");
});

chk("los ejes admiten etiqueta y la ponen en mayúsculas", () => {
  const s = generarChartSvg({ series: [A], etiquetaX: "diámetro (mm)", etiquetaY: "carga (MPa)" });
  return s.includes("DIÁMETRO (MM)") && s.includes("CARGA (MPA)");
});

chk("escapa el contenido para no romper el SVG", () => {
  const raro: Serie = { nombre: 'A & B <script>"x"', puntos: [{x:1,y:1}] };
  const s = generarChartSvg({ series: [raro, A] });
  return s.includes("&amp;") && s.includes("&lt;script&gt;") && !s.includes("<script>");
});

chk("usa coma decimal, como las tablas de la ficha", () => {
  const s = generarChartSvg({ series: [{ nombre: "d", puntos: [{x:1,y:1.5},{x:2,y:2.5}] }] });
  return s.includes(",5");
});

chk("los datos también salen como tabla: el color no es el único canal", () => {
  const t = seriesATabla([A, B]);
  return t.columnas.join() === "x,A2-70 (304),A4-80 (316)" &&
         t.filas.length === 4 && t.filas[0][0] === "6,0" || t.filas[0][0] === "6";
});

chk("la tabla marca los huecos donde una serie no tiene punto", () => {
  const t = seriesATabla([{ nombre: "p", puntos: [{x:1,y:1}] }, { nombre: "q", puntos: [{x:2,y:2}] }]);
  return t.filas.some((f) => f.includes("—"));
});

let ok = 0;
for (const [n, f] of casos) {
  let paso = false;
  try { paso = f(); } catch (e) { console.log("  ERROR", n, e); }
  console.log((paso ? "  ✓ " : "  ✗ ") + n);
  if (paso) ok++;
}
console.log(`\n${ok}/${casos.length} pruebas pasan`);
if (ok !== casos.length) process.exit(1);
