"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearFicha } from "@/app/acciones";

interface Props {
  productos: { id: string; sku: string; nombre_es: string }[];
}

export default function FormularioNuevaFicha({ productos }: Props) {
  const [estado, accion, pendiente] = useActionState(crearFicha, null);

  return (
    <form action={accion} className="form">
      <div className="campo">
        <label htmlFor="producto_id">Producto</label>
        <select id="producto_id" name="producto_id" required defaultValue="">
          <option value="" disabled>
            Elegí un producto…
          </option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.nombre_es}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="version">Versión</label>
        <input id="version" name="version" defaultValue="1.0" />
      </div>

      <div className="campo">
        <label htmlFor="anio">Año</label>
        <input
          id="anio"
          name="anio"
          type="number"
          min={1900}
          max={2200}
          defaultValue={new Date().getFullYear()}
        />
      </div>

      {estado?.error ? <p className="error">{estado.error}</p> : null}

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button className="boton" type="submit" disabled={pendiente}>
          {pendiente ? "Creando…" : "Crear ficha"}
        </button>
        <Link className="boton" data-variante="secundario" href="/">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
