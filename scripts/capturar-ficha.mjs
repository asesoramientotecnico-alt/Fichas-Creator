// Captura cada hoja de /vista-previa y, si están, las compara contra los
// PDF de referencia. Uso: node scripts/capturar-ficha.mjs [directorio]
// Requiere el servidor levantado (npm run start).
import { chromium } from "@playwright/test";

const SALIDA = process.argv[2] ?? "./capturas";
const navegador = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
// 210mm a 96dpi = 794px. Se usa deviceScaleFactor 2 para comparar detalle.
const pagina = await navegador.newPage({
  viewport: { width: 900, height: 1400 },
  deviceScaleFactor: 2,
});
await pagina.goto("http://127.0.0.1:3000/vista-previa", { waitUntil: "networkidle" });
await pagina.evaluate(() => document.fonts.ready);

const hojas = pagina.locator(".hoja");
const total = await hojas.count();
console.log("hojas encontradas:", total);
for (let i = 0; i < total; i++) {
  await hojas.nth(i).screenshot({ path: `${SALIDA}/hoja-${i + 1}.png` });
  const caja = await hojas.nth(i).boundingBox();
  console.log(`  hoja ${i + 1}: ${Math.round(caja.width)}x${Math.round(caja.height)} px`);
}
await navegador.close();
