/**
 * Tipos del dominio. Espejan el schema de supabase/migrations/.
 * Los tipos de bloque salen de CLAUDE.md §4 y no se agregan ad hoc:
 * sumar uno es decisión de producto, con componente, estilo y entrada
 * en la tabla de §4.
 */

export type FichaEstado = "borrador" | "en_revision" | "aprobada" | "publicada";
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
};

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
  | "chart";

interface BloqueBase {
  id: string;
  tipo: TipoBloque;
  /** Un bloque ocupa media grilla o el ancho completo de la hoja. */
  ancho?: "medio" | "completo";
}

export interface BloqueHeader extends BloqueBase {
  tipo: "header";
  familia: string;
  subfamilia: string;
  tituloEs: string;
  subtituloEn?: string;
  fotoAssetId?: string;
}

export interface BloqueTablaKv extends BloqueBase {
  tipo: "tabla-kv";
  etiqueta: string;
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
  | BloqueChart;

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
