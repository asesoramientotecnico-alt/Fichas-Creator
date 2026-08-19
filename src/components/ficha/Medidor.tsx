import type { Bloque } from "@/lib/tipos";
import { PISTAS_GRILLA, PISTAS_POR_ANCHO } from "@/lib/tipos";
import { anchoDe } from "@/lib/paginado";
import { RenderBloque } from "./Bloques";
import { CabeceraInterior, CabeceraPrimera } from "./FichaVista";
import "./ficha.css";

/**
 * Documento auxiliar para medir. No se muestra nunca: se renderiza, se leen
 * los altos y se descarta.
 *
 * Las dos hojas de muestra usan las MISMAS cabeceras que la ficha real, no una
 * copia: si el chrome medido y el dibujado difieren, el paginado corta en el
 * lugar equivocado y el preview miente sobre el PDF.
 *
 * Cada bloque va en un contenedor del ancho que tendrá en la grilla real,
 * fuera de la grilla, para que su alto sea el intrínseco. Dentro de la grilla
 * los bloques de una misma fila se estiran al alto de la fila y todos
 * reportarían el mismo número.
 */

export const ANCHO_HOJA_MM = 210;
export const PADDING_X_MM = 13;
export const SEPARACION_COLUMNAS_MM = 9;

const anchoContenidoMm = ANCHO_HOJA_MM - PADDING_X_MM * 2;
/** Ancho de una pista de la grilla, despejado de 12·pista + 11·separación. */
const anchoPistaMm =
  (anchoContenidoMm - SEPARACION_COLUMNAS_MM * (PISTAS_GRILLA - 1)) / PISTAS_GRILLA;

export function anchoEnMm(bloque: Bloque): number {
  const pistas = PISTAS_POR_ANCHO[anchoDe(bloque)];
  return anchoPistaMm * pistas + SEPARACION_COLUMNAS_MM * (pistas - 1);
}

export default function Medidor({
  bloques,
  assets,
  tituloInterior,
  antetitulo,
  nota,
  familia,
  pildoraSrc,
  pildoraAlt,
  version,
  revision,
  anio,
}: {
  bloques: Bloque[];
  assets?: Record<string, string>;
  tituloInterior: string;
  antetitulo: string;
  nota: string;
  familia: string;
  pildoraSrc?: string;
  pildoraAlt?: string;
  version: string;
  revision: number;
  anio: number;
}) {
  return (
    <div id="medidor">
      {/* Chrome de la primera hoja y de las interiores, para medir su alto. */}
      <article className="hoja" data-medir-hoja="primera" data-primera="true">
        <CabeceraPrimera
          familia={familia}
          pildoraSrc={pildoraSrc}
          pildoraAlt={pildoraAlt}
          version={version}
          revision={revision}
          anio={anio}
        />
        <div className="grilla-bloques" />
        <footer className="ficha-pie">
          <span>{nota}</span>
          <span className="paginacion">1 / 1</span>
        </footer>
      </article>

      <article className="hoja" data-medir-hoja="interior">
        <CabeceraInterior titulo={tituloInterior} antetitulo={antetitulo} />
        <div className="grilla-bloques" />
        <footer className="ficha-pie">
          <span>{nota}</span>
          <span className="paginacion">1 / 1</span>
        </footer>
      </article>

      {/* Bloques, cada uno en su ancho real. */}
      <div data-medir-bloques="" style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {bloques.map((b) => (
          <div key={b.id} data-medir={b.id} style={{ width: `${anchoEnMm(b)}mm` }}>
            <RenderBloque bloque={b} assets={assets} />
          </div>
        ))}
      </div>
    </div>
  );
}
