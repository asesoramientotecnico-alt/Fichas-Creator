import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { urlDeAsset } from "@/app/acciones-assets";
import { comoBloques, type AssetTipo } from "@/lib/tipos";
import SubirAsset from "./SubirAsset";
import Librería from "./Libreria";

interface FilaAsset {
  id: string;
  tipo: AssetTipo;
  storage_path: string;
  alt: string | null;
  created_at: string;
}

export default async function FamiliaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: familia } = await supabase
    .from("familia")
    .select("id, nombre, plantilla_bloques")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<{ id: string; nombre: string; plantilla_bloques: unknown }>();

  if (!familia) notFound();

  const { data: assets } = await supabase
    .from("asset")
    .select("id, tipo, storage_path, alt, created_at")
    .eq("familia_id", id)
    .order("created_at", { ascending: false })
    .overrideTypes<FilaAsset[]>();

  // El bucket es privado: cada asset se muestra con una URL firmada.
  const conUrl = await Promise.all(
    (assets ?? []).map(async (a) => ({ ...a, url: await urlDeAsset(a.storage_path) })),
  );

  const bloques = comoBloques(familia.plantilla_bloques);

  return (
    <div className="app-shell">
      <Cabecera />
      <main className="app-main">
        <p className="eyebrow">Familia</p>
        <div className="barra-acciones">
          <h1 className="titulo-pagina" style={{ margin: "var(--space-2) 0 0" }}>
            {familia.nombre}
          </h1>
          <Link className="boton" href={`/fichas/nueva?familia=${id}`}>
            Nueva ficha de esta familia
          </Link>
        </div>

        <h2 className="eyebrow" style={{ color: "var(--fg-3)", marginTop: "var(--space-5)" }}>
          Estructura de la plantilla
        </h2>
        {bloques.length === 0 ? (
          <p className="vacio">La plantilla no tiene bloques.</p>
        ) : (
          <table className="tabla" style={{ marginTop: "var(--space-3)" }}>
            <thead>
              <tr>
                <th style={{ width: "3rem" }}>#</th>
                <th>Tipo</th>
                <th>Etiqueta</th>
              </tr>
            </thead>
            <tbody>
              {bloques.map((b, i) => (
                <tr key={b.id}>
                  <td style={{ color: "var(--fg-3)" }}>{i + 1}</td>
                  <td style={{ fontFamily: "var(--font-condensed)" }}>{b.tipo}</td>
                  <td>{"etiqueta" in b ? b.etiqueta : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 className="eyebrow" style={{ color: "var(--fg-3)", marginTop: "var(--space-6)" }}>
          Librería de croquis y fotos
        </h2>
        <p style={{ color: "var(--fg-2)", fontSize: "var(--fs-micro)" }}>
          El croquis se sube una vez y lo reusan todas las fichas de la familia, cada una con su
          leyenda de cotas. Los croquis no se generan con IA (§7).
        </p>

        <SubirAsset familiaId={id} />
        <Librería assets={conUrl} />
      </main>
    </div>
  );
}
