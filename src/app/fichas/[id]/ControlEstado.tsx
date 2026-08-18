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
        {posibles.map((e) => (
          <button key={e} type="button" className="boton" data-variante="secundario"
            disabled={pendiente} onClick={() => cambiar(e)}>
            → {ETIQUETA_ESTADO[e]}
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
