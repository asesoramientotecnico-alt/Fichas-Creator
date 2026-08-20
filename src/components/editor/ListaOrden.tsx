"use client";

import { useState } from "react";
import type { Bloque } from "@/lib/tipos";
import { TIPOS_DISPONIBLES } from "@/lib/bloques-nuevos";
import { cargaDe, empezarArrastre, esNuestro } from "./arrastre";

const NOMBRE_TIPO = new Map(TIPOS_DISPONIBLES.map((t) => [t.tipo, t.nombre]));

/**
 * Los bloques de la ficha en orden, para reordenar arrastrando y para saltar a
 * uno.
 *
 * Antes reordenar era subir y bajar de a un paso: mover el bloque quince al
 * segundo lugar eran trece clics. Acá se arrastra al lugar, y la lista sirve
 * además de índice de una ficha larga, donde el lienzo obliga a scrollear para
 * saber qué hay.
 */
export default function ListaOrden({
  bloques,
  seleccionado,
  nuevos,
  onSeleccionar,
  onMover,
  onSoltarTipo,
}: {
  bloques: Bloque[];
  seleccionado: string | null;
  /** Ids que no venían en la revisión cargada: se marcan como nuevos. */
  nuevos: Set<string>;
  onSeleccionar: (id: string) => void;
  /** Mueve el bloque `id` para que quede en la posición `destino`. */
  onMover: (id: string, destino: number) => void;
  onSoltarTipo: (tipo: Bloque["tipo"], destino: number) => void;
}) {
  const [encima, setEncima] = useState<number | null>(null);

  const soltar = (e: React.DragEvent, destino: number) => {
    e.preventDefault();
    setEncima(null);
    const carga = cargaDe(e);
    if (!carga) return;
    if (carga.clase === "bloque") onMover(carga.id, destino);
    else if (carga.clase === "tipo") onSoltarTipo(carga.tipo, destino);
  };

  const zona = (destino: number) => (
    <div
      className="orden-hueco"
      data-activo={encima === destino ? "true" : undefined}
      onDragOver={(e) => {
        if (!esNuestro(e)) return;
        e.preventDefault();
        setEncima(destino);
      }}
      onDragLeave={() => setEncima((p) => (p === destino ? null : p))}
      onDrop={(e) => soltar(e, destino)}
    />
  );

  return (
    <div className="orden">
      <h3>Bloques de la ficha</h3>
      {bloques.length === 0 ? (
        <p className="paleta-vacia">
          Todavía no hay bloques. Arrastrá uno de la paleta a la hoja.
        </p>
      ) : null}

      <div className="orden-lista">
        {zona(0)}
        {bloques.map((b, i) => (
          <div key={b.id}>
            <button
              type="button"
              className="orden-item"
              data-seleccionado={b.id === seleccionado ? "true" : undefined}
              data-nuevo={nuevos.has(b.id) ? "true" : undefined}
              draggable
              onDragStart={(e) => empezarArrastre(e, { clase: "bloque", id: b.id })}
              onClick={() => onSeleccionar(b.id)}
            >
              <span className="orden-asa" aria-hidden>
                ⠿
              </span>
              <span className="orden-numero">{i + 1}</span>
              <span className="orden-nombre">
                {NOMBRE_TIPO.get(b.tipo) ?? b.tipo}
                {"etiqueta" in b && b.etiqueta ? (
                  <span className="orden-rotulo"> · {b.etiqueta}</span>
                ) : "tituloEs" in b && b.tituloEs ? (
                  <span className="orden-rotulo"> · {b.tituloEs}</span>
                ) : null}
              </span>
            </button>
            {zona(i + 1)}
          </div>
        ))}
      </div>
    </div>
  );
}
