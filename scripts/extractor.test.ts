/**
 * Pruebas del extractor de PDF. No llaman al modelo: el cliente se inyecta.
 * Uso: tsx scripts/extractor.test.ts
 */
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
    etiqueta: "", sufijo: "", nota: "", alt: "", valor: "",
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
// extraerDePdf: validación de entrada y de la respuesta
// ------------------------------------------------------------

const PDF_MINIMO = new Uint8Array(Buffer.from("%PDF-1.4\n%%EOF\n"));

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
