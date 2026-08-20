/**
 * Pruebas del extractor de PDF. No llaman al modelo: el cliente se inyecta.
 * Uso: tsx scripts/extractor.test.ts
 */
import { readFileSync } from "node:fs";
import {
  aBloques,
  extraerDePdf,
  ErrorExtraccion,
  type BloqueExtraido,
  type ClienteExtraccion,
} from "../src/lib/ia/extractor";

const casos: [string, () => boolean | Promise<boolean>][] = [];
const chk = (n: string, f: () => boolean | Promise<boolean>) => casos.push([n, f]);

/** Bloque extraído con todos los campos vacíos, para llenar sólo lo que importa. */
function plano(tipo: BloqueExtraido["tipo"], parcial: Partial<BloqueExtraido> = {}): BloqueExtraido {
  return {
    tipo,
    ancho: "completo",
    etiqueta: "", sufijo: "", nota: "", alt: "", valor: "", imagenRef: "",
    familia: "", subfamilia: "", tituloEs: "", subtituloEn: "",
    orientacion: "horizontal", marco: false,
    lineas: [], columnas: [], filas: [], pares: [], cotas: [],
    tablas: [], componentes: [],
    ladoIzquierdo: { etiqueta: "", texto: "" },
    ladoDerecho: { etiqueta: "", texto: "" },
    ...parcial,
  } as BloqueExtraido;
}

// ------------------------------------------------------------
// aBloques: traducción de la forma plana al bloque del dominio
// ------------------------------------------------------------

chk("header: pasa título, familia y subfamilia", () => {
  const [b] = aBloques([plano("header", {
    tituloEs: "Disco de corte", familia: "Consumibles", subfamilia: "Corte",
  })]);
  return b.tipo === "header" && b.tituloEs === "Disco de corte" &&
         b.familia === "Consumibles" && b.subfamilia === "Corte";
});

chk("header sin título se descarta: no hay ficha sin producto", () => {
  return aBloques([plano("header", { familia: "Consumibles" })]).length === 0;
});

chk("texto-rico: cada línea es un párrafo, y las vacías se caen", () => {
  const [b] = aBloques([plano("texto-rico", {
    etiqueta: "Aplicación", lineas: ["Primero.", "  ", "Segundo."],
  })]);
  return b.tipo === "texto-rico" && b.parrafos.length === 2 &&
         b.parrafos[1] === "Segundo.";
});

chk("chips: las mismas líneas, pero como items", () => {
  const [b] = aBloques([plano("chips", { etiqueta: "Usos", lineas: ["Agua", "Vapor"] })]);
  return b.tipo === "chips" && b.items.join() === "Agua,Vapor";
});

chk("tabla-kv: los pares se mapean a label/value y respetan la orientación", () => {
  const [b] = aBloques([plano("tabla-kv", {
    etiqueta: "Datos", orientacion: "vertical",
    pares: [{ izquierda: "Ancho", derecha: "2,8 mm" }],
  })]);
  return b.tipo === "tabla-kv" && b.orientacion === "vertical" &&
         b.filas[0].label === "Ancho" && b.filas[0].value === "2,8 mm";
});

chk("codigos: los mismos pares, pero como codigo/medida", () => {
  const [b] = aBloques([plano("codigos", {
    etiqueta: "Repuestos", pares: [{ izquierda: "350834", derecha: '1/2\"' }],
  })]);
  return b.tipo === "codigos" && b.pares[0].codigo === "350834" &&
         b.pares[0].medida === '1/2\"';
});

chk("tabla: se descartan las filas sin ninguna celda con dato", () => {
  const [b] = aBloques([plano("tabla", {
    etiqueta: "Medidas",
    columnas: [{ titulo: "A", alineacion: "izquierda" }, { titulo: "B", alineacion: "derecha" }],
    filas: [["1", "2"], ["", ""], ["3", ""]],
  })]);
  return b.tipo === "tabla" && b.filas.length === 2;
});

chk("tabla sin columnas se descarta", () => {
  return aBloques([plano("tabla", { etiqueta: "Vacía", filas: [["a"]] })]).length === 0;
});

chk("tabla-ancha conserva la nota, que es obligatoria para leerla", () => {
  const [b] = aBloques([plano("tabla-ancha", {
    etiqueta: "Cotas", nota: "Ød paso de esfera",
    columnas: [{ titulo: "Ød", alineacion: "derecha" }],
    filas: [["11"]],
  })]);
  return b.tipo === "tabla-ancha" && b.nota === "Ød paso de esfera";
});

chk("lista-componentes: los títulos de columna son fijos, no los pone el modelo", () => {
  const [b] = aBloques([plano("lista-componentes", {
    etiqueta: "Componentes",
    componentes: [{ n: "1", componente: "Cuerpo", material: "A351", cantidad: "1" }],
  })]);
  return b.tipo === "lista-componentes" &&
         b.columnas.item === "Ítem" && b.columnas.cantidad === "Cant." &&
         b.items[0].componente === "Cuerpo";
});

chk("imagen: nunca trae assetId, la elige la persona de la librería", () => {
  const [b] = aBloques([plano("imagen", {
    etiqueta: "Presión", alt: "Curva de presión", marco: true,
  })]);
  return b.tipo === "imagen" && b.assetId === undefined &&
         b.alt === "Curva de presión" && b.marco === true;
});

chk("croquis sin cotas se descarta: sin leyenda no es un croquis", () => {
  return aBloques([plano("croquis")]).length === 0;
});

chk("par-texto necesita al menos un lado con texto", () => {
  const vacio = aBloques([plano("par-texto", {
    ladoIzquierdo: { etiqueta: "A", texto: "" }, ladoDerecho: { etiqueta: "B", texto: "" },
  })]);
  const [b] = aBloques([plano("par-texto", {
    ladoIzquierdo: { etiqueta: "A", texto: "Hay texto" }, ladoDerecho: { etiqueta: "B", texto: "" },
  })]);
  return vacio.length === 0 && b.tipo === "par-texto" && b.izquierda.texto === "Hay texto";
});

chk("barra-destacada e inline-kv se descartan sin valor", () => {
  return aBloques([plano("barra-destacada", { etiqueta: "Uso" })]).length === 0 &&
         aBloques([plano("inline-kv", { etiqueta: "Material" })]).length === 0;
});

chk("los campos opcionales vacíos no se guardan como cadena vacía", () => {
  const [b] = aBloques([plano("tabla-kv", {
    etiqueta: "Datos", sufijo: "   ",
    pares: [{ izquierda: "A", derecha: "1" }],
  })]);
  return b.tipo === "tabla-kv" && b.sufijo === undefined;
});

chk("se conserva el orden de lectura del PDF", () => {
  const bs = aBloques([
    plano("header", { tituloEs: "Producto" }),
    plano("texto-rico", { etiqueta: "Uno", lineas: ["a"] }),
    plano("chips", { etiqueta: "Dos", lineas: ["b"] }),
  ]);
  return bs.map((b) => b.tipo).join() === "header,texto-rico,chips";
});

chk("cada bloque recibe un id propio", () => {
  const bs = aBloques([
    plano("texto-rico", { etiqueta: "Uno", lineas: ["a"] }),
    plano("texto-rico", { etiqueta: "Dos", lineas: ["b"] }),
  ]);
  return bs.length === 2 && bs[0].id !== bs[1].id && bs[0].id.startsWith("texto-rico-");
});

chk("se respeta el ancho que eligió el modelo", () => {
  const bs = aBloques([
    plano("imagen", { ancho: "dos-tercios", alt: "x" }),
    plano("tabla-kv", { ancho: "un-tercio", pares: [{ izquierda: "A", derecha: "1" }] }),
  ]);
  return bs[0].ancho === "dos-tercios" && bs[1].ancho === "un-tercio";
});

// ------------------------------------------------------------
// aBloques: asignación de las imágenes extraídas del PDF
// ------------------------------------------------------------

/** Resolvedor de prueba: `imagen1` → `asset-1`, y nada más existe. */
const resolver = (ref: string) =>
  ({ imagen1: "asset-1", imagen2: "asset-2" })[ref];

chk("header: la imagen asignada va a fotoAssetId", () => {
  const [b] = aBloques(
    [plano("header", { tituloEs: "Disco", imagenRef: "imagen1" })],
    resolver,
  );
  return b.tipo === "header" && b.fotoAssetId === "asset-1";
});

chk("imagen y croquis reciben su assetId", () => {
  const [img, cro] = aBloques(
    [
      plano("imagen", { alt: "Curva", imagenRef: "imagen1" }),
      plano("croquis", {
        imagenRef: "imagen2",
        cotas: [{ simbolo: "Ød", nombre: "Paso" }],
      }),
    ],
    resolver,
  );
  return img.tipo === "imagen" && img.assetId === "asset-1" &&
         cro.tipo === "croquis" && cro.assetId === "asset-2";
});

chk("codigos recibe su assetId", () => {
  const [b] = aBloques(
    [plano("codigos", {
      etiqueta: "Repuestos", imagenRef: "imagen2",
      pares: [{ izquierda: "350834", derecha: '1/2\"' }],
    })],
    resolver,
  );
  return b.tipo === "codigos" && b.assetId === "asset-2";
});

chk("una referencia que no existe deja el bloque sin imagen", () => {
  const [b] = aBloques([plano("imagen", { alt: "x", imagenRef: "imagen9" })], resolver);
  return b.tipo === "imagen" && b.assetId === undefined;
});

chk("sin referencia el bloque queda sin imagen, como antes", () => {
  const [b] = aBloques([plano("imagen", { alt: "x" })], resolver);
  return b.tipo === "imagen" && b.assetId === undefined;
});

chk("sin resolvedor ningún bloque recibe imagen", () => {
  const [b] = aBloques([plano("imagen", { alt: "x", imagenRef: "imagen1" })]);
  return b.tipo === "imagen" && b.assetId === undefined;
});

chk("los tipos que no llevan imagen ignoran la referencia", () => {
  const [b] = aBloques(
    [plano("texto-rico", { etiqueta: "Uso", lineas: ["a"], imagenRef: "imagen1" })],
    resolver,
  );
  return b.tipo === "texto-rico" && !("assetId" in b);
});

// ------------------------------------------------------------
// extraerDePdf: validación de entrada y de la respuesta
// ------------------------------------------------------------

/**
 * Un PDF de una hoja, válido y sin imágenes. Tiene que ser un PDF de verdad y
 * no un `%PDF-` con basura: el extractor le pide las imágenes a mupdf, y con
 * un archivo roto mupdf escribe avisos de reparación que ensucian la salida de
 * las pruebas.
 */
const PDF_MINIMO = new Uint8Array(
  Buffer.from(
  "JVBERi0xLjcKJcK1wrYKJSBXcml0dGVuIGJ5IE11UERGIDEuMjguMgoKMSAwIG9iago8PC9UeXBl" +
  "L0NhdGFsb2cvUGFnZXMgMiAwIFIvSW5mbzw8L1Byb2R1Y2VyKE11UERGIDEuMjguMik+Pj4+CmVu" +
  "ZG9iagoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1s0IDAgUl0+PgplbmRvYmoK" +
  "CjMgMCBvYmoKPDwvRm9udDw8L2hlbHYgNSAwIFI+Pj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBl" +
  "L1BhZ2UvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1JvdGF0ZSAwL1Jlc291cmNlcyAzIDAgUi9QYXJl" +
  "bnQgMiAwIFIvQ29udGVudHNbNiAwIFJdPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvRm9udC9T" +
  "dWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYS9FbmNvZGluZy9XaW5BbnNpRW5jb2Rpbmc+" +
  "PgplbmRvYmoKCjYgMCBvYmoKPDwvTGVuZ3RoIDgyL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVh" +
  "bQp4nA3GoQqAUAwF0L6v2B+4zb07BTEIFpuwJkbFoMHi9/s45dBLU5KyVMphHG6cDzXXcX+s9Sdv" +
  "gwM9WnRQEziKSUhYFBQYdNxzoTlppR+QAxDSCmVuZHN0cmVhbQplbmRvYmoKCnhyZWYKMCA3CjAw" +
  "MDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA0MiAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIG4g" +
  "CjAwMDAwMDAxNzIgMDAwMDAgbiAKMDAwMDAwMDIxMyAwMDAwMCBuIAowMDAwMDAwMzIwIDAwMDAw" +
  "IG4gCjAwMDAwMDA0MDkgMDAwMDAgbiAKCnRyYWlsZXIKPDwvU2l6ZSA3L1Jvb3QgMSAwIFIvSURb" +
  "KFxuYzs3XDMwMlwyNjU9Ij1nJlxiMlwwMDB2Mik8NDBDMzE5NUI1NkE0MDJBQzA3OTAzQjZCNzdF" +
  "NEYzOUQ+XT4+CnN0YXJ0eHJlZgo1NTkKJSVFT0YK", "base64"),
);

function clienteQueDevuelve(parsed: unknown): ClienteExtraccion {
  return { async extraer() { return { parsed }; } };
}

chk("un archivo que no es PDF se rechaza sin llamar al modelo", async () => {
  let llamo = false;
  const cliente: ClienteExtraccion = {
    async extraer() { llamo = true; return { parsed: {} }; },
  };
  try {
    await extraerDePdf(new Uint8Array(Buffer.from("no soy un pdf")), cliente);
    return false;
  } catch (e) {
    return e instanceof ErrorExtraccion && !llamo;
  }
});

chk("un archivo vacío se rechaza", async () => {
  try {
    await extraerDePdf(new Uint8Array(0), clienteQueDevuelve({}));
    return false;
  } catch (e) {
    return e instanceof ErrorExtraccion;
  }
});

chk("una respuesta con forma inesperada descarta la extracción completa", async () => {
  try {
    await extraerDePdf(PDF_MINIMO, clienteQueDevuelve({ cosas: [1, 2] }));
    return false;
  } catch (e) {
    return e instanceof ErrorExtraccion;
  }
});

chk("si no queda ningún bloque con contenido, se informa el fallo", async () => {
  try {
    await extraerDePdf(
      PDF_MINIMO,
      clienteQueDevuelve({ bloques: [plano("texto-rico", { etiqueta: "Vacío" })], omitido: [] }),
    );
    return false;
  } catch (e) {
    return e instanceof ErrorExtraccion;
  }
});

// El PDF del disco, que tiene tres imágenes de contenido. Sirve para probar
// el camino de las imágenes con el cliente inyectado, sin llamar al modelo.
const PDF_DISCO = new Uint8Array(
  readFileSync("referencia/Ficha Tecnica - Disco de corte SG Steelox.pdf"),
);

chk("un valor de presentación fuera del enum se normaliza, no tumba la ficha", async () => {
  // Caso real: el modelo devolvió `orientacion` fuera del enum en los ocho
  // bloques de una ficha. Antes eso descartaba la transcripción completa.
  const crudo = plano("tabla-kv", {
    etiqueta: "Datos",
    pares: [{ izquierda: "Ancho", derecha: "2,8 mm" }],
    columnas: [{ titulo: "A", alineacion: "izquierda" }],
  }) as unknown as Record<string, unknown>;
  crudo.orientacion = "";
  crudo.ancho = "gigante";
  crudo.marco = null;
  crudo.columnas = [{ titulo: "A", alineacion: "centrada" }];

  const r = await extraerDePdf(
    PDF_MINIMO,
    clienteQueDevuelve({ bloques: [crudo], omitido: [] }),
  );
  const b = r.bloques[0];
  return b.tipo === "tabla-kv" && b.orientacion === "horizontal" && b.ancho === "completo";
});

chk("normalizar la presentación NO completa campos de contenido", async () => {
  // La leniencia es sólo para lo presentacional: un bloque sin datos se sigue
  // cayendo, no se rellena con algo plausible (§4bis regla 2).
  const crudo = plano("tabla-kv", { etiqueta: "Datos" }) as unknown as Record<string, unknown>;
  crudo.orientacion = "";
  try {
    await extraerDePdf(PDF_MINIMO, clienteQueDevuelve({ bloques: [crudo], omitido: [] }));
    return false;
  } catch (e) {
    return e instanceof ErrorExtraccion;
  }
});

chk("una imagen que el modelo no asigna se informa, no se sube en silencio", async () => {
  let recibidas = 0;
  const r = await extraerDePdf(
    PDF_DISCO,
    clienteQueDevuelve({
      bloques: [plano("header", { tituloEs: "Disco" })],
      omitido: [],
    }),
    async (imgs) => {
      recibidas = imgs.length;
      return new Map();
    },
  );
  // Ninguna asignada: no se llama a la subida y las tres se informan.
  return recibidas === 0 && r.imagenesUsadas === 0 &&
         r.omitido.filter((o) => o.includes("no se asignó")).length === 3;
});

chk("sólo se le pasan a la subida las imágenes asignadas", async () => {
  let recibidas: string[] = [];
  const r = await extraerDePdf(
    PDF_DISCO,
    clienteQueDevuelve({
      bloques: [
        plano("header", { tituloEs: "Disco", imagenRef: "imagen1" }),
        plano("imagen", { alt: "Escala", imagenRef: "imagen3" }),
      ],
      omitido: [],
    }),
    async (imgs) => {
      recibidas = imgs.map((i) => i.id);
      return new Map(imgs.map((i) => [i.id, `asset-${i.id}`]));
    },
  );
  const header = r.bloques.find((b) => b.tipo === "header");
  return recibidas.join() === "imagen1,imagen3" && r.imagenesUsadas === 2 &&
         header?.tipo === "header" && header.fotoAssetId === "asset-imagen1" &&
         // La que quedó sin asignar es la única que se informa.
         r.omitido.filter((o) => o.includes("no se asignó")).length === 1 &&
         r.omitido.some((o) => o.startsWith("imagen2"));
});

chk("la foto del header entra como foto y el resto como croquis", async () => {
  let tipos: string[] = [];
  await extraerDePdf(
    PDF_DISCO,
    clienteQueDevuelve({
      bloques: [
        plano("header", { tituloEs: "Disco", imagenRef: "imagen1" }),
        plano("imagen", { alt: "Escala", imagenRef: "imagen2" }),
      ],
      omitido: [],
    }),
    async (imgs) => {
      tipos = imgs.map((i) => i.tipoAsset);
      return new Map();
    },
  );
  return tipos.join() === "foto,croquis";
});

chk("una referencia repetida se le asigna al primer bloque, no a los dos", async () => {
  const r = await extraerDePdf(
    PDF_DISCO,
    clienteQueDevuelve({
      bloques: [
        plano("imagen", { alt: "Primera", imagenRef: "imagen1" }),
        plano("imagen", { alt: "Segunda", imagenRef: "imagen1" }),
      ],
      omitido: [],
    }),
    async (imgs) => new Map(imgs.map((i) => [i.id, `asset-${i.id}`])),
  );
  // Las dos apuntan al mismo asset porque el modelo lo pidió, pero se subió
  // una sola vez: la lista que llega a la subida no tiene repetidos.
  return r.imagenesUsadas === 1 && r.bloques.length === 2;
});

chk("una referencia inventada no rompe nada y la imagen se informa", async () => {
  const r = await extraerDePdf(
    PDF_DISCO,
    clienteQueDevuelve({
      bloques: [plano("header", { tituloEs: "Disco", imagenRef: "imagen42" })],
      omitido: [],
    }),
    async (imgs) => new Map(imgs.map((i) => [i.id, `asset-${i.id}`])),
  );
  const header = r.bloques.find((b) => b.tipo === "header");
  return r.imagenesUsadas === 0 &&
         header?.tipo === "header" && header.fotoAssetId === undefined &&
         r.omitido.filter((o) => o.includes("no se asignó")).length === 3;
});

chk("si la subida falla, la transcripción del texto igual sirve", async () => {
  const r = await extraerDePdf(
    PDF_DISCO,
    clienteQueDevuelve({
      bloques: [plano("header", { tituloEs: "Disco", imagenRef: "imagen1" })],
      omitido: [],
    }),
    async () => { throw new Error("el bucket no responde"); },
  );
  const header = r.bloques.find((b) => b.tipo === "header");
  return r.bloques.length === 1 && r.imagenesUsadas === 0 &&
         header?.tipo === "header" && header.fotoAssetId === undefined;
});

chk("sin subidor las imágenes no se tocan y los bloques quedan sin asset", async () => {
  const r = await extraerDePdf(
    PDF_DISCO,
    clienteQueDevuelve({
      bloques: [plano("header", { tituloEs: "Disco", imagenRef: "imagen1" })],
      omitido: [],
    }),
  );
  const header = r.bloques.find((b) => b.tipo === "header");
  return r.imagenesUsadas === 0 &&
         header?.tipo === "header" && header.fotoAssetId === undefined;
});

chk("una extracción válida devuelve bloques, omitido y el conteo de descartados", async () => {
  const r = await extraerDePdf(
    PDF_MINIMO,
    clienteQueDevuelve({
      bloques: [
        plano("header", { tituloEs: "Disco" }),
        plano("chips", { etiqueta: "Se cae", lineas: [] }),
      ],
      omitido: ["  iconos de seguridad  ", ""],
    }),
  );
  return r.bloques.length === 1 && r.descartados === 1 &&
         r.omitido.length === 1 && r.omitido[0] === "iconos de seguridad";
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
