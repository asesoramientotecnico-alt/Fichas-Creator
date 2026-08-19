"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstado } from "@/app/acciones-ficha";
import { ETIQUETA_ESTADO, type FichaEstado } from "@/lib/tipos";

export default function ControlEstado({
  fichaId,
  actual,
  posibles,
}: {
  fichaId: string;
  actual: FichaEstado;
  posibles: FichaEstado[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cambiar = (nuevo: FichaEstado) => {
    setError(null);
    iniciar(async () => {
      const r = await cambiarEstado(fichaId, nuevo);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };

  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <span className="estado" data-estado={actual}>{ETIQUETA_ESTADO[actual]}</span>

        {/* El flujo de aprobación. */}
        {posibles
          .filter((e) => e !== "anulada")
          .map((e) => (
            <button key={e} type="button" className="boton" data-variante="secundario"
              disabled={pendiente} onClick={() => cambiar(e)}>
              → {ETIQUETA_ESTADO[e]}
            </button>
          ))}

        {/* Anular va aparte y con confirmación: no es un paso del flujo, es la
            salida para una ficha creada por error. */}
        {posibles.includes("anulada") ? (
          <button
            type="button"
            className="boton"
            data-variante="secundario"
            style={{ marginLeft: "auto", borderColor: "var(--famiq-red)", color: "var(--famiq-red)" }}
            disabled={pendiente}
            onClick={() => {
              if (confirm("¿Anular esta ficha? Deja de listarse, pero conserva todo su historial y se puede restaurar.")) {
                cambiar("anulada");
              }
            }}
          >
            Anular ficha
          </button>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
