import type { Bloque } from "@/lib/tipos";
import { RenderBloque } from "./Bloques";
import "./ficha.css";

/**
 * Documento auxiliar para medir. No se muestra nunca: se renderiza, se leen
 * los altos y se descarta.
 *
 * Cada bloque va en un contenedor del ancho que tendrá en la grilla real
 * (completo o media columna), fuera de la grilla, para que su alto sea el
 * intrínseco. Dentro de la grilla los bloques de una misma fila se estiran al
 * alto de la fila y todos reportarían el mismo número.
 */

export const ANCHO_HOJA_MM = 210;
export const PADDING_X_MM = 13.5;
export const SEPARACION_COLUMNAS_MM = 9;

const anchoContenidoMm = ANCHO_HOJA_MM - PADDING_X_MM * 2;
const anchoColumnaMm = (anchoContenidoMm - SEPARACION_COLUMNAS_MM) / 2;

function anchoDe(b: Bloque): "medio" | "completo" {
  if (b.ancho) return b.ancho;
  return b.tipo === "texto-rico" || b.tipo === "chips" || b.tipo === "tabla-kv"
    ? "medio"
    : "completo";
}

export default function Medidor({
  bloques,
  assets,
  tituloInterior,
  nota,
}: {
  bloques: Bloque[];
  assets?: Record<string, string>;
  tituloInterior: string;
  nota: string;
}) {
  return (
    <div id="medidor">
      {/* Chrome de la primera hoja y de las interiores, para medir su alto. */}
      <article className="hoja" data-medir-hoja="primera">
        <header className="ficha-cabecera">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/ficha/logo-famiq.png" alt="" />
          <div className="identificacion">
            <span className="catalogo">Catálogo</span>
            <span className="version">Versión 1.0 · 2026</span>
          </div>
        </header>
        <div className="regla-marca" />
        <footer className="ficha-pie">
          <span>{nota}</span>
          <span className="paginacion">1 / 1</span>
        </footer>
      </article>

      <article className="hoja" data-medir-hoja="interior">
        <header className="ficha-cabecera">
          <div className="titulo-hoja">
            <span className="antetitulo">Producto</span>
            <h2>{tituloInterior}</h2>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="isotipo" src="/ficha/isotipo-famiq.png" alt="" />
        </header>
        <div className="regla-marca" />
        <footer className="ficha-pie">
          <span>{nota}</span>
          <span className="paginacion">1 / 1</span>
        </footer>
      </article>

      {/* Bloques, cada uno en su ancho real. */}
      <div data-medir-bloques="" style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {bloques.map((b) => (
          <div
            key={b.id}
            data-medir={b.id}
            style={{
              width: anchoDe(b) === "completo" ? `${anchoContenidoMm}mm` : `${anchoColumnaMm}mm`,
            }}
          >
            <RenderBloque bloque={b} assets={assets} />
          </div>
        ))}
      </div>
    </div>
  );
}
