import type { Bloque, TipoBloque } from "@/lib/tipos";

/**
 * Plantillas vacías por tipo. El usuario elige entre los tipos que existen
 * en §4 — no puede inventar uno — y cada uno nace con su forma correcta.
 */

export const TIPOS_DISPONIBLES: { tipo: TipoBloque; nombre: string; descripcion: string }[] = [
  { tipo: "header", nombre: "Cabecera", descripcion: "Título, subtítulo en inglés y foto. Uno por ficha, siempre primero." },
  { tipo: "tabla-kv", nombre: "Tabla etiqueta → valor", descripcion: "Ej. Normas aplicables." },
  { tipo: "par-texto", nombre: "Par de textos", descripcion: "Dos textos a dos columnas, cada uno con su etiqueta." },
  { tipo: "tabla", nombre: "Tabla", descripcion: "Encabezados y N columnas. Ej. Propiedades mecánicas." },
  { tipo: "inline-kv", nombre: "Etiqueta y valor en línea", descripcion: "Ej. Materiales disponibles." },
  { tipo: "texto-rico", nombre: "Párrafos", descripcion: "Ej. Descripción." },
  { tipo: "chips", nombre: "Etiquetas cortas", descripcion: "Ej. Aplicaciones típicas." },
  { tipo: "croquis", nombre: "Croquis", descripcion: "Imagen más leyenda de cotas." },
  { tipo: "tabla-dim", nombre: "Tablas dimensionales", descripcion: "Una o dos tablas con su unidad." },
  { tipo: "barra-destacada", nombre: "Barra destacada", descripcion: "Etiqueta y valor sobre banda gris. Va al pie de la hoja." },
  { tipo: "chart", nombre: "Gráfico", descripcion: "Curvas desde una tabla de datos. Hasta 4 series. Se dibuja en el servidor, sin IA." },
  { tipo: "imagen", nombre: "Imagen", descripcion: "Imagen con rótulo. Ej. un despiece o una curva de presión / temperatura." },
  { tipo: "lista-componentes", nombre: "Lista de componentes", descripcion: "Ítem numerado → componente → material → cantidad. Se reparte en dos columnas." },
  { tipo: "tabla-ancha", nombre: "Tabla de cotas", descripcion: "Tabla a ancho completo con banda oscura y nota que define los símbolos." },
  { tipo: "codigos", nombre: "Códigos", descripcion: "Pares código → medida en dos columnas, con imagen y nota. Ej. un kit de repuestos." },
];

let contador = 0;

/** Id estable dentro de la sesión de edición. El diff empareja por id. */
export function nuevoId(tipo: TipoBloque): string {
  contador += 1;
  return `${tipo}-${Date.now().toString(36)}-${contador}`;
}

export function bloqueVacio(tipo: TipoBloque): Bloque {
  const id = nuevoId(tipo);
  switch (tipo) {
    case "header":
      return { id, tipo, ancho: "completo", familia: "", subfamilia: "", tituloEs: "", subtituloEn: "" };
    case "tabla-kv":
      return { id, tipo, ancho: "completo", etiqueta: "Nueva sección", filas: [{ label: "", value: "" }] };
    case "par-texto":
      return {
        id, tipo, ancho: "completo",
        izquierda: { etiqueta: "", texto: "" },
        derecha: { etiqueta: "", texto: "" },
      };
    case "tabla":
      return {
        id, tipo, ancho: "completo", etiqueta: "Nueva tabla",
        columnas: [{ titulo: "" }, { titulo: "" }],
        filas: [["", ""]],
      };
    case "inline-kv":
      return { id, tipo, ancho: "completo", etiqueta: "", valor: "" };
    case "texto-rico":
      return { id, tipo, ancho: "medio", etiqueta: "Nueva sección", parrafos: [""] };
    case "chips":
      return { id, tipo, ancho: "medio", etiqueta: "Nueva sección", items: [""] };
    case "croquis":
      return { id, tipo, ancho: "completo", cotas: [{ simbolo: "", nombre: "" }] };
    case "tabla-dim":
      return {
        id, tipo, ancho: "completo",
        tablas: [{ etiqueta: "Dimensiones", unidad: "mm", columnas: ["", "", ""], filas: [["", "", ""]] }],
      };
    case "barra-destacada":
      return { id, tipo, ancho: "completo", etiqueta: "", valor: "" };
    case "chart":
      return {
        id, tipo, ancho: "completo", etiqueta: "Nuevo gráfico",
        series: [{ nombre: "Serie 1", puntos: [{ x: 0, y: 0 }] }],
        etiquetaX: "", etiquetaY: "",
      };
    case "imagen":
      return { id, tipo, ancho: "medio", etiqueta: "Nueva imagen", alt: "", marco: false };
    case "lista-componentes":
      return {
        id, tipo, ancho: "completo", etiqueta: "Lista de componentes",
        columnas: { item: "Ítem", componente: "Componente", material: "Material", cantidad: "Cant." },
        items: [{ n: "1", componente: "", material: "", cantidad: "" }],
      };
    case "tabla-ancha":
      return {
        id, tipo, ancho: "completo", etiqueta: "Dimensiones y códigos",
        columnas: [{ titulo: "" }, { titulo: "" }, { titulo: "", alineacion: "derecha" }],
        filas: [["", "", ""]],
        nota: "",
      };
    case "codigos":
      return {
        id, tipo, ancho: "completo", etiqueta: "Repuestos",
        pares: [{ codigo: "", medida: "" }],
        alt: "", nota: "",
      };
  }
}
