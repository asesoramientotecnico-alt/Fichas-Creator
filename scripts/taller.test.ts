/**
 * Pruebas del reordenado de bloques y de los avisos previos a guardar.
 * Uso: tsx scripts/taller.test.ts
 */
import type { Bloque } from "../src/lib/tipos";
import {
  conAsset,
  insertarAntesDe,
  insertarEn,
  moverA,
  moverAntesDe,
} from "../src/lib/orden-bloques";
import { revisarBloques } from "../src/lib/validacion";

const casos: [string, () => boolean][] = [];
const chk = (n: string, f: () => boolean) => casos.push([n, f]);

/** Bloque de texto mínimo, identificado por su id. */
function txt(id: string): Bloque {
  return { id, tipo: "texto-rico", ancho: "completo", etiqueta: id, parrafos: ["x"] };
}

const ids = (bs: Bloque[]) => bs.map((b) => b.id).join(",");
const lista = () => [txt("a"), txt("b"), txt("c"), txt("d")];

// ------------------------------------------------------------
// moverAntesDe: es lo que usa el lienzo al soltar sobre un bloque
// ------------------------------------------------------------

chk("moverAntesDe: hacia atrás", () => ids(moverAntesDe(lista(), "d", "b")) === "a,d,b,c");
chk("moverAntesDe: hacia adelante", () => ids(moverAntesDe(lista(), "a", "d")) === "b,c,a,d");
chk("moverAntesDe: null lo manda al final", () =>
  ids(moverAntesDe(lista(), "a", null)) === "b,c,d,a");
chk("moverAntesDe: sobre sí mismo no hace nada", () =>
  ids(moverAntesDe(lista(), "b", "b")) === "a,b,c,d");
chk("moverAntesDe: al bloque que ya le sigue no cambia el orden", () =>
  ids(moverAntesDe(lista(), "a", "b")) === "a,b,c,d");
chk("moverAntesDe: un id que no existe deja la lista igual", () =>
  ids(moverAntesDe(lista(), "z", "b")) === "a,b,c,d" &&
  ids(moverAntesDe(lista(), "a", "z")) === "a,b,c,d");

// ------------------------------------------------------------
// moverA: es lo que usa la lista de orden, con zonas entre ítems
// ------------------------------------------------------------

chk("moverA: a la primera posición", () => ids(moverA(lista(), "c", 0)) === "c,a,b,d");
chk("moverA: al final", () => ids(moverA(lista(), "a", 4)) === "b,c,d,a");
chk("moverA: hacia adelante descuenta el hueco que deja", () =>
  // Mover 'a' (índice 0) a la posición 3: los de abajo suben uno, así que
  // termina en el índice 2 y no en el 3.
  ids(moverA(lista(), "a", 3)) === "b,c,a,d");
chk("moverA: hacia atrás no descuenta", () => ids(moverA(lista(), "d", 1)) === "a,d,b,c");
chk("moverA: las dos zonas que rodean al bloque lo dejan donde está", () =>
  ids(moverA(lista(), "b", 1)) === "a,b,c,d" && ids(moverA(lista(), "b", 2)) === "a,b,c,d");
chk("moverA: una posición fuera de rango no rompe nada", () =>
  ids(moverA(lista(), "a", 9)) === "a,b,c,d" && ids(moverA(lista(), "a", -1)) === "a,b,c,d");

// ------------------------------------------------------------
// Insertar
// ------------------------------------------------------------

chk("insertarEn: en el medio", () => ids(insertarEn(lista(), txt("n"), 2)) === "a,b,n,c,d");
chk("insertarEn: se acota a la lista", () =>
  ids(insertarEn(lista(), txt("n"), 99)) === "a,b,c,d,n" &&
  ids(insertarEn(lista(), txt("n"), -5)) === "n,a,b,c,d");
chk("insertarAntesDe: antes del bloque indicado", () =>
  ids(insertarAntesDe(lista(), txt("n"), "c")) === "a,b,n,c,d");
chk("insertarAntesDe: null lo pone al final", () =>
  ids(insertarAntesDe(lista(), txt("n"), null)) === "a,b,c,d,n");
chk("insertar no muta la lista original", () => {
  const original = lista();
  insertarEn(original, txt("n"), 1);
  moverA(original, "a", 3);
  return ids(original) === "a,b,c,d";
});

// ------------------------------------------------------------
// conAsset: soltar una imagen sobre un bloque
// ------------------------------------------------------------

chk("conAsset: la cabecera lo recibe en fotoAssetId", () => {
  const bs: Bloque[] = [
    { id: "h", tipo: "header", ancho: "completo", familia: "", subfamilia: "", tituloEs: "X" },
  ];
  const [b] = conAsset(bs, "h", "asset-1");
  return b.tipo === "header" && b.fotoAssetId === "asset-1";
});

chk("conAsset: imagen, croquis y codigos lo reciben en assetId", () => {
  const bs: Bloque[] = [
    { id: "i", tipo: "imagen", ancho: "medio", alt: "" },
    { id: "c", tipo: "croquis", ancho: "completo", cotas: [{ simbolo: "Ød", nombre: "Paso" }] },
    { id: "k", tipo: "codigos", ancho: "medio", etiqueta: "Kit", pares: [] },
  ];
  const r = bs.map((b) => conAsset([b], b.id, "asset-2")[0]);
  return r.every((b) => "assetId" in b && b.assetId === "asset-2");
});

chk("conAsset: un tipo sin imagen no se toca", () => {
  const antes = lista();
  const despues = conAsset(antes, "a", "asset-3");
  return JSON.stringify(antes) === JSON.stringify(despues);
});

// ------------------------------------------------------------
// revisarBloques: las reglas de §4 que nadie verificaba
// ------------------------------------------------------------

chk("una ficha bien armada no genera avisos", () => {
  const bs: Bloque[] = [
    { id: "h", tipo: "header", ancho: "completo", familia: "F", subfamilia: "", tituloEs: "Disco" },
    txt("t"),
  ];
  return revisarBloques(bs).length === 0;
});

chk("dos cabeceras se avisan: §4 dice una por ficha", () => {
  const cab = (id: string): Bloque => ({
    id, tipo: "header", ancho: "completo", familia: "", subfamilia: "", tituloEs: "X",
  });
  const avisos = revisarBloques([cab("h1"), cab("h2")]);
  return avisos.length === 1 && avisos[0].bloqueId === "h2" &&
         avisos[0].mensaje.includes("más de una cabecera");
});

chk("una cabecera que no está primera se avisa", () => {
  const bs: Bloque[] = [
    txt("t"),
    { id: "h", tipo: "header", ancho: "completo", familia: "", subfamilia: "", tituloEs: "X" },
  ];
  return revisarBloques(bs).some((a) => a.mensaje.includes("primer bloque"));
});

chk("tabla-ancha sin nota se avisa: la nota define sus símbolos", () => {
  const bs: Bloque[] = [
    {
      id: "ta", tipo: "tabla-ancha", ancho: "completo", etiqueta: "Cotas",
      columnas: [{ titulo: "Ød" }], filas: [["11"]], nota: "   ",
    },
  ];
  const avisos = revisarBloques(bs);
  return avisos.length === 1 && avisos[0].mensaje.includes("nota");
});

chk("tabla-ancha con nota no se avisa", () => {
  const bs: Bloque[] = [
    {
      id: "ta", tipo: "tabla-ancha", ancho: "completo", etiqueta: "Cotas",
      columnas: [{ titulo: "Ød" }], filas: [["11"]], nota: "Ød paso de esfera",
    },
  ];
  return revisarBloques(bs).length === 0;
});

chk("croquis sin leyenda de cotas se avisa y sugiere el tipo imagen", () => {
  const bs: Bloque[] = [
    { id: "c", tipo: "croquis", ancho: "completo", cotas: [{ simbolo: "", nombre: "" }], assetId: "a1" },
  ];
  const avisos = revisarBloques(bs);
  return avisos.length === 1 && avisos[0].mensaje.includes("tipo imagen");
});

chk("una imagen sin asset se avisa con su rótulo", () => {
  const bs: Bloque[] = [{ id: "i", tipo: "imagen", ancho: "medio", etiqueta: "Presión", alt: "" }];
  const avisos = revisarBloques(bs);
  return avisos.length === 1 && avisos[0].mensaje.includes("Presión");
});

chk("cada aviso apunta al bloque, para poder saltar a él", () => {
  const bs: Bloque[] = [
    { id: "i", tipo: "imagen", ancho: "medio", etiqueta: "Presión", alt: "" },
    { id: "v", tipo: "inline-kv", ancho: "completo", etiqueta: "Material", valor: "" },
  ];
  const avisos = revisarBloques(bs);
  return avisos.length === 2 && avisos.every((a) => bs.some((b) => b.id === a.bloqueId));
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
