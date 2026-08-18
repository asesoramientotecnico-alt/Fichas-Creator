import Link from "next/link";
import { notFound } from "next/navigation";
import Cabecera from "@/components/Cabecera";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { comoBloques } from "@/lib/tipos";
import { compararRevisiones, ETIQUETA_CLASE } from "@/lib/diff";
import SelectorRevisiones from "./Selector";

interface FilaRevision {
  id: string;
  n: number;
  comentario: string | null;
  created_at: string;
  autor_id: string;
  bloques: unknown;
}

export default async function RevisionesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  const { a, b } = await searchParams;
  const supabase = await crearClienteServidor();

  const { data: revisiones } = await supabase
    .from("ficha_revision")
    .select("id, n, comentario, created_at, autor_id, bloques")
    .eq("ficha_id", id)
    .order("n", { ascending: false })
    .overrideTypes<FilaRevision[]>();

  if (!revisiones || revisiones.length === 0) notFound();

  // Por defecto se comparan las dos últimas.
  const nB = Number(b) || revisiones[0].n;
  const nA = Number(a) || (revisiones[1]?.n ?? revisiones[0].n);

  const revA = revisiones.find((r) => r.n === nA);
  const revB = revisiones.find((r) => r.n === nB);

  const diff =
    revA && revB
      ? compararRevisiones(comoBloques(revA.bloques), comoBloques(revB.bloques))
      : null;

  return (
    <div className="app-shell">
      <Cabecera />
      <main className="app-main">
        <div className="barra-acciones">
          <h1 className="titulo-pagina" style={{ margin: 0 }}>
            Comparar revisiones
          </h1>
          <Link className="boton" data-variante="secundario" href={`/fichas/${id}`}>
            Volver a la ficha
          </Link>
        </div>

        <SelectorRevisiones
          fichaId={id}
          revisiones={revisiones.map((r) => ({ n: r.n, comentario: r.comentario, created_at: r.created_at }))}
          nA={nA}
          nB={nB}
        />

        {!diff ? (
          <p className="error">No encontramos alguna de las revisiones elegidas.</p>
        ) : !diff.hayCambios ? (
          <p className="vacio">
            No hay diferencias entre la revisión {nA} y la {nB}.
          </p>
        ) : (
          <>
            <p style={{ color: "var(--fg-2)" }}>
              De la revisión <strong>{nA}</strong> a la <strong>{nB}</strong>:{" "}
              {diff.altas} agregado(s), {diff.bajas} eliminado(s), {diff.modificaciones} modificado(s),{" "}
              {diff.movimientos} movido(s).
            </p>

            <div style={{ display: "grid", gap: "var(--space-4)", marginTop: "var(--space-5)" }}>
              {diff.cambios.map((c) => (
                <article key={`${c.clase}-${c.bloqueId}`} className="bloque-editor" data-clase={c.clase}>
                  <header>
                    <span className="tipo">
                      {ETIQUETA_CLASE[c.clase]} · {c.tipo}
                    </span>
                    <span style={{ color: "var(--fg-3)", fontSize: "var(--fs-micro)" }}>
                      {c.posicionAntes !== null && c.posicionDespues !== null &&
                       c.posicionAntes !== c.posicionDespues
                        ? `posición ${c.posicionAntes + 1} → ${c.posicionDespues + 1}`
                        : c.posicionDespues !== null
                          ? `posición ${c.posicionDespues + 1}`
                          : `estaba en ${(c.posicionAntes ?? 0) + 1}`}
                    </span>
                  </header>

                  {c.campos.length > 0 ? (
                    <div className="cuerpo" style={{ padding: 0 }}>
                      <table className="tabla" style={{ border: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ width: "26%" }}>Campo</th>
                            <th>Antes</th>
                            <th>Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.campos.map((f) => (
                            <tr key={f.campo}>
                              <td style={{ fontFamily: "var(--font-condensed)", color: "var(--fg-3)" }}>
                                {f.campo}
                              </td>
                              <td style={{ background: "rgba(214,39,23,.05)" }}>
                                {f.antes ?? <em style={{ color: "var(--fg-3)" }}>(vacío)</em>}
                              </td>
                              <td style={{ background: "rgba(73,177,112,.08)" }}>
                                {f.despues ?? <em style={{ color: "var(--fg-3)" }}>(vacío)</em>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
