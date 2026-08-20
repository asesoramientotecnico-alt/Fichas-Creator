import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import FiltrosLista from "@/components/FiltrosLista";
import Paginado, { POR_PAGINA, paginaDe, rangoDe } from "@/components/Paginado";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { ETIQUETA_ESTADO, ESTADOS_VISIBLES, type FichaEstado } from "@/lib/tipos";

interface FilaFicha {
  id: string;
  estado: FichaEstado;
  version: string;
  anio: number;
  created_at: string;
  producto: { sku: string; nombre_es: string } | null;
}

export default async function FichasPage({
  searchParams,
}: {
  searchParams: Promise<{ anuladas?: string; q?: string; estado?: string; pag?: string }>;
}) {
  const { anuladas, q, estado, pag } = await searchParams;
  const verAnuladas = anuladas === "1";
  const buscado = (q ?? "").trim();
  const pagina = paginaDe(pag);
  const [desde, hasta] = rangoDe(pagina);

  const supabase = await crearClienteServidor();
  // Las anuladas se ocultan por omisión: son el borrado lógico de una ficha
  // creada por error, no algo que la Oficina Técnica necesite ver a diario.
  //
  // El join a producto es `!inner` cuando hay búsqueda, porque se filtra por
  // sus columnas: con el join normal, una ficha sin producto pasaría el filtro.
  let consulta = supabase
    .from("ficha")
    .select(
      `id, estado, version, anio, created_at, producto${buscado ? "!inner" : ""}(sku, nombre_es)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(desde, hasta);

  consulta = verAnuladas
    ? consulta.eq("estado", "anulada")
    : estado && (ESTADOS_VISIBLES as readonly string[]).includes(estado)
      ? consulta.eq("estado", estado)
      : consulta.in("estado", ESTADOS_VISIBLES as unknown as string[]);

  if (buscado) {
    // El patrón se escapa: un `%` escrito en el buscador tiene que buscarse
    // como carácter, no comportarse como comodín.
    const patron = buscado.replace(/[%_,()]/g, "");
    if (patron) {
      consulta = consulta.or(`sku.ilike.%${patron}%,nombre_es.ilike.%${patron}%`, {
        referencedTable: "producto",
      });
    }
  }

  const { data, error, count } = await consulta.overrideTypes<FilaFicha[]>();
  const total = count ?? 0;

  return (
    <div className="app-shell">
      <Cabecera />
      <main className="app-main">
        <div className="barra-acciones">
          <h1 className="titulo-pagina" style={{ margin: 0 }}>
            {verAnuladas ? "Fichas anuladas" : "Fichas"}
          </h1>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Link
              className="boton"
              data-variante="secundario"
              href={verAnuladas ? "/" : "/?anuladas=1"}
            >
              {verAnuladas ? "Ver activas" : "Ver anuladas"}
            </Link>
            <Link className="boton" href="/fichas/nueva">
              Nueva ficha
            </Link>
          </div>
        </div>

        <FiltrosLista
          marcador="SKU o nombre del producto"
          filtros={
            verAnuladas
              ? []
              : [
                  {
                    clave: "estado",
                    etiqueta: "Estado",
                    opciones: ESTADOS_VISIBLES.map((e) => ({
                      valor: e,
                      nombre: ETIQUETA_ESTADO[e],
                    })),
                  },
                ]
          }
        />

        {error ? <p className="error">No pudimos cargar las fichas: {error.message}</p> : null}

        {!error && total === 0 ? (
          <p className="vacio">
            {buscado || estado
              ? "Ninguna ficha coincide con la búsqueda."
              : verAnuladas
                ? "No hay fichas anuladas."
                : "Todavía no hay fichas. Creá un producto y después su ficha."}
          </p>
        ) : null}

        {data && data.length > 0 ? (
          <>
            <table className="tabla">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Creada</th>
                </tr>
              </thead>
              <tbody>
                {data.map((ficha) => (
                  <tr key={ficha.id}>
                    <td>{ficha.producto?.sku ?? "—"}</td>
                    <td>
                      <Link href={`/fichas/${ficha.id}`}>
                        {ficha.producto?.nombre_es ?? "(sin producto)"}
                      </Link>
                    </td>
                    <td>
                      {ficha.version} · {ficha.anio}
                    </td>
                    <td>
                      <span className="estado" data-estado={ficha.estado}>
                        {ETIQUETA_ESTADO[ficha.estado]}
                      </span>
                    </td>
                    <td>{new Date(ficha.created_at).toLocaleDateString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginado
              pagina={pagina}
              total={total}
              porPagina={POR_PAGINA}
              ruta="/"
              params={{ anuladas, q, estado }}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
