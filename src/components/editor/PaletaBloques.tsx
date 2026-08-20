"use client";

import { useMemo, useState } from "react";
import type { TipoBloque } from "@/lib/tipos";
import { TIPOS_DISPONIBLES } from "@/lib/bloques-nuevos";
import { empezarArrastre } from "./arrastre";

/**
 * Paleta de tipos de bloque. Con quince tipos, una lista plana obliga a leerla
 * entera cada vez: se agrupa por para qué sirve cada uno y se puede buscar.
 *
 * Los grupos son de navegación, no del modelo: §4 sigue teniendo una sola tabla
 * de tipos y agregar uno sigue siendo una decisión de producto.
 */

const GRUPOS: { nombre: string; tipos: TipoBloque[] }[] = [
  { nombre: "Estructura", tipos: ["header", "barra-destacada"] },
  { nombre: "Texto", tipos: ["texto-rico", "par-texto", "chips", "inline-kv"] },
  {
    nombre: "Tablas",
    tipos: ["tabla-kv", "tabla", "tabla-dim", "tabla-ancha", "lista-componentes", "codigos"],
  },
  { nombre: "Figuras", tipos: ["imagen", "croquis", "chart"] },
];

const POR_TIPO = new Map(TIPOS_DISPONIBLES.map((t) => [t.tipo, t]));

export default function PaletaBloques({
  onAgregar,
}: {
  onAgregar: (tipo: TipoBloque) => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return GRUPOS;
    return GRUPOS.map((g) => ({
      ...g,
      tipos: g.tipos.filter((t) => {
        const info = POR_TIPO.get(t);
        if (!info) return false;
        return (
          info.nombre.toLowerCase().includes(q) ||
          info.descripcion.toLowerCase().includes(q) ||
          t.includes(q)
        );
      }),
    })).filter((g) => g.tipos.length > 0);
  }, [busqueda]);

  return (
    <div className="paleta">
      <div className="campo">
        <label htmlFor="buscar-tipo">Agregar bloque</label>
        <input
          id="buscar-tipo"
          type="search"
          value={busqueda}
          placeholder="Buscar un tipo…"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {grupos.length === 0 ? (
        <p className="paleta-vacia">Ningún tipo coincide.</p>
      ) : null}

      {grupos.map((g) => (
        <section key={g.nombre} className="paleta-grupo">
          <h3>{g.nombre}</h3>
          {g.tipos.map((t) => {
            const info = POR_TIPO.get(t);
            if (!info) return null;
            return (
              <button
                key={t}
                type="button"
                className="tipo-opcion"
                // El nombre accesible dice la acción, no sólo el tipo: sin el
                // verbo, este botón y el ítem de la lista de orden se llaman
                // igual y no se distinguen.
                aria-label={`Agregar ${info.nombre}`}
                draggable
                onDragStart={(e) => empezarArrastre(e, { clase: "tipo", tipo: t })}
                onClick={() => onAgregar(t)}
                title="Clic para agregarlo al final, o arrastralo a la hoja"
              >
                <span className="nombre">{info.nombre}</span>
                <span className="desc">{info.descripcion}</span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
