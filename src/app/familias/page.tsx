import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { comoBloques } from "@/lib/tipos";

export default async function FamiliasPage() {
  const supabase = await crearClienteServidor();

  const { data: familias, error } = await supabase
    .from("familia")
    .select("id, nombre, plantilla_bloques, created_at, asset(count)")
    .order("nombre")
    .overrideTypes<
      { id: string; nombre: string; plantilla_bloques: unknown; created_at: string; asset: { count: number }[] }[]
    >();

  return (
    <div className="app-shell">
      <Cabecera />
      <main className="app-main">
        <h1 className="titulo-pagina">Familias</h1>
        <p style={{ color: "var(--fg-2)", marginTop: "calc(-1 * var(--space-3))" }}>
          Una familia guarda la estructura de la ficha —sus bloques, sus etiquetas, sus cotas— sin
          los datos, más su librería de croquis y fotos.
        </p>

        {error ? <p className="error">No pudimos cargar las familias: {error.message}</p> : null}

        {!error && (!familias || familias.length === 0) ? (
          <p className="vacio">
            Todavía no hay familias. Se crean desde una ficha ya armada, con «Guardar como
            plantilla de familia».
          </p>
        ) : null}

        {familias && familias.length > 0 ? (
          <table className="tabla">
            <thead>
              <tr>
                <th>Familia</th>
                <th style={{ width: "8rem" }}>Bloques</th>
                <th style={{ width: "8rem" }}>Assets</th>
              </tr>
            </thead>
            <tbody>
              {familias.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/familias/${f.id}`}>{f.nombre}</Link>
                  </td>
                  <td>{comoBloques(f.plantilla_bloques).length}</td>
                  <td>{f.asset?.[0]?.count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </main>
    </div>
  );
}
