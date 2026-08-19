/** Pruebas de la plantilla de familia. npm run test:plantilla */
import { vaciarParaPlantilla, instanciarPlantilla } from "../src/lib/plantilla";
import { FICHA_TUERCA } from "../src/lib/fixtures/tuerca-autofrenante";
import { BLOQUES_VALVULA } from "../src/lib/fixtures/valvula-esferica";
import type { Bloque } from "../src/lib/tipos";

const casos: [string, () => boolean][] = [];
const chk = (n: string, f: () => boolean) => casos.push([n, f]);

const BLOQUES = FICHA_TUERCA.hojas.flatMap((h) => h.bloques);
const de = <T extends Bloque>(bs: Bloque[], tipo: T["tipo"]) =>
  bs.find((b) => b.tipo === tipo) as T;

chk("conserva el tipo y el orden de todos los bloques", () => {
  const p = vaciarParaPlantilla(BLOQUES);
  return p.length === BLOQUES.length &&
         p.map((b) => b.tipo).join() === BLOQUES.map((b) => b.tipo).join();
});

chk("regenera los ids: dos fichas de la misma plantilla no los comparten", () => {
  const p = vaciarParaPlantilla(BLOQUES);
  const compartidos = p.filter((b) => BLOQUES.some((o) => o.id === b.id));
  const a = instanciarPlantilla(p), b = instanciarPlantilla(p);
  const cruce = a.filter((x) => b.some((y) => y.id === x.id));
  return compartidos.length === 0 && cruce.length === 0;
});

chk("tabla-kv: conserva las etiquetas de fila y vacía los valores", () => {
  const orig = de<Extract<Bloque, {tipo:"tabla-kv"}>>(BLOQUES, "tabla-kv");
  const p = de<Extract<Bloque, {tipo:"tabla-kv"}>>(vaciarParaPlantilla(BLOQUES), "tabla-kv");
  return p.etiqueta === orig.etiqueta &&
         p.filas.length === orig.filas.length &&
         p.filas.every((f, i) => f.label === orig.filas[i].label && f.value === "");
});

chk("tabla: conserva las columnas y deja una fila vacía", () => {
  const orig = de<Extract<Bloque, {tipo:"tabla"}>>(BLOQUES, "tabla");
  const p = de<Extract<Bloque, {tipo:"tabla"}>>(vaciarParaPlantilla(BLOQUES), "tabla");
  return p.columnas.map(c=>c.titulo).join() === orig.columnas.map(c=>c.titulo).join() &&
         p.filas.length === 1 && p.filas[0].every((c) => c === "");
});

chk("croquis: conserva los simbolos de cota y suelta el asset", () => {
  const orig = de<Extract<Bloque, {tipo:"croquis"}>>(BLOQUES, "croquis");
  const p = de<Extract<Bloque, {tipo:"croquis"}>>(vaciarParaPlantilla(BLOQUES), "croquis");
  return p.cotas.map(c=>c.simbolo).join() === orig.cotas.map(c=>c.simbolo).join() &&
         p.assetId === undefined;
});

chk("tabla-dim: conserva etiquetas, unidades y columnas; vacía las filas", () => {
  const orig = de<Extract<Bloque, {tipo:"tabla-dim"}>>(BLOQUES, "tabla-dim");
  const p = de<Extract<Bloque, {tipo:"tabla-dim"}>>(vaciarParaPlantilla(BLOQUES), "tabla-dim");
  return p.tablas.length === orig.tablas.length &&
         p.tablas.every((t, i) =>
           t.etiqueta === orig.tablas[i].etiqueta &&
           t.unidad === orig.tablas[i].unidad &&
           t.columnas.join() === orig.tablas[i].columnas.join() &&
           t.filas.length === 1 && t.filas[0].every((c) => c === ""));
});

chk("header: conserva familia y subfamilia, vacía el nombre del producto", () => {
  const orig = de<Extract<Bloque, {tipo:"header"}>>(BLOQUES, "header");
  const p = de<Extract<Bloque, {tipo:"header"}>>(vaciarParaPlantilla(BLOQUES), "header");
  return p.familia === orig.familia && p.subfamilia === orig.subfamilia &&
         p.tituloEs === "" && p.subtituloEn === "" && p.fotoAssetId === undefined;
});

chk("par-texto, texto-rico, chips, inline-kv y barra quedan sin contenido", () => {
  const p = vaciarParaPlantilla(BLOQUES);
  const par = de<Extract<Bloque, {tipo:"par-texto"}>>(p, "par-texto");
  const txt = de<Extract<Bloque, {tipo:"texto-rico"}>>(p, "texto-rico");
  const chips = de<Extract<Bloque, {tipo:"chips"}>>(p, "chips");
  const inl = de<Extract<Bloque, {tipo:"inline-kv"}>>(p, "inline-kv");
  const barra = de<Extract<Bloque, {tipo:"barra-destacada"}>>(p, "barra-destacada");
  return par.izquierda.texto === "" && par.derecha.texto === "" &&
         par.izquierda.etiqueta !== "" &&
         txt.parrafos.length === 1 && txt.parrafos[0] === "" && txt.etiqueta !== "" &&
         chips.items.length === 0 && chips.etiqueta !== "" &&
         inl.valor === "" && inl.etiqueta !== "" &&
         barra.valor === "" && barra.etiqueta !== "";
});

chk("no quedan datos de la tuerca en la plantilla", () => {
  const json = JSON.stringify(vaciarParaPlantilla(BLOQUES));
  // Valores concretos que son dato, no estructura.
  return !json.includes("DIN 985") && !json.includes("A2-70") &&
         !json.includes("withworth") && !json.includes("M24") &&
         !json.includes("Pack 1") && !json.includes("Uso general");
});

chk("la estructura sí sobrevive", () => {
  const json = JSON.stringify(vaciarParaPlantilla(BLOQUES));
  return json.includes("Normas aplicables") && json.includes("Propiedades mecánicas") &&
         json.includes("Dimensiones métricas") && json.includes("Métrico · M") &&
         json.includes("diámetro nominal");
});

chk("no muta los bloques originales", () => {
  const antes = JSON.stringify(BLOQUES);
  vaciarParaPlantilla(BLOQUES);
  return JSON.stringify(BLOQUES) === antes;
});

// ------------------------------------------------------------
// Tipos nuevos de la plantilla V26
// ------------------------------------------------------------

chk("V26: conserva el tipo y el orden de los bloques nuevos", () => {
  const p = vaciarParaPlantilla(BLOQUES_VALVULA);
  return p.length === BLOQUES_VALVULA.length &&
         p.map((b) => b.tipo).join() === BLOQUES_VALVULA.map((b) => b.tipo).join();
});

chk("imagen: conserva el rótulo y el marco, suelta el asset", () => {
  const img = de<Extract<Bloque, {tipo:"imagen"}>>(vaciarParaPlantilla(BLOQUES_VALVULA), "imagen");
  return img.assetId === undefined && img.etiqueta === "Presión / temperatura" &&
         img.sufijo === '1/4" – 4"';
});

chk("lista-componentes: el despiece es estructura, la cantidad es dato", () => {
  const lc = de<Extract<Bloque, {tipo:"lista-componentes"}>>(
    vaciarParaPlantilla(BLOQUES_VALVULA), "lista-componentes");
  return lc.items.length === 17 &&
         lc.items[0].componente === "Cuerpo" && lc.items[0].material === "A351-CF8M" &&
         lc.items.every((i) => i.cantidad === "") &&
         lc.columnas.componente === "Componente";
});

chk("tabla-ancha: conserva columnas y nota, vacía las filas", () => {
  const ta = de<Extract<Bloque, {tipo:"tabla-ancha"}>>(
    vaciarParaPlantilla(BLOQUES_VALVULA), "tabla-ancha");
  return ta.columnas.length === 13 && ta.nota.includes("paso de esfera") &&
         ta.filas.length === 1 && ta.filas[0].every((c) => c === "") &&
         ta.filas[0].length === ta.columnas.length;
});

chk("codigos: se vacían los pares y el asset, queda la nota", () => {
  const cd = de<Extract<Bloque, {tipo:"codigos"}>>(
    vaciarParaPlantilla(BLOQUES_VALVULA), "codigos");
  return cd.pares.length === 0 && cd.assetId === undefined &&
         (cd.nota ?? "").includes("Cada kit incluye");
});

chk("V26: no quedan códigos ni medidas de la válvula en la plantilla", () => {
  const json = JSON.stringify(vaciarParaPlantilla(BLOQUES_VALVULA));
  return !json.includes("351636") && !json.includes("350834") &&
         !json.includes("115,2") && !json.includes("Válvula esférica 3 cuerpos");
});

chk("V26: la disposición y el span de filas sobreviven", () => {
  const p = vaciarParaPlantilla(BLOQUES_VALVULA);
  const despiece = p.find((b) => b.filasGrilla === 2);
  const verticales = p.filter((b) => b.tipo === "tabla-kv" && b.orientacion === "vertical");
  return despiece?.ancho === "dos-tercios" && verticales.length === 2 &&
         p.some((b) => b.tituloHoja === "Tabla de cotas y códigos");
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
