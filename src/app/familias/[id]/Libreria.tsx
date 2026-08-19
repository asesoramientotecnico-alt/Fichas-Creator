"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarAsset } from "@/app/acciones-assets";
import type { AssetTipo } from "@/lib/tipos";

interface Item {
  id: string;
  tipo: AssetTipo;
  alt: string | null;
  url: string | null;
}

export default function Libreria({ assets }: { assets: Item[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (assets.length === 0) {
    return <p className="vacio" style={{ marginTop: "var(--space-4)" }}>La librería está vacía.</p>;
  }

  const borrar = (id: string) => {
    setError(null);
    iniciar(async () => {
      const r = await borrarAsset(id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };

  return (
    <>
      {error ? <p className="error">{error}</p> : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "var(--space-4)",
          marginTop: "var(--space-4)",
        }}
      >
        {assets.map((a) => (
          <figure
            key={a.id}
            style={{
              margin: 0,
              border: "1px solid var(--border-1)",
              background: "var(--bg-1)",
              display: "grid",
              gridTemplateRows: "140px auto",
            }}
          >
            <div
              style={{
                display: "grid",
                placeItems: "center",
                background: "var(--bg-2)",
                overflow: "hidden",
                padding: "var(--space-2)",
              }}
            >
              {a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt={a.alt ?? ""}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : (
                <span style={{ color: "var(--fg-3)", fontSize: "var(--fs-micro)" }}>
                  sin vista previa
                </span>
              )}
            </div>
            <figcaption style={{ padding: "var(--space-3)", display: "grid", gap: "var(--space-2)" }}>
              <span className="estado" style={{ justifySelf: "start" }}>{a.tipo}</span>
              <span style={{ fontSize: "var(--fs-micro)", color: "var(--fg-2)" }}>
                {a.alt ?? "sin descripción"}
              </span>
              <button
                className="boton"
                data-variante="secundario"
                type="button"
                disabled={pendiente}
                onClick={() => borrar(a.id)}
              >
                Quitar
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
