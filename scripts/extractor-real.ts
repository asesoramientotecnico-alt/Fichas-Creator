/**
 * Prueba del extractor contra un PDF real. Llama al modelo de verdad.
 * Uso: ANTHROPIC_API_KEY=... tsx scripts/extractor-real.ts ruta/al.pdf
 */
import { readFileSync } from "node:fs";
import { extraerDePdf } from "../src/lib/ia/extractor";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Uso: tsx scripts/extractor-real.ts ruta/al.pdf");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY no está definida. Esta prueba llama al modelo de verdad.");
  process.exit(1);
}

async function correr() {
const arranque = Date.now();
const r = await extraerDePdf(new Uint8Array(readFileSync(ruta)));
const seg = ((Date.now() - arranque) / 1000).toFixed(1);

console.log(`\n${r.bloques.length} bloques en ${seg}s` +
  (r.descartados ? ` (${r.descartados} descartados por venir vacíos)` : ""));
for (const b of r.bloques) {
  const rotulo = "etiqueta" in b ? b.etiqueta : "tituloEs" in b ? b.tituloEs : "";
  console.log(`  [${b.ancho}] ${b.tipo}${rotulo ? ` · ${rotulo}` : ""}`);
}
if (r.omitido.length) {
  console.log("\nno transcripto:");
  for (const o of r.omitido) console.log("  ·", o);
}
if (r.uso) console.log(`\ntokens: ${r.uso.entrada} entrada / ${r.uso.salida} salida`);
console.log("\n--- bloques ---");
console.log(JSON.stringify(r.bloques, null, 1));
}

correr();
