/**
 * Unidades de negocio de FAMIQ: la píldora de color que va arriba a la
 * derecha en la primera hoja, junto al logo.
 *
 * Es un catálogo FIJO y compartido, distinto de la librería de assets por
 * familia (§7, `familia.plantilla_bloques` / tabla `asset`): cualquier
 * familia de cualquier categoría puede pertenecer a la misma unidad de
 * negocio, así que la píldora no se sube por familia — se elige de esta
 * lista corta al cargar la ficha, igual que se elige un tipo de bloque.
 *
 * El id de cada unidad es el `pildoraAssetId` que guarda `BloqueHeader`.
 */

export interface UnidadNegocio {
  id: string;
  nombre: string;
  archivo: string;
}

export const UNIDADES_NEGOCIO: UnidadNegocio[] = [
  {
    id: "arquitectura-construccion",
    nombre: "Arquitectura & Construcción",
    archivo: "/ficha/unidades-negocio/arquitectura-construccion.svg",
  },
  {
    id: "consumibles-industriales",
    nombre: "Consumibles Industriales",
    archivo: "/ficha/unidades-negocio/consumibles-industriales.svg",
  },
  {
    id: "ferreteria-afines",
    nombre: "Ferretería & Afines",
    archivo: "/ficha/unidades-negocio/ferreteria-afines.svg",
  },
  {
    id: "fluidos-industriales",
    nombre: "Conducción de Fluidos Industriales",
    archivo: "/ficha/unidades-negocio/fluidos-industriales.png",
  },
  {
    id: "fluidos-sanitarios",
    nombre: "Conducción de Fluidos Sanitarios",
    archivo: "/ficha/unidades-negocio/fluidos-sanitarios.svg",
  },
  {
    id: "materias-primas",
    nombre: "Materias Primas",
    archivo: "/ficha/unidades-negocio/materias-primas.svg",
  },
];

/** `assetId → URL`, para mezclar con los de la librería de la familia. */
export const MAPA_UNIDADES_NEGOCIO: Record<string, string> = Object.fromEntries(
  UNIDADES_NEGOCIO.map((u) => [u.id, u.archivo]),
);

export function unidadNegocio(id: string | undefined): UnidadNegocio | undefined {
  return UNIDADES_NEGOCIO.find((u) => u.id === id);
}
