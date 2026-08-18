import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { ETIQUETA_ESTADO, ESTADOS_SIN_MARCA_DE_AGUA, type FichaEstado } from "@/lib/tipos";

interface FichaDetalle {
  id: string;
  estado: FichaEstado;
  version: string;
  anio: number;
  created_at: string;
  producto: { sku: string; nombre_es: string; nombre_en: string | null } | null;
}

export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: ficha } = await supabase
    .from("ficha")
    .select("id, estado, version, anio, created_at, producto(sku, nombre_es, nombre_en)")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<FichaDetalle>();

  if (!ficha) notFound();

  const { data: revisiones } = await supabase
    .from("ficha_revision")
    .select("id, n, comentario, created_at, autor_id")
    .eq("ficha_id", id)
    .order("n", { ascending: false })
    .overrideTypes<
      { id: string; n: number; comentario: string | null; created_at: string; autor_id: string }[]
    >();

  const llevaMarcaDeAgua = !ESTADOS_SIN_MARCA_DE_AGUA.includes(ficha.estado);

  return (
    <div className="app-shell">
      <Cabecera />
      <main className="app-main">
        <p className="eyebrow">{ficha.producto?.sku ?? "Ficha"}</p>

        <div className="barra-acciones">
          <div>
            <h1 className="titulo-pagina" style={{ margin: "var(--space-2) 0 0" }}>
              {ficha.producto?.nombre_es ?? "(sin producto)"}
            </h1>
            {ficha.producto?.nombre_en ? (
              <p
                style={{
                  margin: "var(--space-1) 0 0",
                  fontWeight: 300,
                  fontStyle: "italic",
                  color: "var(--fg-2)",
                }}
              >
                {ficha.producto.nombre_en}
              </p>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span className="estado" data-estado={ficha.estado}>
              {ETIQUETA_ESTADO[ficha.estado]}
            </span>
            <span style={{ color: "var(--fg-3)" }}>
              Versión {ficha.version} · {ficha.anio}
            </span>
          </div>
        </div>

        {llevaMarcaDeAgua ? (
          <p className="error" style={{ borderLeftColor: "var(--famiq-orange)" }}>
            El PDF de esta ficha sale con marca de agua BORRADOR: sólo los estados
            «Aprobada» y «Publicada» exportan sin marca (§5).
          </p>
        ) : null}

        <h2
          className="eyebrow"
          style={{ color: "var(--fg-3)", marginTop: "var(--space-6)" }}
        >
          Historial de revisiones
        </h2>

        <table className="tabla" style={{ marginTop: "var(--space-3)" }}>
          <thead>
            <tr>
              <th style={{ width: "4rem" }}>Rev.</th>
              <th>Comentario</th>
              <th style={{ width: "12rem" }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(revisiones ?? []).map((r) => (
              <tr key={r.id}>
                <td style={{ fontFamily: "var(--font-condensed)", fontWeight: 700 }}>{r.n}</td>
                <td>{r.comentario ?? "—"}</td>
                <td style={{ color: "var(--fg-3)" }}>
                  {new Date(r.created_at).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: "var(--space-6)" }}>
          <Link href="/">← Volver a fichas</Link>
        </p>
      </main>
    </div>
  );
}
