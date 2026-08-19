// Prueba del reparto en hojas: node scripts/probar-paginado.mjs
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "pag-"));
const entrada = join(dir, "prueba.ts");
const raiz = process.cwd();

writeFileSync(entrada, `
import { repartirEnHojas, agruparEnFilas, type Medidas } from "${raiz}/src/lib/paginado";
import type { Bloque } from "${raiz}/src/lib/tipos";

const casos: [string, () => boolean][] = [];
const chk = (n: string, f: () => boolean) => casos.push([n, f]);

const completo = (id: string): Bloque =>
  ({ id, tipo: "tabla", ancho: "completo", etiqueta: id, columnas: [], filas: [] } as Bloque);
const medio = (id: string): Bloque =>
  ({ id, tipo: "chips", ancho: "medio", etiqueta: id, items: [] } as Bloque);
const barra = (id: string): Bloque =>
  ({ id, tipo: "barra-destacada", ancho: "completo", etiqueta: id, valor: "" } as Bloque);
const tercio = (id: string): Bloque =>
  ({ id, tipo: "chips", ancho: "un-tercio", etiqueta: id, items: [] } as Bloque);
const dosTercios = (id: string, filasGrilla?: number): Bloque =>
  ({ id, tipo: "imagen", ancho: "dos-tercios", filasGrilla, etiqueta: id, alt: "" } as Bloque);

// 850px útiles por hoja, iguales en la primera y en las interiores.
const med = (altos: Record<string, number>): Medidas => ({
  altoBloque: altos,
  altoUtilPrimera: 850,
  altoUtilInterior: 850,
  separacionFilas: 20,
  separacionPie: 20,
});

chk("todo lo que entra queda en una hoja", () => {
  const bs = [completo("a"), completo("b")];
  const h = repartirEnHojas(bs, med({ a: 300, b: 300 }));
  return h.length === 1 && h[0].bloques.length === 2;
});

chk("lo que no entra abre una hoja nueva", () => {
  const bs = [completo("a"), completo("b"), completo("c")];
  const h = repartirEnHojas(bs, med({ a: 400, b: 400, c: 400 }));
  return h.length === 2 &&
         h[0].bloques.map(b=>b.id).join() === "a,b" &&
         h[1].bloques.map(b=>b.id).join() === "c";
});

chk("puede pasar de dos hojas", () => {
  const bs = Array.from({length: 9}, (_,i) => completo("b"+i));
  const altos = Object.fromEntries(bs.map(b => [b.id, 400]));
  const h = repartirEnHojas(bs, med(altos));
  return h.length === 5;
});

chk("dos bloques de media hoja comparten fila y cuentan el mas alto", () => {
  const filas = agruparEnFilas([medio("a"), medio("b")], { a: 200, b: 500 });
  return filas.length === 1 && filas[0].alto === 500 && filas[0].bloques.length === 2;
});

chk("un completo entre dos medios corta la fila", () => {
  const filas = agruparEnFilas([medio("a"), completo("b"), medio("c")], { a: 10, b: 10, c: 10 });
  return filas.length === 3 &&
         filas[0].bloques.map(b=>b.id).join() === "a" &&
         filas[1].bloques.map(b=>b.id).join() === "b" &&
         filas[2].bloques.map(b=>b.id).join() === "c";
});

chk("tres medios: dos comparten fila y el tercero abre otra", () => {
  const filas = agruparEnFilas([medio("a"), medio("b"), medio("c")], { a: 10, b: 10, c: 10 });
  return filas.length === 2 && filas[0].bloques.length === 2 && filas[1].bloques.length === 1;
});

chk("la separacion entre filas cuenta en el reparto", () => {
  // 850 disponibles. Dos filas de 420 suman 840, pero con 20 de separacion son 860.
  const bs = [completo("a"), completo("b")];
  const h = repartirEnHojas(bs, med({ a: 420, b: 420 }));
  return h.length === 2;
});

chk("tres tercios comparten una fila", () => {
  const filas = agruparEnFilas([tercio("a"), tercio("b"), tercio("c")], { a: 10, b: 40, c: 20 });
  return filas.length === 1 && filas[0].bloques.length === 3 && filas[0].alto === 40;
});

chk("dos tercios mas un tercio llenan la fila y el siguiente abre otra", () => {
  const filas = agruparEnFilas(
    [dosTercios("a"), tercio("b"), tercio("c")],
    { a: 30, b: 10, c: 10 },
  );
  return filas.length === 2 && filas[0].bloques.length === 2 && filas[1].bloques.length === 1;
});

chk("filasGrilla apila los bloques angostos al costado del alto", () => {
  const filas = agruparEnFilas(
    [dosTercios("croquis", 2), tercio("a"), tercio("b"), completo("z")],
    { croquis: 300, a: 200, b: 250, z: 100 },
    20,
  );
  // El croquis y los dos angostos son UNA fila; su alto es el de la columna
  // apilada (200 + 20 + 250), que supera al del croquis.
  return (
    filas.length === 2 &&
    filas[0].bloques.length === 3 &&
    filas[0].alto === 470 &&
    filas[1].bloques[0].id === "z"
  );
});

chk("filasGrilla no se lleva un bloque que no cabe al costado", () => {
  const filas = agruparEnFilas(
    [dosTercios("croquis", 2), completo("ancho")],
    { croquis: 300, ancho: 100 },
    20,
  );
  return filas.length === 2 && filas[0].bloques.length === 1 && filas[1].bloques.length === 1;
});

chk("la primera hoja puede tener menos lugar que las interiores", () => {
  const medidas: Medidas = {
    altoBloque: { a: 300, b: 300 },
    altoUtilPrimera: 400,
    altoUtilInterior: 850,
    separacionFilas: 20,
    separacionPie: 20,
  };
  const h = repartirEnHojas([completo("a"), completo("b")], medidas);
  return h.length === 2 && h[0].bloques.length === 1 && h[1].bloques.length === 1;
});

chk("la barra destacada se ancla al pie de la ultima hoja", () => {
  const bs = [completo("a"), barra("p")];
  const h = repartirEnHojas(bs, med({ a: 300, p: 80 }));
  return h.length === 1 && h[0].alPie.map(b=>b.id).join() === "p" &&
         h[0].bloques.every(b => b.tipo !== "barra-destacada");
});

chk("si la barra no entra, abre hoja nueva", () => {
  const bs = [completo("a"), barra("p")];
  const h = repartirEnHojas(bs, med({ a: 800, p: 200 }));
  return h.length === 2 && h[1].alPie.map(b=>b.id).join() === "p" && h[1].bloques.length === 0;
});

chk("la barra va en la ultima hoja, no en la primera", () => {
  const bs = [completo("a"), completo("b"), completo("c"), barra("p")];
  const h = repartirEnHojas(bs, med({ a: 400, b: 400, c: 400, p: 60 }));
  const conBarra = h.findIndex(x => x.alPie.length > 0);
  return conBarra === h.length - 1;
});

chk("sin bloques devuelve una hoja vacia, no cero", () => {
  const h = repartirEnHojas([], med({}));
  return h.length === 1 && h[0].bloques.length === 0;
});

chk("un bloque mas alto que la hoja no entra en un bucle infinito", () => {
  const bs = [completo("gigante"), completo("b")];
  const h = repartirEnHojas(bs, med({ gigante: 5000, b: 100 }));
  return h.length === 2 && h[0].bloques.map(b=>b.id).join() === "gigante";
});

chk("respeta el orden de los bloques", () => {
  const bs = [completo("a"), completo("b"), completo("c"), completo("d")];
  const h = repartirEnHojas(bs, med({ a: 400, b: 400, c: 400, d: 400 }));
  return h.flatMap(x => x.bloques.map(b => b.id)).join() === "a,b,c,d";
});

let ok = 0;
for (const [n, f] of casos) {
  let paso = false;
  try { paso = f(); } catch (e) { console.log("  ERROR", n, e); }
  console.log((paso ? "  ✓ " : "  ✗ ") + n);
  if (paso) ok++;
}
console.log(\`\\n\${ok}/\${casos.length} pruebas pasan\`);
if (ok !== casos.length) process.exit(1);
`);

execSync(`npx tsx ${entrada}`, { stdio: "inherit", cwd: raiz });
