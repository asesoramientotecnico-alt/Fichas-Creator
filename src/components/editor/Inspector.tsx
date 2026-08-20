"use client";

import type { AnchoBloque, Bloque } from "@/lib/tipos";
import type { AssetDisponible } from "@/app/acciones-assets";
import { TIPOS_DISPONIBLES } from "@/lib/bloques-nuevos";
import { anchoDe, TITULO_INTERIOR_POR_OMISION } from "@/lib/paginado";
import CamposBloque from "./CamposBloque";
import { empezarArrastre } from "./arrastre";

const NOMBRE_TIPO = new Map(TIPOS_DISPONIBLES.map((t) => [t.tipo, t.nombre]));

const ANCHOS: { valor: AnchoBloque; nombre: string; pistas: string }[] = [
  { valor: "un-tercio", nombre: "Un tercio", pistas: "4 de 12" },
  { valor: "medio", nombre: "Media hoja", pistas: "6 de 12" },
  { valor: "dos-tercios", nombre: "Dos tercios", pistas: "8 de 12" },
  { valor: "completo", nombre: "Completo", pistas: "12 de 12" },
];

/** Los tipos que llevan una imagen de la librería de la familia (§7). */
const CON_IMAGEN = new Set(["header", "imagen", "croquis", "codigos"]);

/**
 * Campos del bloque seleccionado. Es el panel derecho del editor: en el lienzo
 * se elige y se acomoda, acá se escribe.
 */
export default function Inspector({
  bloque,
  esNuevo,
  assetsDisponibles,
  onChange,
  onAncho,
  onDuplicar,
  onEliminar,
}: {
  bloque: Bloque | null;
  esNuevo: boolean;
  assetsDisponibles: AssetDisponible[];
  onChange: (nuevo: Bloque) => void;
  onAncho: (ancho: AnchoBloque) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}) {
  if (!bloque) {
    return (
      <div className="inspector">
        <p className="paleta-vacia">
          Hacé clic en un bloque de la hoja para editar sus campos.
        </p>
      </div>
    );
  }

  const llevaImagen = CON_IMAGEN.has(bloque.tipo);

  return (
    <div className="inspector">
      <header className="inspector-cabecera">
        <div>
          <p className="eyebrow">Bloque seleccionado</p>
          <h3>
            {NOMBRE_TIPO.get(bloque.tipo) ?? bloque.tipo}
            {esNuevo ? <span className="marca-nuevo">nuevo</span> : null}
          </h3>
        </div>
        <div className="acciones-bloque">
          <button
            type="button"
            className="icono"
            title="Duplicar bloque"
            aria-label="Duplicar bloque"
            onClick={onDuplicar}
          >
            ⧉
          </button>
          <button
            type="button"
            className="icono"
            data-peligro="true"
            title="Eliminar bloque"
            aria-label="Eliminar bloque"
            onClick={onEliminar}
          >
            ×
          </button>
        </div>
      </header>

      {/* El ancho es lo único de la maqueta que el usuario decide, y sólo entre
          las cuatro fracciones de la grilla de 12 pistas. Cualquier otro valor
          rompería la alineación de columnas. */}
      <div className="campo">
        <label htmlFor={`ancho-${bloque.id}`}>Ancho en la hoja</label>
        <div className="anchos" id={`ancho-${bloque.id}`} role="group">
          {ANCHOS.map((a) => (
            <button
              key={a.valor}
              type="button"
              className="ancho-opcion"
              data-activo={anchoDe(bloque) === a.valor ? "true" : undefined}
              title={`${a.nombre} · ${a.pistas}`}
              onClick={() => onAncho(a.valor)}
            >
              <span className="ancho-barra" data-ancho={a.valor} aria-hidden />
              <span className="ancho-nombre">{a.nombre}</span>
            </button>
          ))}
        </div>
      </div>

      <CamposBloque
        bloque={bloque}
        assetsDisponibles={assetsDisponibles}
        onChange={onChange}
      />

      {/* El título de una hoja interior lo aporta el bloque que la abre y no la
          hoja (§4): el paginado decide qué bloque cae en qué hoja, así que un
          título declarado por hoja se despegaría de su contenido al cambiar el
          reparto. Acá se ve y se edita. */}
      <div className="campo">
        <label htmlFor={`titulo-hoja-${bloque.id}`}>
          Título de la hoja, si este bloque la abre
        </label>
        <input
          id={`titulo-hoja-${bloque.id}`}
          value={bloque.tituloHoja ?? ""}
          placeholder="Ej. Tabla de cotas y dimensiones"
          onChange={(e) =>
            onChange({ ...bloque, tituloHoja: e.target.value.trim() ? e.target.value : undefined })
          }
        />
        <p className="paleta-vacia">
          Se usa sólo cuando este bloque queda primero en una hoja interior. Si
          ninguno lo declara, la hoja dice «{TITULO_INTERIOR_POR_OMISION}».
        </p>
      </div>

      {llevaImagen && assetsDisponibles.length > 0 ? (
        <div className="libreria">
          <h4>Librería de la familia</h4>
          <p className="paleta-vacia">
            Arrastrá una imagen sobre el bloque de la hoja al que va.
          </p>
          <div className="libreria-grilla">
            {assetsDisponibles.map((a) => (
              <figure
                key={a.id}
                className="libreria-item"
                draggable
                onDragStart={(e) => empezarArrastre(e, { clase: "asset", assetId: a.id })}
                title={a.alt ?? a.tipo}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.alt ?? ""} />
                <figcaption>{a.tipo}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
