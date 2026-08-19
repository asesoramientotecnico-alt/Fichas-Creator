// Genera las instancias estáticas de Roboto que usa el PDF, a partir de las
// fuentes variables de public/fonts. Correr sólo si cambian los cortes que
// usa la ficha. Uso: node scripts/generar-fuentes-estaticas.mjs
//
// Por qué existen: Chromium no embebe instancias de fuentes variables en el
// PDF; vuelca cada glifo como contorno Type3. Con estáticas las embebe como
// subsets Type0, que es lo que pide §3 y lo que espera una imprenta.
import { execFileSync } from "node:child_process";

const PY = `
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
import os

CORTES = [
    ("Roboto",          "Roboto",           [300, 400, 500, 700]),
    ("Roboto-Italic",   "Roboto",           [300, 400, 700]),
    ("RobotoCondensed", "Roboto Condensed", [400, 700]),
]

os.makedirs("public/fonts-estaticas", exist_ok=True)
total = 0
for slug, familia, pesos in CORTES:
    for subset in ("latin", "latin-ext"):
        for peso in pesos:
            f = TTFont(f"public/fonts/{slug}.{subset}.woff2")
            instancer.instantiateVariableFont(f, {"wght": peso}, inplace=True, updateFontNames=True)
            f.flavor = "woff2"
            destino = f"public/fonts-estaticas/{slug}-{peso}.{subset}.woff2"
            f.save(destino)
            total += os.path.getsize(destino)
            print(f"  {os.path.basename(destino)}")
print(f"{total/1024:.0f} KB en total")
`;

execFileSync("python3", ["-c", PY], { stdio: "inherit" });
