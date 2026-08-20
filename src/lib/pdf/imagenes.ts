import { createHash } from "node:crypto";

/**
 * Extracción de las imágenes de un PDF de ficha, para "Cargar desde PDF"
 * (§4bis).
 *
 * Es determinístico y SIN IA: las imágenes de un PDF son objetos embebidos con
 * su rectángulo de colocación. El modelo no interviene acá, y por eso no puede
 * inventar una imagen ni recortar mal una cota — sólo dice, más adelante, a
 * qué bloque pertenece cada una.
 *
 * Los rectángulos se encuentran recorriendo el texto estructurado, pero la
 * imagen NO se copia del objeto embebido: se renderiza esa región de la hoja
 * sobre blanco. La diferencia importa. La foto del disco Steelox tiene su
 * transparencia en una máscara suave aparte, y el objeto embebido por sí solo
 * es la foto sobre negro: extraerlo byte a byte da un rectángulo negro en la
 * ficha. Renderizando la región, MuPDF compone la máscara, los recortes y lo
 * que haya encima, y sale exactamente lo que se ve en el PDF.
 *
 * De paso, renderizar resuelve los rótulos que son parte de la figura sin ser
 * parte del bitmap — las leyendas "DISCOS MÁS BLANDOS / MÁS DUROS" de la
 * escala de dureza caen dentro del rectángulo de la imagen y entran en el
 * recorte, que es lo que corresponde.
 *
 * Lo que NO hace: buscar figuras puramente vectoriales. Medido sobre la
 * plantilla V26 y sobre la ficha del disco, los vectores de una ficha son el
 * fondo de la hoja, las bandas grises, las reglas y los marcos de las
 * figuras — cromo del layout, no contenido. Las fotos, los croquis, los
 * despieces y las curvas presión/temperatura vienen todos como bitmap.
 */

/** Fracción mínima de la hoja para considerar que una imagen es contenido. */
const AREA_MINIMA = 0.006;
/** Lado mayor mínimo en píxeles. Descarta glifos rendereados como imagen. */
const LADO_MINIMO = 120;
/** Relación de aspecto máxima. Descarta filetes y separadores. */
const PROPORCION_MAXIMA = 8;
/**
 * Rango de resolución del recorte. Se apunta a la resolución del bitmap de
 * origen para no perder detalle ni inventarlo: la foto del disco son 538 px en
 * 247,7 pt, o sea 156 DPI. El techo evita que un logo diminuto de 1080 px
 * colocado en 20 pt dispare un render de 4.000 DPI.
 */
const DPI_MINIMO = 150;
const DPI_MAXIMO = 300;

export interface ImagenExtraida {
  /** `imagen1`, `imagen2`… El modelo referencia la imagen por este id. */
  id: string;
  hoja: number;
  /** Descripción de dónde cae en la hoja, para que el modelo la ubique. */
  posicion: string;
  /** Tamaño con el que está colocada en la hoja, en puntos. */
  anchoPt: number;
  altoPt: number;
  /** Tamaño del archivo que se genera, en píxeles. */
  anchoPx: number;
  altoPx: number;
  /**
   * Tamaño del bitmap embebido en el PDF. Es lo que identifica a la imagen
   * —el recorte depende del DPI elegido— y lo que mira el filtro de cromo.
   */
  anchoOrigenPx: number;
  altoOrigenPx: number;
  extension: "png" | "jpg";
  tipoMime: string;
  bytes: Uint8Array;
  /** Hash del contenido, para no subir dos veces la misma imagen. */
  hash: string;
}

interface Cruda extends Omit<ImagenExtraida, "id" | "posicion" | "bytes" | "extension" | "tipoMime"> {
  /** Rectángulo en coordenadas de la hoja, para renderizar el recorte. */
  bbox: [number, number, number, number];
  x: number;
  y: number;
  anchoHoja: number;
  altoHoja: number;
  fraccion: number;
  indiceHoja: number;
}

/** Dónde cae la imagen en la hoja, en palabras. */
function describirPosicion(im: Cruda): string {
  const cx = im.x + im.anchoPt / 2;
  const cy = im.y + im.altoPt / 2;
  const vertical =
    cy < im.altoHoja / 3 ? "arriba" : cy > (2 * im.altoHoja) / 3 ? "abajo" : "al medio";
  const horizontal =
    cx < im.anchoHoja / 3
      ? "a la izquierda"
      : cx > (2 * im.anchoHoja) / 3
        ? "a la derecha"
        : "al centro";
  return `${vertical} ${horizontal}`;
}

/**
 * Las imágenes de contenido de un PDF, ya filtrado el cromo.
 *
 * El filtro es el corazón del asunto: una ficha trae muchas más imágenes que
 * las que se ven como figuras. La del disco Steelox tiene once, y ocho son
 * pictogramas de seguridad, fragmentos de una escala y hasta una letra "a"
 * rendereada como bitmap. Se descartan por cuatro señales, todas geométricas:
 *
 * - Área de colocación: las tres figuras reales ocupan 11,8%, 3,1% y 1,0% de
 *   la hoja; el resto, 0,16% o menos. El corte en 0,6% cae en el medio de un
 *   hueco de 6×.
 * - Lado mínimo en píxeles: un glifo suelto mide 40×44.
 * - Relación de aspecto: un filete de 69×8 no es una figura.
 * - Repetición: una imagen que aparece en TODAS las hojas es el logo o la
 *   píldora de unidad de negocio, no una figura de la ficha.
 *
 * Lo que sobrevive al filtro todavía puede no ser contenido — la píldora
 * amarilla de la V26 pasa, porque está sólo en la primera hoja. Eso se
 * resuelve después y sin heurística: sólo se sube lo que el modelo asigna a un
 * bloque, y lo que queda sin asignar se le informa a la persona.
 */
export async function imagenesDePdf(pdf: Uint8Array): Promise<ImagenExtraida[]> {
  // Import diferido: mupdf usa top-level await y arrastra 10 MB de WASM. Así
  // sólo se carga cuando hay un PDF del que leer imágenes, y los módulos que
  // importan el extractor no pagan el costo en cada arranque en frío.
  const mupdf = await import("mupdf");
  const documento = mupdf.Document.openDocument(pdf, "application/pdf");
  const hojas = documento.countPages();
  const crudas: Cruda[] = [];

  // Pasada 1: dónde está cada imagen y qué es. Todavía no se renderiza nada:
  // renderizar el cromo que después se descarta sería tiempo tirado.
  for (let i = 0; i < hojas; i++) {
    const pagina = documento.loadPage(i);
    const [hx0, hy0, hx1, hy1] = pagina.getBounds();
    const anchoHoja = hx1 - hx0;
    const altoHoja = hy1 - hy0;
    // Sin "preserve-images" el texto estructurado descarta las imágenes.
    const texto = pagina.toStructuredText("preserve-images");

    texto.walk({
      onImageBlock(bbox, _transformacion, imagen) {
        const [x0, y0, x1, y1] = bbox;
        const anchoPt = x1 - x0;
        const altoPt = y1 - y0;
        if (anchoPt <= 0 || altoPt <= 0) return;

        crudas.push({
          hoja: i + 1,
          indiceHoja: i,
          bbox: [x0, y0, x1, y1],
          anchoPt,
          altoPt,
          anchoPx: 0,
          altoPx: 0,
          anchoOrigenPx: imagen.getWidth(),
          altoOrigenPx: imagen.getHeight(),
          // El hash es del objeto embebido, NO del recorte: identifica la
          // imagen sin depender de dónde esté colocada ni de qué haya
          // alrededor. De él dependen la detección del logo repetido y la
          // deduplicación en la librería.
          hash: createHash("sha256").update(imagen.toPixmap().getPixels()).digest("hex"),
          x: x0 - hx0,
          y: y0 - hy0,
          anchoHoja,
          altoHoja,
          fraccion: (anchoPt * altoPt) / (anchoHoja * altoHoja),
        });
      },
    });
  }

  // En cuántas hojas distintas aparece cada imagen. Se compara por hash del
  // contenido: el logo es el mismo objeto colocado en cada hoja.
  const hojasPorHash = new Map<string, Set<number>>();
  for (const im of crudas) {
    const vistas = hojasPorHash.get(im.hash) ?? new Set<number>();
    vistas.add(im.hoja);
    hojasPorHash.set(im.hash, vistas);
  }

  const sobrevivientes: Cruda[] = [];
  const yaVista = new Set<string>();
  for (const im of crudas) {
    if (hojas > 1 && hojasPorHash.get(im.hash)!.size === hojas) continue;
    if (im.fraccion < AREA_MINIMA) continue;
    if (Math.max(im.anchoOrigenPx, im.altoOrigenPx) < LADO_MINIMO) continue;
    const proporcion = Math.max(im.anchoPt / im.altoPt, im.altoPt / im.anchoPt);
    if (proporcion > PROPORCION_MAXIMA) continue;
    // La misma imagen colocada dos veces se ofrece una sola vez.
    if (yaVista.has(im.hash)) continue;
    yaVista.add(im.hash);
    sobrevivientes.push(im);
  }

  // Pasada 2: el recorte de cada región que quedó.
  const contenido: ImagenExtraida[] = [];
  for (const im of sobrevivientes) {
    const pagina = documento.loadPage(im.indiceHoja);
    const dpi = Math.min(
      DPI_MAXIMO,
      Math.max(DPI_MINIMO, Math.round(im.anchoOrigenPx / (im.anchoPt / 72))),
    );
    const escala = dpi / 72;
    const caja: [number, number, number, number] = [
      Math.floor(im.bbox[0] * escala),
      Math.floor(im.bbox[1] * escala),
      Math.ceil(im.bbox[2] * escala),
      Math.ceil(im.bbox[3] * escala),
    ];

    const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, caja, false);
    // Blanco, que es el fondo de la hoja: lo que quede transparente en la
    // figura se ve como en el PDF y no como un rectángulo negro.
    pixmap.clear(255);
    const dispositivo = new mupdf.DrawDevice(mupdf.Matrix.identity, pixmap);
    pagina.run(dispositivo, mupdf.Matrix.scale(escala, escala));
    dispositivo.close();

    const { bytes, extension, tipoMime } = mejorFormato(pixmap);

    contenido.push({
      id: `imagen${contenido.length + 1}`,
      hoja: im.hoja,
      posicion: describirPosicion(im),
      anchoPt: Math.round(im.anchoPt),
      altoPt: Math.round(im.altoPt),
      anchoPx: pixmap.getWidth(),
      altoPx: pixmap.getHeight(),
      anchoOrigenPx: im.anchoOrigenPx,
      altoOrigenPx: im.altoOrigenPx,
      extension,
      tipoMime,
      bytes,
      hash: im.hash,
    });
  }

  return contenido;
}

/**
 * PNG o JPEG, el que pese menos. No es una micro-optimización: una foto en PNG
 * pesa cinco veces más, y un croquis de líneas en JPEG sale con ringing
 * alrededor de cada trazo y pesa más que el PNG. Comparar los dos tamaños
 * acierta en los dos casos sin tener que adivinar qué clase de figura es.
 */
function mejorFormato(pixmap: {
  asPNG(): Uint8Array;
  asJPEG(calidad: number): Uint8Array;
}): { bytes: Uint8Array; extension: "png" | "jpg"; tipoMime: string } {
  const png = pixmap.asPNG();
  const jpg = pixmap.asJPEG(90);
  return jpg.length < png.length
    ? { bytes: jpg, extension: "jpg", tipoMime: "image/jpeg" }
    : { bytes: png, extension: "png", tipoMime: "image/png" };
}

/**
 * El inventario que se le pasa al modelo. No lleva las imágenes: lleva su id y
 * dónde están, para que el modelo elija de una lista en vez de producir
 * coordenadas. Un id se puede validar; unas coordenadas inventadas, no.
 */
export function inventarioParaModelo(imagenes: ImagenExtraida[]): string {
  if (imagenes.length === 0) return "";
  const lineas = imagenes.map(
    (im) =>
      `- ${im.id}: hoja ${im.hoja}, ${im.posicion}, ocupa ${im.anchoPt}×${im.altoPt} pt`,
  );
  return `\n\nEste PDF tiene ${imagenes.length} ${
    imagenes.length === 1 ? "imagen" : "imágenes"
  } que ya se extrajeron aparte:\n${lineas.join("\n")}`;
}

/** Descripción corta para informarle a la persona una imagen sin asignar. */
export function describirImagen(im: ImagenExtraida): string {
  return `${im.id} (hoja ${im.hoja}, ${im.posicion}, ${im.anchoPx}×${im.altoPx} px)`;
}
