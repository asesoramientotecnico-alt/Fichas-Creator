import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import ControlEstado from "./ControlEstado";
import PanelHallazgos, { type Sugerencia } from "./PanelHallazgos";
import GuardarPlantilla from "./GuardarPlantilla";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { estadosPosibles } from "@/app/acciones-ficha";
import { ESTADOS_SIN_MARCA_DE_AGUA, comoBloques, type FichaEstado } from "@/lib/tipos";
import FichaPaginada from "@/components/ficha/FichaPaginada";

interface FichaDetalle {
  id: string;
  estado: FichaEstado;
  version: string;
  anio: number;
  created_at: string;
  producto: { sku: string; nombre_es: string; nombre_en: string | null } | null;
}

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
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
    .select("id, n, comentario, created_at, autor_id, bloques")
    .eq("ficha_id", id)
    .order("n", { ascending: false })
    .overrideTypes<
      { id: string; n: number; comentario: string | null; created_at: string; autor_id: string; bloques: unknown }[]
    >();

  const { data: sugerencias } = await supabase
    .from("sugerencia_ia")
    .select("id, bloque_id, campo, texto_original, texto_propuesto, motivo, severidad, estado, decidido_at, revision_id")
    .eq("revision_id", revisiones?.[0]?.id ?? "00000000-0000-0000-0000-000000000000")
    .order("severidad")
    .overrideTypes<Sugerencia[]>();

  const actual = revisiones?.[0];
  const bloques = comoBloques(actual?.bloques);
  const llevaMarcaDeAgua = !ESTADOS_SIN_MARCA_DE_AGUA.includes(ficha.estado);
  const posibles = await estadosPosibles(ficha.estado);

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
              <p style={{ margin: "var(--space-1) 0 0", fontWeight: 300, fontStyle: "italic", color: "var(--fg-2)" }}>
                {ficha.producto.nombre_en}
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Link className="boton" href={`/fichas/${id}/editar`}>Editar</Link>
            {bloques.length > 0 ? (
              <a className="boton" data-variante="secundario" href={`/api/fichas/${id}/pdf`}
                 target="_blank" rel="noopener">
                Ver PDF
              </a>
            ) : null}
            {(revisiones?.length ?? 0) > 1 ? (
              <Link className="boton" data-variante="secundario" href={`/fichas/${id}/revisiones`}>
                Comparar revisiones
              </Link>
            ) : null}
          </div>
        </div>

        <ControlEstado fichaId={id} actual={ficha.estado} posibles={posibles} />

        {llevaMarcaDeAgua ? (
          <p className="error" style={{ borderLeftColor: "var(--famiq-orange)", marginTop: "var(--space-4)" }}>
            El PDF de esta ficha sale con marca de agua BORRADOR: sólo «Aprobada» y «Publicada»
            exportan sin marca (§5).
          </p>
        ) : null}

        <PanelHallazgos fichaId={id} sugerencias={sugerencias ?? []} />

        {bloques.length > 0 ? <GuardarPlantilla fichaId={id} /> : null}

        <h2 className="eyebrow" style={{ color: "var(--fg-3)", marginTop: "var(--space-6)" }}>
          Historial de revisiones
        </h2>
        <table className="tabla" style={{ marginTop: "var(--space-3)" }}>
          <thead>
            <tr>
              <th style={{ width: "4rem" }}>Rev.</th>
              <th>Comentario</th>
              <th style={{ width: "13rem" }}>Fecha</th>
              <th style={{ width: "7rem" }} />
            </tr>
          </thead>
          <tbody>
            {(revisiones ?? []).map((r, i) => (
              <tr key={r.id}>
                <td style={{ fontFamily: "var(--font-condensed)", fontWeight: 700 }}>{r.n}</td>
                <td>{r.comentario ?? "—"}</td>
                <td style={{ color: "var(--fg-3)" }}>{new Date(r.created_at).toLocaleString("es-AR")}</td>
                <td>
                  {i < (revisiones?.length ?? 0) - 1 ? (
                    <Link href={`/fichas/${id}/revisiones?a=${revisiones![i + 1].n}&b=${r.n}`}>
                      Ver cambios
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {bloques.length > 0 ? (
          <>
            <h2 className="eyebrow" style={{ color: "var(--fg-3)", marginTop: "var(--space-6)" }}>
              Vista de la revisión {actual?.n}
            </h2>
            <div style={{ background: "var(--famiq-grey-200)", padding: "8mm", marginTop: "var(--space-3)", display: "flex", justifyContent: "center", overflowX: "auto" }}>
              <FichaPaginada
                datos={{
                  catalogo: ficha.producto?.nombre_es ?? "",
                  version: ficha.version,
                  anio: ficha.anio,
                  estado: ficha.estado,
                  nota: "Datos orientativos. Confirmar disponibilidad con equipo técnico · famiq.com.ar",
                }}
                bloques={bloques}
                tituloInterior="Tabla de cotas y dimensiones"
                antetitulo={ficha.producto?.nombre_es ?? ""}
                assets={{ producto: "/ficha/producto.png", croquis: "/ficha/croquis.png" }}
              />
            </div>
          </>
        ) : (
          <p className="vacio" style={{ marginTop: "var(--space-6)" }}>
            Esta ficha todavía no tiene bloques. <Link href={`/fichas/${id}/editar`}>Empezá a cargarla</Link>.
          </p>
        )}
      </main>
    </div>
  );
}
