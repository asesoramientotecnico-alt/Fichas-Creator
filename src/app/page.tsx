import Link from "next/link";
import Cabecera from "@/components/Cabecera";
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
  searchParams: Promise<{ anuladas?: string }>;
}) {
  const { anuladas } = await searchParams;
  const verAnuladas = anuladas === "1";

  const supabase = await crearClienteServidor();
  // Las anuladas se ocultan por omisión: son el borrado lógico de una ficha
  // creada por error, no algo que la Oficina Técnica necesite ver a diario.
  const consulta = supabase
    .from("ficha")
    .select("id, estado, version, anio, created_at, producto(sku, nombre_es)")
    .order("created_at", { ascending: false });

  const { data, error } = await (verAnuladas
    ? consulta.eq("estado", "anulada")
    : consulta.in("estado", ESTADOS_VISIBLES as unknown as string[])
  ).overrideTypes<FilaFicha[]>();

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

        {error ? <p className="error">No pudimos cargar las fichas: {error.message}</p> : null}

        {!error && (!data || data.length === 0) ? (
          <p className="vacio">
            {verAnuladas
              ? "No hay fichas anuladas."
              : "Todavía no hay fichas. Creá un producto y después su ficha."}
          </p>
        ) : null}

        {data && data.length > 0 ? (
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
        ) : null}
      </main>
    </div>
  );
}
