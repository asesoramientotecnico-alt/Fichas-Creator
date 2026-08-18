"use client";

import { useActionState } from "react";
import Link from "next/link";
import { crearProducto } from "@/app/acciones";

export default function NuevoProductoPage() {
  const [estado, accion, pendiente] = useActionState(crearProducto, null);

  return (
    <main className="app-main">
      <p className="eyebrow">Productos</p>
      <h1 className="titulo-pagina" style={{ marginTop: "var(--space-2)" }}>
        Nuevo producto
      </h1>

      <form action={accion} className="form">
        <div className="campo">
          <label htmlFor="sku">SKU</label>
          <input id="sku" name="sku" required autoFocus placeholder="FT-6.1" />
        </div>

        <div className="campo">
          <label htmlFor="nombre_es">Nombre (castellano)</label>
          <input
            id="nombre_es"
            name="nombre_es"
            required
            placeholder="Tuerca autofrenante con inserto de nylon"
          />
        </div>

        <div className="campo">
          <label htmlFor="nombre_en">Nombre (inglés)</label>
          <input id="nombre_en" name="nombre_en" placeholder="Nylon Insert Lock Nut · Hex Nut" />
        </div>

        <div className="campo">
          <label htmlFor="categoria">Categoría</label>
          <input id="categoria" name="categoria" placeholder="Tuercas de acero inoxidable" />
        </div>

        <div className="campo">
          <label htmlFor="subcategoria">Subcategoría</label>
          <input id="subcategoria" name="subcategoria" placeholder="Tuerca hexagonal" />
        </div>

        {estado?.error ? <p className="error">{estado.error}</p> : null}

        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button className="boton" type="submit" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
          <Link className="boton" data-variante="secundario" href="/productos">
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
