import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import FiltrosLista from "@/components/FiltrosLista";
import Paginado, { POR_PAGINA, paginaDe, rangoDe } from "@/components/Paginado";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import type { Producto } from "@/lib/tipos";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; familia?: string; pag?: string }>;
}) {
  const { q, familia, pag } = await searchParams;
  const buscado = (q ?? "").trim();
  const pagina = paginaDe(pag);
  const [desde, hasta] = rangoDe(pagina);

  const supabase = await crearClienteServidor();

  // Las familias son pocas y sirven de filtro: se traen enteras.
  const { data: familias } = await supabase
    .from("familia")
    .select("id, nombre")
    .order("nombre")
    .overrideTypes<{ id: string; nombre: string }[]>();

  let consulta = supabase
    .from("producto")
    .select(
      "id, sku, nombre_es, nombre_en, categoria, subcategoria, familia_id, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(desde, hasta);

  if (familia === "sin") consulta = consulta.is("familia_id", null);
  else if (familia) consulta = consulta.eq("familia_id", familia);

  if (buscado) {
    const patron = buscado.replace(/[%_,()]/g, "");
    if (patron) {
      consulta = consulta.or(`sku.ilike.%${patron}%,nombre_es.ilike.%${patron}%`);
    }
  }

  const { data, error, count } = await consulta.overrideTypes<Producto[]>();
  const total = count ?? 0;
  const nombreFamilia = new Map((familias ?? []).map((f) => [f.id, f.nombre]));

  return (
    <div className="app-shell">
      <Cabecera />
      <main className="app-main">
        <div className="barra-acciones">
          <h1 className="titulo-pagina" style={{ margin: 0 }}>
            Productos
          </h1>
          <Link className="boton" href="/productos/nuevo">
            Nuevo producto
          </Link>
        </div>

        <FiltrosLista
          marcador="SKU o nombre"
          filtros={[
            {
              clave: "familia",
              etiqueta: "Familia",
              opciones: [
                ...(familias ?? []).map((f) => ({ valor: f.id, nombre: f.nombre })),
                { valor: "sin", nombre: "Sin familia" },
              ],
            },
          ]}
        />

        {error ? <p className="error">No pudimos cargar los productos: {error.message}</p> : null}

        {!error && total === 0 ? (
          <p className="vacio">
            {buscado || familia
              ? "Ningún producto coincide con la búsqueda."
              : "Todavía no hay productos cargados."}
          </p>
        ) : null}

        {data && data.length > 0 ? (
          <>
            <table className="tabla">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Nombre EN</th>
                  <th>Categoría</th>
                  <th>Familia</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td>{p.nombre_es}</td>
                    <td style={{ color: "var(--fg-3)" }}>{p.nombre_en ?? "—"}</td>
                    <td>
                      {p.categoria ?? "—"}
                      {p.subcategoria ? ` · ${p.subcategoria}` : ""}
                    </td>
                    <td style={{ color: p.familia_id ? undefined : "var(--fg-3)" }}>
                      {p.familia_id ? (nombreFamilia.get(p.familia_id) ?? "—") : "sin familia"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginado
              pagina={pagina}
              total={total}
              porPagina={POR_PAGINA}
              ruta="/productos"
              params={{ q, familia }}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
