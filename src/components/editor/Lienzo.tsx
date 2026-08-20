"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnchoBloque, Bloque, TipoBloque } from "@/lib/tipos";
import { PISTAS_GRILLA, PISTAS_POR_ANCHO } from "@/lib/tipos";
import { anchoDe } from "@/lib/paginado";
import FichaPaginada from "@/components/ficha/FichaPaginada";
import type { DatosFicha } from "@/components/ficha/FichaVista";
import { cargaDe, esNuestro } from "./arrastre";

/**
 * La hoja como lienzo: la ficha de verdad, con las manijas de edición encima.
 *
 * La ficha se dibuja con el MISMO componente que la pantalla y el PDF (§3), sin
 * una variante "de edición" — si fueran dos implementaciones, el lienzo mentiría
 * sobre lo que se va a imprimir. Todo lo que se agrega para editar vive en una
 * capa aparte, posicionada sobre el bloque seleccionado, y no toca ni un pixel
 * de la ficha.
 *
 * Lo que se puede hacer arrastrando está acotado por la grilla de 12 pistas:
 * mover un bloque de lugar y llevar su ancho a una de las cuatro fracciones de
 * §4. No hay posicionamiento libre, así que la estética sigue garantizada por
 * la estructura y no por la mano del usuario (§1 requisito 1).
 */

/** Los cuatro anchos, de menor a mayor, para poder ir al siguiente o al previo. */
const ANCHOS: AnchoBloque[] = ["un-tercio", "medio", "dos-tercios", "completo"];

interface Recuadro {
  arriba: number;
  izquierda: number;
  ancho: number;
  alto: number;
}

export default function Lienzo({
  datos,
  bloques,
  assets,
  producto,
  seleccionado,
  onSeleccionar,
  onMover,
  onInsertar,
  onAncho,
  onAsset,
  onMarca,
}: {
  datos: Omit<DatosFicha, "hojas">;
  bloques: Bloque[];
  assets?: Record<string, string>;
  producto: string;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
  /** Deja el bloque `id` justo antes del bloque `antesDe`, o al final si es null. */
  onMover: (id: string, antesDe: string | null) => void;
  onInsertar: (tipo: TipoBloque, antesDe: string | null) => void;
  onAncho: (id: string, ancho: AnchoBloque) => void;
  onAsset: (id: string, assetId: string) => void;
  /** Reubica la marca de cota `indice` del bloque, en porcentaje de la imagen. */
  onMarca: (id: string, indice: number, x: number, y: number) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  // La hoja mide 210 mm: en un notebook no entra a tamaño real. El zoom usa la
  // propiedad `zoom` y no `transform`, porque `zoom` sí afecta el layout y así
  // el scroll del lienzo abarca la hoja escalada. Las manijas se miden con
  // getBoundingClientRect, que ya devuelve píxeles visuales, así que siguen
  // cayendo en su lugar sin corregir nada.
  const [zoom, setZoom] = useState(1);
  const [recuadro, setRecuadro] = useState<Recuadro | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [recuadroDestino, setRecuadroDestino] = useState<Recuadro | null>(null);

  /** El id del bloque bajo el evento, si hay alguno. */
  const bloqueDe = (e: { target: EventTarget | null }): string | null => {
    const nodo = e.target instanceof Element ? e.target.closest("[data-bloque-id]") : null;
    return nodo?.getAttribute("data-bloque-id") ?? null;
  };

  /**
   * Recuadro de un bloque, en coordenadas del lienzo. Se mide del DOM y no se
   * deduce del modelo: el alto depende del wrapping y de las métricas de la
   * fuente, igual que el paginado.
   */
  const recuadroDe = (id: string): Recuadro | null => {
    const caja = contenedor.current;
    if (!caja) return null;
    const nodo = caja.querySelector(`[data-bloque-id="${CSS.escape(id)}"]`);
    if (!nodo) return null;
    const r = nodo.getBoundingClientRect();
    const c = caja.getBoundingClientRect();
    return {
      arriba: r.top - c.top + caja.scrollTop,
      izquierda: r.left - c.left + caja.scrollLeft,
      ancho: r.width,
      alto: r.height,
    };
  };

  const medirSeleccion = useCallback(() => {
    setRecuadro(seleccionado ? recuadroDe(seleccionado) : null);
    // recuadroDe lee el ref, que es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado]);

  // El recuadro sigue al bloque: cambia con la selección, con el contenido
  // —que puede mover el bloque a otra hoja— y con el tamaño de la ventana.
  useEffect(() => {
    medirSeleccion();
  }, [medirSeleccion, bloques, zoom]);

  useEffect(() => {
    const alRedibujar = () => medirSeleccion();
    window.addEventListener("resize", alRedibujar);
    const caja = contenedor.current;
    caja?.addEventListener("scroll", alRedibujar);
    return () => {
      window.removeEventListener("resize", alRedibujar);
      caja?.removeEventListener("scroll", alRedibujar);
    };
  }, [medirSeleccion]);

  /**
   * Lleva el ancho del bloque a la fracción más cercana al borde que la persona
   * arrastró. Se compara contra el ancho de la grilla, no contra píxeles
   * arbitrarios: el resultado sólo puede ser una de las cuatro fracciones.
   */
  const ajustarAncho = (id: string, xPuntero: number) => {
    const caja = contenedor.current;
    const nodo = caja?.querySelector(`[data-bloque-id="${CSS.escape(id)}"]`);
    const grilla = nodo?.closest(".grilla-bloques");
    if (!grilla || !nodo) return;

    const g = grilla.getBoundingClientRect();
    const n = nodo.getBoundingClientRect();
    const pistas = ((xPuntero - n.left) / g.width) * PISTAS_GRILLA;

    let mejor = ANCHOS[0];
    let distancia = Infinity;
    for (const a of ANCHOS) {
      const d = Math.abs(PISTAS_POR_ANCHO[a] - pistas);
      if (d < distancia) {
        distancia = d;
        mejor = a;
      }
    }
    onAncho(id, mejor);
  };

  const [arrastrandoAncho, setArrastrandoAncho] = useState(false);

  useEffect(() => {
    if (!arrastrandoAncho || !seleccionado) return;
    const mover = (e: PointerEvent) => ajustarAncho(seleccionado, e.clientX);
    const soltar = () => setArrastrandoAncho(false);
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastrandoAncho, seleccionado]);

  /**
   * Arrastrar un símbolo de cota sobre su imagen.
   *
   * Va con eventos de puntero y no con el arrastre nativo porque acá no cruza
   * paneles: es mover algo dentro de su propia caja, y lo que hace falta es la
   * posición exacta en cada movimiento, que el arrastre nativo no da.
   *
   * El resultado se guarda en porcentaje de la caja de la imagen, así la marca
   * cae en el mismo punto del dibujo en el PDF y con cualquier ancho de bloque.
   */
  const tomarMarca = (e: React.PointerEvent) => {
    if (!(e.target instanceof Element)) return;
    const marca = e.target.closest("[data-marca-indice]");
    if (!marca) return;
    const caja = marca.closest(".lienzo-cotas");
    const bloque = marca.closest("[data-bloque-id]")?.getAttribute("data-bloque-id");
    if (!caja || !bloque) return;

    const indice = Number(marca.getAttribute("data-marca-indice"));
    if (!Number.isInteger(indice)) return;

    // Se elige el bloque y no se deja que el clic burbujee: arrastrar una marca
    // no debería, además, contar como clic en la hoja.
    e.preventDefault();
    e.stopPropagation();
    onSeleccionar(bloque);

    const mover = (ev: PointerEvent) => {
      const r = caja.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      onMarca(
        bloque,
        indice,
        ((ev.clientX - r.left) / r.width) * 100,
        ((ev.clientY - r.top) / r.height) * 100,
      );
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    const carga = cargaDe(e);
    const bajoElPuntero = bloqueDe(e);
    setDestino(null);
    setRecuadroDestino(null);
    if (!carga) return;

    if (carga.clase === "asset") {
      if (bajoElPuntero) onAsset(bajoElPuntero, carga.assetId);
      return;
    }
    // Soltar sobre un bloque lo deja ANTES de ese bloque; soltar en el margen
    // de la hoja lo manda al final.
    if (carga.clase === "bloque") {
      if (carga.id !== bajoElPuntero) onMover(carga.id, bajoElPuntero);
      return;
    }
    onInsertar(carga.tipo, bajoElPuntero);
  };

  const seleccion = seleccionado
    ? (bloques.find((b) => b.id === seleccionado) ?? null)
    : null;

  return (
    <div
      className="lienzo"
      ref={contenedor}
      onDragOver={(e) => {
        if (!esNuestro(e)) return;
        e.preventDefault();
        const id = bloqueDe(e);
        if (id !== destino) {
          setDestino(id);
          setRecuadroDestino(id ? recuadroDe(id) : null);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setDestino(null);
          setRecuadroDestino(null);
        }
      }}
      onDrop={alSoltar}
      onPointerDown={tomarMarca}
      onClick={(e) => onSeleccionar(bloqueDe(e))}
    >
      <div className="lienzo-zoom-barra">
        <span>Zoom</span>
        {[0.5, 0.75, 1].map((z) => (
          <button
            key={z}
            type="button"
            className="zoom-opcion"
            data-activo={zoom === z ? "true" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              setZoom(z);
            }}
          >
            {Math.round(z * 100)}%
          </button>
        ))}
      </div>

      <div className="lienzo-hoja">
        <div className="lienzo-zoom" style={{ zoom }}>
          <FichaPaginada
            datos={datos}
            bloques={bloques}
            assets={assets}
            tituloInterior="Tabla de cotas y dimensiones"
            antetitulo={producto}
          />
        </div>

        {recuadroDestino ? (
          <span
            className="marca-destino"
            data-modo="antes"
            style={{
              top: recuadroDestino.arriba,
              left: recuadroDestino.izquierda - 5,
              height: recuadroDestino.alto,
            }}
          />
        ) : null}

        {recuadro && seleccion ? (
          <div
            className="marco-seleccion"
            style={{
              top: recuadro.arriba,
              left: recuadro.izquierda,
              width: recuadro.ancho,
              height: recuadro.alto,
            }}
          >
            <span className="marco-rotulo">
              {anchoDe(seleccion) === "completo"
                ? "ancho completo"
                : anchoDe(seleccion) === "dos-tercios"
                  ? "dos tercios"
                  : anchoDe(seleccion) === "medio"
                    ? "media hoja"
                    : "un tercio"}
            </span>
            {/* Arrastrar el borde derecho lleva el ancho a la fracción más
                cercana de la grilla. No hay tamaño libre. */}
            <span
              className="marco-asa-ancho"
              title="Arrastrar para cambiar el ancho"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setArrastrandoAncho(true);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
