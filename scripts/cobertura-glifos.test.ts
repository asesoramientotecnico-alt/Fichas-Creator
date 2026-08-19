/**
 * Verifica que todo el texto de las fichas de referencia esté cubierto por los
 * subsets de fuente que van embebidos en el PDF (§3).
 *
 * Por qué importa: si un carácter no está en la fuente, Chromium lo dibuja con
 * una fuente de reserva del sistema. En este contenedor hay DejaVu y sale
 * bien; en el Chromium serverless no hay ninguna garantía, y el símbolo puede
 * salir como caja vacía en una ficha que va a cliente. Es exactamente el
 * riesgo de §9 "las fuentes no resuelven en el PDF", pero a nivel de glifo.
 *
 * La cobertura la lee fontTools, igual que scripts/generar-fuentes-estaticas.mjs.
 *
 * Uso: tsx scripts/cobertura-glifos.test.ts
 */
import { execFileSync } from "node:child_process";
import { BLOQUES_VALVULA, DATOS_VALVULA, HOJAS_VALVULA } from "../src/lib/fixtures/valvula-esferica";
import { FICHA_TUERCA } from "../src/lib/fixtures/tuerca-autofrenante";
import { NOTA_AL_PIE, identificacion } from "../src/lib/ficha-textos";

const PY = `
import glob, json
from fontTools.ttLib import TTFont

puntos = set()
for archivo in glob.glob("public/fonts-estaticas/*.woff2"):
    puntos |= set(TTFont(archivo).getBestCmap())
print(json.dumps(sorted(puntos)))
`;

function cobertura(): Set<number> {
  const salida = execFileSync("python3", ["-c", PY], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return new Set<number>(JSON.parse(salida));
}

/** Todo el texto que una ficha de referencia puede llegar a imprimir. */
function textos(): string[] {
  const salida: string[] = [NOTA_AL_PIE];

  const recorrer = (valor: unknown) => {
    if (typeof valor === "string") salida.push(valor);
    else if (Array.isArray(valor)) valor.forEach(recorrer);
    else if (valor && typeof valor === "object") Object.values(valor).forEach(recorrer);
  };

  recorrer(BLOQUES_VALVULA);
  recorrer(FICHA_TUERCA.hojas.flatMap((h) => h.bloques));
  recorrer(HOJAS_VALVULA);
  salida.push(DATOS_VALVULA.familia, DATOS_VALVULA.pildoraAlt ?? "");
  salida.push(identificacion(DATOS_VALVULA.version, DATOS_VALVULA.revision, DATOS_VALVULA.anio));
  return salida;
}

const puntos = cobertura();
if (puntos.size < 200) {
  console.error(`✗ la cobertura leída es sospechosamente chica (${puntos.size} glifos)`);
  process.exit(1);
}

const faltantes = new Map<string, string[]>();
for (const texto of textos()) {
  for (const caracter of texto) {
    const punto = caracter.codePointAt(0)!;
    // Los controles y el espacio no se dibujan.
    if (punto <= 0x20) continue;
    if (puntos.has(punto)) continue;
    const clave = `${caracter} (U+${punto.toString(16).toUpperCase().padStart(4, "0")})`;
    const usos = faltantes.get(clave) ?? [];
    if (usos.length < 2) usos.push(texto.slice(0, 60));
    faltantes.set(clave, usos);
  }
}

if (faltantes.size > 0) {
  console.error("✗ hay caracteres sin cobertura en las fuentes embebidas:");
  for (const [clave, usos] of faltantes) {
    console.error(`   ${clave} — en: ${usos.map((u) => JSON.stringify(u)).join(", ")}`);
  }
  console.error(
    "\n  Cambiá la notación por una que cubran los subsets, o agregá el glifo a las fuentes.",
  );
  process.exit(1);
}

console.log(`✓ cobertura de glifos: ${puntos.size} puntos de código, ningún carácter sin cubrir`);
