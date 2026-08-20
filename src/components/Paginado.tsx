import Link from "next/link";

/**
 * Paginado de una lista. Existe porque las listas traían la tabla completa: con
 * el catálogo real de FAMIQ eso es una pared de filas y una consulta que crece
 * sin techo. El servidor pide sólo la página con `range` y acá se navega.
 */

export const POR_PAGINA = 25;

/** Número de página válido a partir del parámetro de la URL. */
export function paginaDe(valor: string | undefined): number {
  const n = Number.parseInt(valor ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Rango que le corresponde a la página, para `range` de Supabase. */
export function rangoDe(pagina: number, porPagina = POR_PAGINA): [number, number] {
  const desde = (pagina - 1) * porPagina;
  return [desde, desde + porPagina - 1];
}

export default function Paginado({
  pagina,
  total,
  porPagina = POR_PAGINA,
  params,
  ruta,
}: {
  pagina: number;
  /** Total de filas que hay, no las de esta página. */
  total: number;
  porPagina?: number;
  /** Los parámetros actuales, para conservar la búsqueda y los filtros. */
  params: Record<string, string | undefined>;
  ruta: string;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  const enlace = (n: number) => {
    const busqueda = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor) busqueda.set(clave, valor);
    }
    if (n > 1) busqueda.set("pag", String(n));
    else busqueda.delete("pag");
    const cola = busqueda.toString();
    return cola ? `${ruta}?${cola}` : ruta;
  };

  return (
    <nav className="paginado" aria-label="Paginado">
      <span className="paginado-conteo">
        {desde}–{hasta} de {total}
      </span>
      <div className="paginado-botones">
        {pagina > 1 ? (
          <Link className="boton" data-variante="secundario" href={enlace(pagina - 1)}>
            Anterior
          </Link>
        ) : (
          <span className="boton" data-variante="secundario" aria-disabled="true">
            Anterior
          </span>
        )}
        <span className="paginado-actual">
          {pagina} / {paginas}
        </span>
        {pagina < paginas ? (
          <Link className="boton" data-variante="secundario" href={enlace(pagina + 1)}>
            Siguiente
          </Link>
        ) : (
          <span className="boton" data-variante="secundario" aria-disabled="true">
            Siguiente
          </span>
        )}
      </div>
    </nav>
  );
}
