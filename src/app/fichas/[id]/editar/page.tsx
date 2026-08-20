import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import Editor from "@/components/editor/Editor";
import { NOTA_AL_PIE } from "@/components/ficha/FichaVista";
import { datosDeCabecera } from "@/lib/ficha-textos";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { comoBloques, type FichaEstado } from "@/lib/tipos";
import { assetsDeFamilia } from "@/app/acciones-assets";

export default async function EditarFichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: ficha } = await supabase
    .from("ficha")
    .select("id, estado, version, anio, producto(sku, nombre_es, familia_id)")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<{
      id: string;
      estado: FichaEstado;
      version: string;
      anio: number;
      producto: {
        sku: string;
        nombre_es: string;
            familia_id: string | null;
      } | null;
    }>();

  if (!ficha) notFound();

  const { data: revision } = await supabase
    .from("ficha_revision")
    .select("id, n, bloques")
    .eq("ficha_id", id)
    .order("n", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<{ id: string; n: number; bloques: unknown }>();

  // Los bloques con imagen se eligen de la librería de la familia (§7).
  const assets = await assetsDeFamilia(ficha.producto?.familia_id ?? null);
  // Punto de partida antes de editar: familia y píldora salen del bloque
  // header guardado. El Editor las vuelve a derivar en vivo mientras se edita.
  const bloquesIniciales = comoBloques(revision?.bloques);
  const cabecera = datosDeCabecera(bloquesIniciales, assets.mapa);

  return (
    <div className="app-shell">
      <Cabecera />
      <main className="app-main" style={{ maxWidth: "none" }}>
        <div className="barra-acciones">
          <div>
            <p className="eyebrow">{ficha.producto?.sku ?? "Ficha"}</p>
            <h1 className="titulo-pagina" style={{ margin: "var(--space-2) 0 0" }}>
              Editar · {ficha.producto?.nombre_es ?? "ficha"}
            </h1>
            <p style={{ color: "var(--fg-3)", margin: "var(--space-1) 0 0" }}>
              Partiendo de la revisión {revision?.n ?? 0}
            </p>
          </div>
          <Link className="boton" data-variante="secundario" href={`/fichas/${id}`}>
            Volver sin guardar
          </Link>
        </div>

        <Editor
          fichaId={id}
          bloquesIniciales={bloquesIniciales}
          datosFicha={{
            familia: cabecera.familia,
            pildoraSrc: cabecera.pildoraSrc,
            pildoraAlt: cabecera.pildoraAlt,
            version: ficha.version,
            revision: (revision?.n ?? 0) + 1,
            anio: ficha.anio,
            estado: ficha.estado,
            nota: NOTA_AL_PIE,
          }}
          producto={ficha.producto?.nombre_es ?? ""}
          assets={assets.mapa}
          assetsDisponibles={assets.lista}
        />
      </main>
    </div>
  );
}
