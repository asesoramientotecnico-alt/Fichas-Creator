"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarComoPlantilla } from "@/app/acciones";

/**
 * Guarda la estructura de esta ficha como plantilla de familia (M6). Se guarda
 * la forma —bloques, etiquetas, columnas, cotas— sin los datos.
 */
export default function GuardarPlantilla({ fichaId }: { fichaId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const guardar = () => {
    setError(null);
    iniciar(async () => {
      const r = await guardarComoPlantilla(fichaId, nombre);
      if (r.error) setError(r.error);
      else router.push(`/familias/${r.familiaId}`);
    });
  };

  return (
    <section style={{ marginTop: "var(--space-6)" }}>
      <div className="barra-acciones" style={{ marginBottom: 0 }}>
        <h2 className="eyebrow" style={{ color: "var(--fg-3)", margin: 0 }}>
          Plantilla de familia
        </h2>
        <button
          className="boton"
          data-variante="secundario"
          type="button"
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? "Cancelar" : "Guardar como plantilla de familia"}
        </button>
      </div>

      {abierto ? (
        <div className="form" style={{ marginTop: "var(--space-3)" }}>
          <p className="aviso" style={{ margin: 0 }}>
            Se guarda la estructura: los tipos de bloque, sus etiquetas, las columnas de las tablas
            y los símbolos de cota. Los datos de esta ficha no se copian.
          </p>
          <div className="campo">
            <label htmlFor="nombre-familia">Nombre de la familia</label>
            <input
              id="nombre-familia"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tuercas hexagonales autofrenantes"
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button
            className="boton"
            type="button"
            onClick={guardar}
            disabled={pendiente || !nombre.trim()}
            style={{ justifySelf: "start" }}
          >
            {pendiente ? "Guardando…" : "Guardar plantilla"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
