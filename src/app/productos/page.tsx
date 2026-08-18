import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import type { Producto } from "@/lib/tipos";

export default async function ProductosPage() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("producto")
    .select("id, sku, nombre_es, nombre_en, categoria, subcategoria, familia_id, created_at")
    .order("created_at", { ascending: false })
    .overrideTypes<Producto[]>();

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

        {error ? <p className="error">No pudimos cargar los productos: {error.message}</p> : null}

        {!error && (!data || data.length === 0) ? (
          <p className="vacio">Todavía no hay productos cargados.</p>
        ) : null}

        {data && data.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Nombre EN</th>
                <th>Categoría</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </main>
    </div>
  );
}
