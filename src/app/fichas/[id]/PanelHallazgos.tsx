"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirSugerencia } from "@/app/acciones-ficha";
import type { SugerenciaEstado, SugerenciaSeveridad } from "@/lib/tipos";

export interface Sugerencia {
  id: string;
  bloque_id: string;
  campo: string;
  texto_original: string | null;
  texto_propuesto: string | null;
  motivo: string;
  severidad: SugerenciaSeveridad;
  estado: SugerenciaEstado;
  decidido_at: string | null;
}

const ETIQUETA_SEVERIDAD: Record<SugerenciaSeveridad, string> = {
  error: "Error",
  inconsistencia: "Inconsistencia",
  mejora: "Mejora",
};

const ETIQUETA_DECISION: Record<SugerenciaEstado, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

export default function PanelHallazgos({
  fichaId,
  sugerencias,
}: {
  fichaId: string;
  sugerencias: Sugerencia[];
}) {
  const router = useRouter();
  const [revisando, setRevisando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const revisar = async () => {
    setError(null);
    setAviso(null);
    setRevisando(true);
    try {
      const r = await fetch(`/api/fichas/${fichaId}/revisar`, { method: "POST" });
      const cuerpo = await r.json();
      if (!r.ok) {
        setError(cuerpo.error ?? "No pudimos completar la revisión.");
        return;
      }
      setAviso(
        cuerpo.hallazgos === 0
          ? "La IA no encontró hallazgos en esta revisión."
          : `La IA reportó ${cuerpo.hallazgos} hallazgo(s).`,
      );
      router.refresh();
    } catch {
      setError("No pudimos contactar al servidor.");
    } finally {
      setRevisando(false);
    }
  };

  const decidir = (id: string, decision: "aceptada" | "rechazada") => {
    setError(null);
    iniciar(async () => {
      const r = await decidirSugerencia(fichaId, id, decision);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };

  const pendientes = sugerencias.filter((s) => s.estado === "pendiente");
  const resueltas = sugerencias.filter((s) => s.estado !== "pendiente");

  return (
    <section style={{ marginTop: "var(--space-6)" }}>
      <div className="barra-acciones" style={{ marginBottom: "var(--space-3)" }}>
        <h2 className="eyebrow" style={{ color: "var(--fg-3)", margin: 0 }}>
          Revisión con IA
        </h2>
        <button className="boton" type="button" onClick={revisar} disabled={revisando}>
          {revisando ? "Revisando…" : "Revisar con IA"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {aviso ? (
        <p className="error" style={{ borderLeftColor: "var(--famiq-green)" }}>{aviso}</p>
      ) : null}

      {sugerencias.length === 0 ? (
        <p className="vacio">
          Todavía no se corrió la revisión sobre esta ficha. La IA propone, nunca aplica:
          cada hallazgo se acepta o se rechaza a mano.
        </p>
      ) : null}

      {pendientes.map((s) => (
        <article key={s.id} className="bloque-editor" style={{ marginBottom: "var(--space-4)" }}>
          <header>
            <span className="tipo">
              {ETIQUETA_SEVERIDAD[s.severidad]} · {s.bloque_id} · {s.campo}
            </span>
          </header>
          <div className="cuerpo">
            <p style={{ margin: 0 }}>{s.motivo}</p>

            <table className="tabla" style={{ border: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: "50%" }}>Actual</th>
                  <th>Propuesta</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ background: "rgba(214,39,23,.05)" }}>
                    {s.texto_original || <em style={{ color: "var(--fg-3)" }}>(vacío)</em>}
                  </td>
                  <td style={{ background: "rgba(73,177,112,.08)" }}>
                    {s.texto_propuesto ?? (
                      <em style={{ color: "var(--fg-3)" }}>
                        sin propuesta — reporta un dato que falta
                      </em>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                className="boton"
                type="button"
                disabled={pendiente || s.texto_propuesto === null}
                title={
                  s.texto_propuesto === null
                    ? "No hay valor para aplicar: cargalo a mano en el editor"
                    : undefined
                }
                onClick={() => decidir(s.id, "aceptada")}
              >
                Aceptar
              </button>
              <button
                className="boton"
                data-variante="secundario"
                type="button"
                disabled={pendiente}
                onClick={() => decidir(s.id, "rechazada")}
              >
                Rechazar
              </button>
            </div>
          </div>
        </article>
      ))}

      {resueltas.length > 0 ? (
        <>
          <h3 className="eyebrow" style={{ color: "var(--fg-3)", marginTop: "var(--space-5)" }}>
            Ya resueltas
          </h3>
          <table className="tabla" style={{ marginTop: "var(--space-3)" }}>
            <thead>
              <tr>
                <th>Campo</th>
                <th>Motivo</th>
                <th style={{ width: "8rem" }}>Decisión</th>
                <th style={{ width: "12rem" }}>Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {resueltas.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: "var(--font-condensed)", color: "var(--fg-3)" }}>
                    {s.campo}
                  </td>
                  <td>{s.motivo}</td>
                  <td>{ETIQUETA_DECISION[s.estado]}</td>
                  <td style={{ color: "var(--fg-3)" }}>
                    {s.decidido_at ? new Date(s.decidido_at).toLocaleString("es-AR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}
