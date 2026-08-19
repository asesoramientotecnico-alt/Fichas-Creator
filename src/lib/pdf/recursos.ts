import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Recursos embebidos para el render del PDF.
 *
 * Todo va inline en el HTML: CSS, woff2 en base64 e imágenes en base64. El
 * Chromium serverless no siempre resuelve recursos externos, y §3 lo señala
 * como el riesgo que rompe la maqueta. Con `setContent` y todo embebido, el
 * render no depende de la red ni de la sesión del usuario.
 *
 * Los archivos se leen del disco para que ficha.css siga siendo la fuente
 * única de estilo: duplicarlo en un string de TS lo dejaría desincronizado
 * en la primera edición. next.config declara estas rutas en
 * outputFileTracingIncludes para que existan también en serverless.
 *
 * Para el PDF se usan instancias ESTÁTICAS (public/fonts-estaticas), no las
 * variables que usa la pantalla: Chromium no sabe embeber una instancia de
 * fuente variable en el PDF y vuelca cada glifo como contorno Type3. El
 * dibujo sale bien, pero el PDF queda sin fuente embebida de verdad, que es
 * justamente lo que §3 exige. Las estáticas se generan desde las mismas
 * variables con scripts/generar-fuentes-estaticas.mjs, así que no hay dos
 * tipografías distintas: es la misma, instanciada.
 */

const raiz = process.cwd();

// El bundle se reutiliza entre invocaciones: leer y codificar en base64 en
// cada request costaría ~1 MB de trabajo inútil por PDF.
let cache: string | null = null;

const FUENTES: { archivo: string; familia: string; estilo: string; peso: number; subset: "latin" | "latin-ext" }[] = (
  [
    { slug: "Roboto", familia: "Roboto", estilo: "normal", pesos: [300, 400, 500, 700] },
    { slug: "Roboto-Italic", familia: "Roboto", estilo: "italic", pesos: [300, 400, 700] },
    { slug: "RobotoCondensed", familia: "Roboto Condensed", estilo: "normal", pesos: [400, 700] },
  ] as const
).flatMap((f) =>
  (["latin", "latin-ext"] as const).flatMap((subset) =>
    f.pesos.map((peso) => ({
      archivo: `${f.slug}-${peso}.${subset}.woff2`,
      familia: f.familia,
      estilo: f.estilo,
      peso,
      subset,
    })),
  ),
);

const RANGO_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329," +
  "U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const RANGO_LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329," +
  "U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

async function fuentesEmbebidas(): Promise<string> {
  const partes = await Promise.all(
    FUENTES.map(async (f) => {
      const bin = await readFile(path.join(raiz, "public", "fonts-estaticas", f.archivo));
      const rango = f.subset === "latin" ? RANGO_LATIN : RANGO_LATIN_EXT;
      return [
        "@font-face{",
        `font-family:"${f.familia}";`,
        `font-style:${f.estilo};`,
        `font-weight:${f.peso};`,
        // `block` y no `swap`: en un PDF no hay reflow posterior, así que un
        // swap dejaría la primera pintada con la fuente de sistema.
        "font-display:block;",
        `src:url(data:font/woff2;base64,${bin.toString("base64")}) format("woff2");`,
        `unicode-range:${rango};`,
        "}",
      ].join("");
    }),
  );
  return partes.join("\n");
}

async function css(...rutas: string[]): Promise<string> {
  const partes = await Promise.all(rutas.map((r) => readFile(path.join(raiz, r), "utf8")));
  return partes.join("\n");
}

/** CSS específico de impresión: geometría de página y saltos. */
const CSS_IMPRESION = `
/* Sin margen de página: la hoja ya trae su propio padding, y un margen acá
   además le abre a Chrome la caja donde dibuja su encabezado de fecha y URL. */
@page {
  size: A4;
  margin: 0;
}

html, body {
  margin: 0;
  padding: 0;
  background: #fff;
}

/* Cada hoja es exactamente una página física. La altura fija (no min-height)
   evita que un redondeo de submilímetro empuje una hoja en blanco al final. */
.ficha .hoja {
  width: 210mm;
  height: 297mm;
  min-height: 0;
  margin: 0;
  box-shadow: none;
  border-radius: 0;
  overflow: hidden;
  break-inside: avoid;
}

.ficha .hoja + .hoja {
  margin-top: 0;
  break-before: page;
}

/* Los fondos y las reglas son parte del diseño, no decoración de pantalla. */
* {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
`;

export async function cssDelDocumento(): Promise<string> {
  if (cache) return cache;
  const [fuentes, hojas] = await Promise.all([
    fuentesEmbebidas(),
    css("src/app/design-system.css", "src/components/ficha/ficha.css"),
  ]);
  cache = [fuentes, hojas, CSS_IMPRESION].join("\n");
  return cache;
}

/** Imagen de public/ como data URI, para que no dependa de la red. */
export async function imagenEmbebida(rutaPublica: string): Promise<string> {
  const limpia = rutaPublica.replace(/^\//, "");
  const bin = await readFile(path.join(raiz, "public", limpia));
  const ext = path.extname(limpia).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
  return `data:${mime};base64,${bin.toString("base64")}`;
}
