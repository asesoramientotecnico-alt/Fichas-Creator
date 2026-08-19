"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { crearFicha, crearFichaDesdePlantilla } from "@/app/acciones";

interface Props {
  productos: { id: string; sku: string; nombre_es: string }[];
  familias: { id: string; nombre: string }[];
  familiaInicial: string;
}

export default function FormularioNuevaFicha({ productos, familias, familiaInicial }: Props) {
  // Con familia se instancia su plantilla; sin familia, la ficha nace vacía.
  const [familiaId, setFamiliaId] = useState(familiaInicial);
  const desdePlantilla = familiaId !== "";

  const [estado, accion, pendiente] = useActionState(
    desdePlantilla ? crearFichaDesdePlantilla : crearFicha,
    null,
  );

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
        <label htmlFor="familia_id">Familia (plantilla)</label>
        <select
          id="familia_id"
          name="familia_id"
          value={familiaId}
          onChange={(e) => setFamiliaId(e.target.value)}
        >
          <option value="">Sin plantilla — arrancar de cero</option>
          {familias.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
        {desdePlantilla ? (
          <span style={{ fontSize: "var(--fs-micro)", color: "var(--fg-3)" }}>
            La ficha nace con los bloques de la plantilla, vacíos de datos.
          </span>
        ) : null}
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
          {pendiente ? "Creando…" : desdePlantilla ? "Crear desde plantilla" : "Crear ficha"}
        </button>
        <Link className="boton" data-variante="secundario" href="/">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
