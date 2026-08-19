/**
 * Tipos del dominio. Espejan el schema de supabase/migrations/.
 * Los tipos de bloque salen de CLAUDE.md §4 y no se agregan ad hoc:
 * sumar uno es decisión de producto, con componente, estilo y entrada
 * en la tabla de §4.
 */

export type FichaEstado =
  | "borrador"
  | "en_revision"
  | "aprobada"
  | "publicada"
  /**
   * Borrado lógico. ficha_revision es append-only y su trigger bloquea el
   * DELETE, así que borrar una ficha con revisiones cascadearía al trigger y
   * fallaría. Anular la saca de los listados y conserva el historial, que es
   * lo que pide el requisito 2 de §1.
   */
  | "anulada";
export type SugerenciaEstado = "pendiente" | "aceptada" | "rechazada";
export type SugerenciaSeveridad = "error" | "inconsistencia" | "mejora";
export type AssetTipo = "foto" | "croquis";

/** Sólo `aprobada` y `publicada` exportan PDF sin marca de agua (§5 inv. 4). */
export const ESTADOS_SIN_MARCA_DE_AGUA: readonly FichaEstado[] = [
  "aprobada",
  "publicada",
];

export const ETIQUETA_ESTADO: Record<FichaEstado, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  publicada: "Publicada",
  anulada: "Anulada",
};

/** Las anuladas no se listan salvo que se pidan explícitamente. */
export const ESTADOS_VISIBLES: readonly FichaEstado[] = [
  "borrador",
  "en_revision",
  "aprobada",
  "publicada",
];

// ------------------------------------------------------------
// Bloques (§4)
// ------------------------------------------------------------

export type TipoBloque =
  | "header"
  | "tabla-kv"
  | "par-texto"
  | "tabla"
  | "inline-kv"
  | "texto-rico"
  | "chips"
  | "croquis"
  | "tabla-dim"
  | "barra-destacada"
  | "chart"
  | "imagen"
  | "lista-componentes"
  | "tabla-ancha"
  | "codigos";

/**
 * Ancho de un bloque sobre la grilla de la hoja, que tiene 12 pistas.
 * Son las cuatro fracciones que usa la plantilla; no es un número libre,
 * porque un ancho arbitrario rompería la alineación de columnas entre
 * bloques vecinos.
 */
export type AnchoBloque = "medio" | "completo" | "dos-tercios" | "un-tercio";

/** Pistas que ocupa cada ancho sobre las 12 de la grilla. */
export const PISTAS_POR_ANCHO: Record<AnchoBloque, number> = {
  "un-tercio": 4,
  medio: 6,
  "dos-tercios": 8,
  completo: 12,
};

export const PISTAS_GRILLA = 12;

interface BloqueBase {
  id: string;
  tipo: TipoBloque;
  ancho?: AnchoBloque;
  /**
   * Filas de la grilla que ocupa el bloque. Con `filasGrilla: 2` los dos bloques
   * que lo siguen se apilan en las pistas que sobran a su costado, en vez de
   * arrancar una fila nueva: es lo que necesita un croquis alto con dos
   * secciones angostas al lado.
   */
  filasGrilla?: number;
  /**
   * Título de la hoja interior que abre este bloque, si le toca abrirla.
   * El paginado decide qué bloque cae en qué hoja, así que el título no se
   * puede declarar por hoja: se declara en el bloque y la hoja lo toma del
   * primero que lo traiga. Un reparto distinto mueve el título con su bloque.
   */
  tituloHoja?: string;
}

export interface BloqueHeader extends BloqueBase {
  tipo: "header";
  familia: string;
  subfamilia: string;
  tituloEs: string;
  subtituloEn?: string;
  fotoAssetId?: string;
  /**
   * Píldora de unidad de negocio que va arriba a la derecha en la primera
   * hoja. Es un asset raster provisto por diseño, no un componente: lleva
   * icono propio y una variante de color por unidad.
   */
  pildoraAssetId?: string;
  pildoraAlt?: string;
}

export interface BloqueTablaKv extends BloqueBase {
  tipo: "tabla-kv";
  etiqueta: string;
  /** Texto chico a la derecha del rótulo. Ej. un rango de medidas. */
  sufijo?: string;
  /**
   * `horizontal` (por omisión) pone el rótulo a la izquierda del valor.
   * `vertical` lo pone arriba: es la disposición que necesita una columna
   * angosta, donde el rótulo no entra al lado del valor.
   */
  orientacion?: "horizontal" | "vertical";
  filas: { label: string; value: string }[];
}

export interface BloqueParTexto extends BloqueBase {
  tipo: "par-texto";
  izquierda: { etiqueta: string; texto: string };
  derecha: { etiqueta: string; texto: string };
}

export interface BloqueTabla extends BloqueBase {
  tipo: "tabla";
  etiqueta: string;
  sufijo?: string;
  columnas: { titulo: string; alineacion?: "izquierda" | "derecha" }[];
  filas: string[][];
}

export interface BloqueInlineKv extends BloqueBase {
  tipo: "inline-kv";
  etiqueta: string;
  valor: string;
}

export interface BloqueTextoRico extends BloqueBase {
  tipo: "texto-rico";
  etiqueta: string;
  /** Párrafos. Sólo negrita e itálica (§4). */
  parrafos: string[];
}

export interface BloqueChips extends BloqueBase {
  tipo: "chips";
  etiqueta: string;
  items: string[];
}

export interface BloqueCroquis extends BloqueBase {
  tipo: "croquis";
  assetId?: string;
  cotas: { simbolo: string; nombre: string }[];
}

export interface BloqueTablaDim extends BloqueBase {
  tipo: "tabla-dim";
  tablas: {
    etiqueta: string;
    unidad: string;
    columnas: string[];
    filas: string[][];
  }[];
}

export interface BloqueBarraDestacada extends BloqueBase {
  tipo: "barra-destacada";
  etiqueta: string;
  valor: string;
}

export interface BloqueChart extends BloqueBase {
  tipo: "chart";
  etiqueta: string;
  /** Máximo 4 series: la paleta validada tiene ese tope y no se cicla. */
  series: { nombre: string; puntos: { x: number; y: number }[] }[];
  etiquetaX?: string;
  etiquetaY?: string;
}

export interface BloqueImagen extends BloqueBase {
  tipo: "imagen";
  /**
   * Sin rótulo la imagen va sola, sin regla. Es lo que corresponde cuando el
   * título de la hoja ya la nombra: un rótulo redundante sumaría una regla
   * que no separa nada.
   */
  etiqueta?: string;
  sufijo?: string;
  assetId?: string;
  /** Descripción para lectores de pantalla. No es una leyenda visible. */
  alt: string;
  /** Marco de 1px sobre fondo claro. El despiece lo lleva; un gráfico no. */
  marco?: boolean;
}

/**
 * Lista de componentes de un despiece. Las cuatro columnas son fijas —ítem,
 * componente, material, cantidad— y eso es justamente lo que la distingue de
 * `tabla`: el número de ítem remite al croquis, así que no puede faltar ni
 * cambiar de lugar. Los títulos se pueden traducir; la forma, no.
 */
export interface BloqueListaComponentes extends BloqueBase {
  tipo: "lista-componentes";
  etiqueta: string;
  sufijo?: string;
  columnas: { item: string; componente: string; material: string; cantidad: string };
  items: { n: string; componente: string; material: string; cantidad: string }[];
}

/**
 * Tabla de cotas a ancho completo. Se diferencia de `tabla` en la banda de
 * encabezado y en la nota al pie, que es obligatoria: sin ella, columnas como
 * `Ød` o `□C` no se entienden, y una ficha que va a cliente no puede
 * depender de que el lector adivine.
 */
export interface BloqueTablaAncha extends BloqueBase {
  tipo: "tabla-ancha";
  etiqueta: string;
  sufijo?: string;
  columnas: { titulo: string; alineacion?: "izquierda" | "derecha" }[];
  filas: string[][];
  nota: string;
}

/** Pares código → medida en dos columnas, con imagen y nota opcionales. */
export interface BloqueCodigos extends BloqueBase {
  tipo: "codigos";
  etiqueta: string;
  sufijo?: string;
  pares: { codigo: string; medida: string }[];
  assetId?: string;
  alt?: string;
  nota?: string;
}

export type Bloque =
  | BloqueHeader
  | BloqueTablaKv
  | BloqueParTexto
  | BloqueTabla
  | BloqueInlineKv
  | BloqueTextoRico
  | BloqueChips
  | BloqueCroquis
  | BloqueTablaDim
  | BloqueBarraDestacada
  | BloqueChart
  | BloqueImagen
  | BloqueListaComponentes
  | BloqueTablaAncha
  | BloqueCodigos;

// ------------------------------------------------------------
// Filas de tablas
// ------------------------------------------------------------

export interface Familia {
  id: string;
  nombre: string;
  plantilla_bloques: Bloque[];
  created_at: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre_es: string;
  nombre_en: string | null;
  categoria: string | null;
  subcategoria: string | null;
  familia_id: string | null;
  created_at: string;
}

export interface Ficha {
  id: string;
  producto_id: string;
  estado: FichaEstado;
  version: string;
  anio: number;
  revision_actual_id: string | null;
  created_at: string;
}

export interface FichaRevision {
  id: string;
  ficha_id: string;
  n: number;
  bloques: Bloque[];
  autor_id: string;
  comentario: string | null;
  created_at: string;
}

export interface Norma {
  id: string;
  codigo: string;
  edicion_anio: number;
  created_at: string;
}

export interface Asset {
  id: string;
  tipo: AssetTipo;
  storage_path: string;
  familia_id: string | null;
  alt: string | null;
  created_at: string;
}

export interface SugerenciaIa {
  id: string;
  revision_id: string;
  bloque_id: string;
  campo: string;
  texto_original: string | null;
  texto_propuesto: string | null;
  motivo: string;
  severidad: SugerenciaSeveridad;
  estado: SugerenciaEstado;
  decidido_por: string | null;
  decidido_at: string | null;
  created_at: string;
}

/** Tipos de bloque válidos de §4. Fuente única para validar lo que llega de la base. */
export const TIPOS_BLOQUE: readonly TipoBloque[] = [
  "header", "tabla-kv", "par-texto", "tabla", "inline-kv",
  "texto-rico", "chips", "croquis", "tabla-dim", "barra-destacada", "chart",
  "imagen", "lista-componentes", "tabla-ancha", "codigos",
];

/**
 * `ficha_revision.bloques` es jsonb: la base no garantiza su forma. Se filtra
 * lo que no tenga id y un tipo de §4, en vez de confiar en un cast, para que
 * un bloque corrupto no rompa el render de toda la ficha.
 */
export function comoBloques(valor: unknown): Bloque[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((b): b is Bloque => {
    if (typeof b !== "object" || b === null) return false;
    const o = b as Record<string, unknown>;
    return typeof o.id === "string" && TIPOS_BLOQUE.includes(o.tipo as TipoBloque);
  });
}
