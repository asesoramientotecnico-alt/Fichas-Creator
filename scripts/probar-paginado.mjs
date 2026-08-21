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

// ------------------------------------------------------------
// Flujo de dos columnas independientes
// ------------------------------------------------------------

/** Los ids de cada columna de la primera zona de columnas de una hoja. */
const cols = (hoja: { regiones?: any[] }) => {
  const z = (hoja.regiones ?? []).find((r: any) => r.clase === "columnas");
  return z
    ? { izq: z.izquierda.map((b: any) => b.id).join(), der: z.derecha.map((b: any) => b.id).join() }
    : { izq: "", der: "" };
};

chk("columnas: dos bloques de media hoja van uno a cada columna", () => {
  const h = repartirEnHojas([medio("a"), medio("b")], med({ a: 100, b: 100 }));
  const c = cols(h[0]);
  return h.length === 1 && c.izq === "a" && c.der === "b";
});

chk("columnas: el tercer bloque va debajo del mas corto, no a una fila nueva", () => {
  // 'a' es alto y 'b' bajo: el tercero tiene que caer debajo de 'b'.
  const h = repartirEnHojas([medio("a"), medio("b"), medio("c")], med({ a: 300, b: 80, c: 80 }));
  const c = cols(h[0]);
  return c.izq === "a" && c.der === "b,c";
});

chk("columnas: la altura de la zona es la de la columna mas alta", () => {
  const h = repartirEnHojas([medio("a"), medio("b")], med({ a: 300, b: 80 }));
  const z = h[0].regiones.find((r: any) => r.clase === "columnas") as any;
  return z.alto === 300;
});

chk("columnas: una columna larga no arrastra a la otra a la hoja siguiente", () => {
  // Con filas, 'a' (400) y 'b' (100) costarian 400, y 'c' + 'd' otros 400:
  // 800 de 850, entra. Con columnas, 'b','c','d' se apilan a la derecha
  // (100+20+100+20+100 = 340) y la zona mide 400: entra todo con mucho menos.
  const h = repartirEnHojas(
    [medio("a"), medio("b"), medio("c"), medio("d")],
    med({ a: 400, b: 100, c: 100, d: 100 }),
  );
  const c = cols(h[0]);
  return h.length === 1 && c.izq === "a" && c.der === "b,c,d";
});

chk("columnas: cuando la zona no entra, corta y sigue en la hoja siguiente", () => {
  const bs = [medio("a"), medio("b"), medio("c"), medio("d")];
  const h = repartirEnHojas(bs, med({ a: 500, b: 500, c: 500, d: 500 }));
  // 'a' izquierda y 'b' derecha llenan la primera (zona de 500); 'c' y 'd' la
  // segunda. Las cuatro siguen en orden de lectura.
  return h.length === 2 &&
         h[0].bloques.map(b=>b.id).join() === "a,b" &&
         h[1].bloques.map(b=>b.id).join() === "c,d";
});

chk("columnas: dos bloques altos comparten hoja, no la parten", () => {
  // Cada uno mide 800 de 850: la zona mide 800, no 1600, asi que entran los
  // dos lado a lado. Es justamente lo que las filas tambien lograban.
  const h = repartirEnHojas([medio("a"), medio("b")], med({ a: 800, b: 800 }));
  const c = cols(h[0]);
  return h.length === 1 && c.izq === "a" && c.der === "b";
});

chk("columnas: la hoja nueva arranca con las dos columnas vacias", () => {
  const h = repartirEnHojas(
    [medio("a"), medio("b"), medio("c"), medio("d")],
    med({ a: 500, b: 500, c: 500, d: 100 }),
  );
  // 'a' y 'b' llenan la primera. 'c' no entra apilado, asi que abre la segunda
  // por la izquierda, y 'd' la acompaña por la derecha en vez de caer debajo.
  const c2 = cols(h[1]);
  return h.length === 2 && c2.izq === "c" && c2.der === "d";
});

chk("columnas: un bloque completo corta el flujo", () => {
  const h = repartirEnHojas(
    [medio("a"), medio("b"), completo("c"), medio("d"), medio("e")],
    med({ a: 100, b: 100, c: 100, d: 100, e: 100 }),
  );
  const clases = h[0].regiones.map((r: any) => r.clase).join();
  return clases === "columnas,fila,columnas" &&
         h[0].bloques.map(b=>b.id).join() === "a,b,c,d,e";
});

chk("columnas: un tercio y dos tercios siguen siendo filas", () => {
  const h = repartirEnHojas([dosTercios("a"), tercio("b")], med({ a: 100, b: 100 }));
  return h[0].regiones.every((r: any) => r.clase === "fila");
});

chk("columnas: una fila compuesta declarada a mano se respeta", () => {
  // filasGrilla es una decisión explícita de maqueta: no entra al flujo.
  const h = repartirEnHojas([dosTercios("a", 2), medio("b")], med({ a: 300, b: 100 }));
  return h[0].regiones[0].clase === "fila";
});

chk("columnas: los bloques aplanados conservan el orden de lectura", () => {
  const bs = [medio("a"), medio("b"), medio("c"), medio("d")];
  const h = repartirEnHojas(bs, med({ a: 100, b: 100, c: 100, d: 100 }));
  // Izquierda 'a','c' y derecha 'b','d': aplanado es izquierda y despues
  // derecha, que es como se leen las dos columnas.
  return h[0].bloques.map(b=>b.id).join() === "a,c,b,d";
});

chk("columnas: la barra al pie sigue midiendo contra la ultima hoja", () => {
  const h = repartirEnHojas(
    [medio("a"), medio("b"), barra("z")],
    med({ a: 100, b: 100, z: 50 }),
  );
  return h.length === 1 && h[0].alPie.map(b=>b.id).join() === "z";
});

chk("columnas: si la barra no entra, abre hoja aunque la zona este llena", () => {
  const h = repartirEnHojas(
    [medio("a"), medio("b"), barra("z")],
    med({ a: 840, b: 840, z: 200 }),
  );
  return h.length === 2 && h[1].alPie.map(b=>b.id).join() === "z" && h[1].bloques.length === 0;
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
