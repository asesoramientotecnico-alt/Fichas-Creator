// Prueba de la aplicación de sugerencias: node scripts/probar-aplicar.mjs
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "apl-"));
const entrada = join(dir, "prueba.ts");
const raiz = process.cwd();

writeFileSync(entrada, `
import { aplicarEnBloques } from "${raiz}/src/lib/aplicar-sugerencia";
import type { Bloque } from "${raiz}/src/lib/tipos";

const casos: [string, () => boolean][] = [];
const chk = (n: string, f: () => boolean) => casos.push([n, f]);

const bloques = (): Bloque[] => [
  { id: "b-normas", tipo: "tabla-kv", etiqueta: "Normas",
    filas: [{ label: "M", value: "DIN 985" }, { label: "″", value: "ANSI B18.16.6" }] } as Bloque,
  { id: "b-desc", tipo: "texto-rico", etiqueta: "Descripción",
    parrafos: ["rosca withworth", "segundo"] } as Bloque,
  { id: "b-mat", tipo: "inline-kv", etiqueta: "Materiales", valor: "A2" } as Bloque,
];

chk("aplica en una fila de tabla-kv", () => {
  const r = aplicarEnBloques(bloques(), "b-normas", "filas[1].value", "ANSI B18.16.6", "ASME B18.16.6");
  return r !== null && (r[0] as any).filas[1].value === "ASME B18.16.6";
});

chk("aplica en un parrafo por indice", () => {
  const r = aplicarEnBloques(bloques(), "b-desc", "parrafos[0]", "rosca withworth", "rosca Whitworth");
  return r !== null && (r[1] as any).parrafos[0] === "rosca Whitworth";
});

chk("aplica en un campo plano", () => {
  const r = aplicarEnBloques(bloques(), "b-mat", "valor", "A2", "A2 — AISI 304");
  return r !== null && (r[2] as any).valor === "A2 — AISI 304";
});

chk("NO pisa si el valor actual cambió", () => {
  // La sugerencia creía ver "ANSI" pero alguien ya lo corrigió a otra cosa.
  return aplicarEnBloques(bloques(), "b-normas", "filas[1].value", "ANSI B18.16.6 viejo", "ASME") === null;
});

chk("no toca los otros bloques ni los otros campos", () => {
  const antes = bloques();
  const r = aplicarEnBloques(antes, "b-desc", "parrafos[0]", "rosca withworth", "corregido")!;
  return (r[1] as any).parrafos[1] === "segundo" &&
         (r[0] as any).filas[1].value === "ANSI B18.16.6" &&
         (r[2] as any).valor === "A2";
});

chk("no muta la revision previa: el diff la compara", () => {
  const antes = bloques();
  aplicarEnBloques(antes, "b-desc", "parrafos[0]", "rosca withworth", "corregido");
  return (antes[1] as any).parrafos[0] === "rosca withworth";
});

chk("bloque inexistente devuelve null", () => {
  return aplicarEnBloques(bloques(), "no-existe", "valor", "A2", "x") === null;
});

chk("ruta inexistente devuelve null", () => {
  return aplicarEnBloques(bloques(), "b-mat", "campo.que.no.existe", "A2", "x") === null;
});

chk("indice fuera de rango devuelve null", () => {
  return aplicarEnBloques(bloques(), "b-desc", "parrafos[9]", "algo", "x") === null;
});

chk("apuntar a un objeto y no a un string devuelve null", () => {
  return aplicarEnBloques(bloques(), "b-normas", "filas[0]", "algo", "x") === null;
});

chk("ruta vacia devuelve null", () => {
  return aplicarEnBloques(bloques(), "b-mat", "", "A2", "x") === null;
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
