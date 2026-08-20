/**
 * Prueba del extractor contra un PDF real. Llama al modelo de verdad.
 * Uso: ANTHROPIC_API_KEY=... tsx scripts/extractor-real.ts ruta/al.pdf
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extraerDePdf } from "../src/lib/ia/extractor";
import { imagenesDePdf } from "../src/lib/pdf/imagenes";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Uso: tsx scripts/extractor-real.ts ruta/al.pdf");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY no está definida. Esta prueba llama al modelo de verdad.");
  process.exit(1);
}

/** Carpeta donde volcar las imágenes extraídas, si se pide un segundo argumento. */
const salida = process.argv[3];

async function correr() {
const pdf = new Uint8Array(readFileSync(ruta));

// El inventario, para poder ver qué se le ofreció al modelo.
const inventario = await imagenesDePdf(pdf);
console.log(`\n${inventario.length} imágenes de contenido en el PDF:`);
for (const im of inventario) {
  console.log(
    `  ${im.id}: hoja ${im.hoja}, ${im.posicion}, ${im.anchoPx}×${im.altoPx} px, ` +
      `${im.extension} ${(im.bytes.length / 1024).toFixed(0)} KB`,
  );
  if (salida) writeFileSync(`${salida}/${im.id}.${im.extension}`, im.bytes);
}

const arranque = Date.now();
// Sin subida real: el resolvedor devuelve el propio id del inventario, así se
// ve a qué bloque asignó el modelo cada imagen sin tocar la base.
const r = await extraerDePdf(pdf, undefined, async (asignadas) =>
  new Map(asignadas.map((im) => [im.id, `${im.id}/${im.tipoAsset}`])),
);
const seg = ((Date.now() - arranque) / 1000).toFixed(1);

console.log(`\n${r.bloques.length} bloques en ${seg}s` +
  (r.descartados ? ` (${r.descartados} descartados por venir vacíos)` : ""));
for (const b of r.bloques) {
  const rotulo = "etiqueta" in b ? b.etiqueta : "tituloEs" in b ? b.tituloEs : "";
  const img = "fotoAssetId" in b ? b.fotoAssetId : "assetId" in b ? b.assetId : undefined;
  console.log(
    `  [${b.ancho}] ${b.tipo}${rotulo ? ` · ${rotulo}` : ""}` +
      (img ? `   ← ${img}` : ""),
  );
}
console.log(`\n${r.imagenesUsadas} de ${inventario.length} imágenes quedaron asignadas`);
if (r.omitido.length) {
  console.log("\nno transcripto:");
  for (const o of r.omitido) console.log("  ·", o);
}
if (r.uso) console.log(`\ntokens: ${r.uso.entrada} entrada / ${r.uso.salida} salida`);
console.log("\n--- bloques ---");
console.log(JSON.stringify(r.bloques, null, 1));
}

correr();
