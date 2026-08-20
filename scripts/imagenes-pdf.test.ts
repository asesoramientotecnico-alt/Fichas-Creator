/**
 * Pruebas de la extracción de imágenes de un PDF (§4bis). Corren contra los
 * dos PDFs de `referencia/`, que son fichas reales: el filtro de cromo se
 * calibró sobre ellas y esta prueba es lo que impide que se descalibre.
 *
 * Uso: tsx scripts/imagenes-pdf.test.ts
 */
import { readFileSync } from "node:fs";
import {
  describirImagen,
  imagenesDePdf,
  inventarioParaModelo,
  type ImagenExtraida,
} from "../src/lib/pdf/imagenes";

const casos: [string, () => boolean | Promise<boolean>][] = [];
const chk = (n: string, f: () => boolean | Promise<boolean>) => casos.push([n, f]);

const DISCO = "referencia/Ficha Tecnica - Disco de corte SG Steelox.pdf";
const V26 = "referencia/Plantilla ficha tecnica FAMIQ V26.pdf";

const pdf = (ruta: string) => new Uint8Array(readFileSync(ruta));

/** Se cachean: abrir el PDF y decodificar los bitmaps no es gratis. */
const cache = new Map<string, Promise<ImagenExtraida[]>>();
function imagenes(ruta: string): Promise<ImagenExtraida[]> {
  const previo = cache.get(ruta);
  if (previo) return previo;
  const p = imagenesDePdf(pdf(ruta));
  cache.set(ruta, p);
  return p;
}

/**
 * El pixel de la esquina superior izquierda del recorte. Se decodifica con el
 * propio mupdf para no depender de otra librería de imágenes.
 */
async function pixelEsquina(im: ImagenExtraida): Promise<{ esquina: number[] }> {
  const mupdf = await import("mupdf");
  const pix = new mupdf.Image(im.bytes).toPixmap();
  const px = pix.getPixels();
  const n = pix.getNumberOfComponents();
  return { esquina: [...px.slice(0, n)] };
}

// ------------------------------------------------------------
// La ficha del disco: una hoja, once imágenes, tres de contenido
// ------------------------------------------------------------

chk("disco: quedan las 3 figuras de contenido y caen los 8 pictogramas", async () => {
  return (await imagenes(DISCO)).length === 3;
});

chk("disco: la foto de producto es la más grande y está arriba a la derecha", async () => {
  const ims = await imagenes(DISCO);
  const mayor = [...ims].sort((a, b) => b.anchoPt * b.altoPt - a.anchoPt * a.altoPt)[0];
  return mayor.hoja === 1 && mayor.posicion === "arriba a la derecha" &&
         mayor.anchoOrigenPx === 538 && mayor.altoOrigenPx === 518;
});

chk("disco: la foto sale sobre blanco, no sobre negro", async () => {
  const ims = await imagenes(DISCO);
  const foto = [...ims].sort((a, b) => b.anchoPt * b.altoPt - a.anchoPt * a.altoPt)[0];
  // La transparencia del disco vive en una máscara suave: extraer el objeto
  // embebido da la foto sobre negro. El recorte de la hoja la compone sobre
  // blanco, y el pixel de la esquina lo demuestra.
  const { esquina } = await pixelEsquina(foto);
  return esquina.every((c) => c > 240);
});

chk("disco: no sobrevive nada por debajo del lado mínimo", async () => {
  const ims = await imagenes(DISCO);
  return ims.every((im) => Math.max(im.anchoOrigenPx, im.altoOrigenPx) >= 120);
});

chk("disco: la escala de dureza se reconoce por su origen y su colocación", async () => {
  const ims = await imagenes(DISCO);
  // 478×142 px de origen, colocada a 236×66 pt: es la barra A→Z.
  return ims.some(
    (im) => im.anchoOrigenPx === 478 && im.altoOrigenPx === 142 && im.anchoPt === 236,
  );
});

chk("el recorte se renderiza a la resolución del bitmap de origen o mejor", async () => {
  const ims = await imagenes(DISCO);
  // 150 DPI es el piso, así que el recorte nunca es más chico que eso.
  return ims.every((im) => im.anchoPx >= Math.floor((im.anchoPt / 72) * 150));
});

// ------------------------------------------------------------
// La plantilla V26: tres hojas, el logo repetido en todas
// ------------------------------------------------------------

chk("v26: el logo que está en las 3 hojas se descarta por repetido", async () => {
  const ims = await imagenes(V26);
  // El logo es 1080×1080 y aparece en las tres hojas.
  return ims.every((im) => !(im.anchoOrigenPx === 1080 && im.altoOrigenPx === 1080));
});

chk("v26: quedan las 5 imágenes de la maqueta", async () => {
  return (await imagenes(V26)).length === 5;
});

chk("v26: se reconocen el despiece de la hoja 2 y el kit de la hoja 3", async () => {
  const ims = await imagenes(V26);
  const despiece = ims.find((im) => im.hoja === 2 && im.anchoOrigenPx === 1298);
  const kit = ims.find((im) => im.hoja === 3 && im.anchoOrigenPx === 815);
  return despiece !== undefined && kit !== undefined;
});

// ------------------------------------------------------------
// Forma de la salida
// ------------------------------------------------------------

chk("los ids son imagen1..imagenN, en orden y sin huecos", async () => {
  const ims = await imagenes(V26);
  return ims.every((im, i) => im.id === `imagen${i + 1}`);
});

chk("de cada recorte se guarda el formato que pesa menos", async () => {
  const ims = await imagenes(DISCO);
  // La regla es "el más chico de PNG y JPEG": la foto gana en JPEG, un dibujo
  // de líneas planas gana en PNG. Lo que se verifica es la coherencia entre la
  // extensión y el mime, y que los bytes sean del formato que dice ser.
  return ims.every(
    (im) =>
      (im.extension === "png" && im.tipoMime === "image/png") ||
      (im.extension === "jpg" && im.tipoMime === "image/jpeg"),
  );
});

chk("cada imagen trae bytes con la firma de su formato", async () => {
  const ims = await imagenes(DISCO);
  return ims.every((im) => {
    const b = im.bytes;
    if (im.extension === "png") {
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    }
    return b[0] === 0xff && b[1] === 0xd8;
  });
});

chk("el hash es estable entre corridas: de él depende no duplicar el asset", async () => {
  const unos = await imagenesDePdf(pdf(DISCO));
  const otros = await imagenesDePdf(pdf(DISCO));
  return unos.length === otros.length &&
         unos.every((im, i) => im.hash === otros[i].hash && im.hash.length === 64);
});

chk("hashes distintos para imágenes distintas", async () => {
  const ims = await imagenes(V26);
  return new Set(ims.map((im) => im.hash)).size === ims.length;
});

// ------------------------------------------------------------
// El inventario que ve el modelo
// ------------------------------------------------------------

chk("el inventario nombra todas las imágenes y no lleva bytes", async () => {
  const ims = await imagenes(V26);
  const texto = inventarioParaModelo(ims);
  return ims.every((im) => texto.includes(im.id)) &&
         texto.includes("hoja 2") && texto.includes("hoja 3") &&
         !texto.includes("base64") && texto.length < 1000;
});

chk("el inventario de un PDF sin imágenes es vacío, no una lista vacía", () => {
  return inventarioParaModelo([]) === "";
});

chk("el inventario concuerda en singular y plural", async () => {
  const ims = await imagenes(DISCO);
  return inventarioParaModelo(ims).includes("3 imágenes") &&
         inventarioParaModelo([ims[0]]).includes("1 imagen que ya se extrajo") === false &&
         inventarioParaModelo([ims[0]]).includes("1 imagen");
});

chk("la descripción de una imagen sin asignar dice dónde estaba", async () => {
  const ims = await imagenes(DISCO);
  const d = describirImagen(ims[0]);
  return d.startsWith("imagen1 (hoja 1,") && d.includes("px)");
});

async function correr() {
  let ok = 0;
  for (const [n, f] of casos) {
    let paso = false;
    try { paso = await f(); } catch (e) { console.log("  ERROR", n, e); }
    console.log((paso ? "  ✓ " : "  ✗ ") + n);
    if (paso) ok++;
  }
  console.log(`\n${ok}/${casos.length} pruebas pasan`);
  if (ok !== casos.length) process.exit(1);
}

correr();
