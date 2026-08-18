// Prueba del diff sin framework: node scripts/probar-diff.mjs
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "diff-"));
const entrada = join(dir, "prueba.ts");

writeFileSync(entrada, `
import { compararRevisiones } from "${process.cwd()}/src/lib/diff";
import type { Bloque } from "${process.cwd()}/src/lib/tipos";

const casos: [string, () => boolean][] = [];
const chk = (n: string, f: () => boolean) => casos.push([n, f]);

const kv = (id: string, etiqueta: string, filas: {label:string;value:string}[]): Bloque =>
  ({ id, tipo: "tabla-kv", etiqueta, filas } as Bloque);
const chips = (id: string, items: string[]): Bloque =>
  ({ id, tipo: "chips", etiqueta: "Aplicaciones", items } as Bloque);

chk("sin cambios no reporta nada", () => {
  const a = [kv("b1", "Normas", [{label:"M", value:"DIN 985"}])];
  const r = compararRevisiones(a, structuredClone(a));
  return !r.hayCambios && r.cambios.length === 0;
});

chk("detecta alta", () => {
  const r = compararRevisiones([], [chips("b2", ["Uso general"])]);
  return r.altas === 1 && r.cambios[0].clase === "alta" && r.cambios[0].posicionDespues === 0;
});

chk("detecta baja", () => {
  const r = compararRevisiones([chips("b2", ["x"])], []);
  return r.bajas === 1 && r.cambios[0].clase === "baja" && r.cambios[0].posicionAntes === 0;
});

chk("detecta cambio de campo con antes y despues", () => {
  const a = [kv("b1", "Normas", [{label:"Pulgadas", value:"ANSI B18.16.6"}])];
  const b = [kv("b1", "Normas", [{label:"Pulgadas", value:"ASME B18.16.6"}])];
  const r = compararRevisiones(a, b);
  const c = r.cambios[0];
  return r.modificaciones === 1 &&
         c.campos.length === 1 &&
         c.campos[0].campo === "filas[0].value" &&
         c.campos[0].antes === "ANSI B18.16.6" &&
         c.campos[0].despues === "ASME B18.16.6";
});

chk("movimiento sin cambio de contenido es movimiento, no alta+baja", () => {
  const x = kv("b1", "Normas", [{label:"M", value:"DIN 985"}]);
  const y = chips("b2", ["Uso general"]);
  const r = compararRevisiones([x, y], [y, x]);
  return r.altas === 0 && r.bajas === 0 && r.movimientos === 2;
});

chk("mover Y editar se reporta como modificacion con posiciones", () => {
  const x = kv("b1", "Normas", [{label:"M", value:"DIN 985"}]);
  const y = chips("b2", ["Uso general"]);
  const x2 = kv("b1", "Normas aplicables", [{label:"M", value:"DIN 985"}]);
  const r = compararRevisiones([x, y], [y, x2]);
  const c = r.cambios.find(c => c.bloqueId === "b1")!;
  return c.clase === "modificacion" && c.posicionAntes === 0 && c.posicionDespues === 1;
});

chk("agregar un item a una lista se ve como campo nuevo", () => {
  const r = compararRevisiones([chips("b2", ["a"])], [chips("b2", ["a","b"])]);
  const c = r.cambios[0];
  return c.campos.some(f => f.campo === "items[1]" && f.antes === null && f.despues === "b");
});

chk("id y tipo no cuentan como cambios de contenido", () => {
  const a = [kv("b1", "Normas", [])];
  const b = [kv("b1", "Normas", [])];
  return !compararRevisiones(a, b).hayCambios;
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

execSync(`npx tsx ${entrada}`, { stdio: "inherit", cwd: process.cwd() });
