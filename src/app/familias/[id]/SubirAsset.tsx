"use client";

import { useActionState } from "react";
import { subirAsset } from "@/app/acciones-assets";

export default function SubirAsset({ familiaId }: { familiaId: string }) {
  const [estado, accion, pendiente] = useActionState(subirAsset, null);

  return (
    <form action={accion} className="form" style={{ maxWidth: "none", marginTop: "var(--space-4)" }}>
      <input type="hidden" name="familia_id" value={familiaId} />

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: "var(--space-4)" }}>
        <div className="campo">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue="croquis">
            <option value="croquis">Croquis</option>
            <option value="foto">Foto</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="archivo">Archivo</label>
          <input id="archivo" name="archivo" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" required />
        </div>
        <div className="campo">
          <label htmlFor="alt">Descripción (texto alternativo)</label>
          <input id="alt" name="alt" placeholder="Croquis dimensional con cotas d, s y h" />
        </div>
      </div>

      {estado?.error ? <p className="error">{estado.error}</p> : null}

      <button className="boton" type="submit" disabled={pendiente} style={{ justifySelf: "start" }}>
        {pendiente ? "Subiendo…" : "Subir a la librería"}
      </button>
    </form>
  );
}
