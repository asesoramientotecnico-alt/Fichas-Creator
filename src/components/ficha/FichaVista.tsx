import type { Bloque, FichaEstado } from "@/lib/tipos";
import { ESTADOS_SIN_MARCA_DE_AGUA } from "@/lib/tipos";
import { identificacion } from "@/lib/ficha-textos";
import { RenderBloque } from "./Bloques";
import "./ficha.css";

// Se reexportan para no romper los imports existentes; viven en ficha-textos
// porque este módulo arrastra CSS.
export { NOTA_AL_PIE, identificacion } from "@/lib/ficha-textos";

export interface Hoja {
  /** Título grande de la hoja. Sólo lo llevan las hojas interiores. */
  titulo?: string;
  /** Producto, en rojo al lado del título de las hojas interiores. */
  antetitulo?: string;
  bloques: Bloque[];
  /**
   * Bloques anclados al pie de esta hoja. Cuando no se especifica, se
   * deducen del tipo: así una ficha armada a mano sigue funcionando.
   */
  alPie?: Bloque[];
}

export interface DatosFicha {
  /** Familia del producto: la línea gris de la cabecera de la primera hoja. */
  familia: string;
  /** Píldora de unidad de negocio, arriba a la derecha de la primera hoja. */
  pildoraSrc?: string;
  pildoraAlt?: string;
  version: string;
  /** Número de la revisión que se está mostrando (`ficha_revision.n`). */
  revision: number;
  anio: number;
  estado: FichaEstado;
  nota: string;
  hojas: Hoja[];
}

export function CabeceraPrimera({
  familia,
  pildoraSrc,
  pildoraAlt,
  version,
  revision,
  anio,
}: {
  familia: string;
  pildoraSrc?: string;
  pildoraAlt?: string;
  version: string;
  revision: number;
  anio: number;
}) {
  return (
    <>
      <header className="ficha-cabecera">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/ficha/logo-famiq.png" alt="Famiq — Aceros inoxidables" />
        <div className="marca-negocio">
          {pildoraSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="pildora" src={pildoraSrc} alt={pildoraAlt ?? ""} />
          ) : null}
          <p className="familia">{familia}</p>
        </div>
      </header>
      <div className="ficha-rotulo">
        <p className="rotulo">Ficha técnica</p>
        <p className="identificacion">{identificacion(version, revision, anio)}</p>
      </div>
    </>
  );
}

export function CabeceraInterior({
  titulo,
  antetitulo,
}: {
  titulo?: string;
  antetitulo?: string;
}) {
  return (
    <>
      <header className="ficha-cabecera" data-interior="true">
        <div className="titulo-hoja">
          <h2>{titulo}</h2>
          {antetitulo ? <span className="producto">{antetitulo}</span> : null}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-interior" src="/ficha/logo-famiq.png" alt="Famiq" />
      </header>
      <div className="regla-marca">
        <span className="tramo-gris" />
        <span className="tramo-rojo" />
      </div>
    </>
  );
}

/**
 * La barra destacada se ancla al pie de su hoja. Si el paginado ya decidió el
 * reparto, se respeta tal cual; si la hoja viene armada a mano, se deduce del
 * tipo.
 */
function separarPie(hoja: Hoja): [Bloque[], Bloque[]] {
  if (hoja.alPie) return [hoja.bloques, hoja.alPie];

  const cuerpo: Bloque[] = [];
  const pie: Bloque[] = [];
  for (const b of hoja.bloques) {
    (b.tipo === "barra-destacada" ? pie : cuerpo).push(b);
  }
  return [cuerpo, pie];
}

export default function FichaVista({
  datos,
  assets,
}: {
  datos: DatosFicha;
  assets?: Record<string, string>;
}) {
  const total = datos.hojas.length;
  const borrador = !ESTADOS_SIN_MARCA_DE_AGUA.includes(datos.estado);

  return (
    <div className="ficha">
      {datos.hojas.map((hoja, i) => {
        const [cuerpo, pie] = separarPie(hoja);
        const esPrimera = i === 0;
        return (
          <article
            className="hoja"
            key={i}
            data-borrador={borrador}
            data-primera={esPrimera ? "true" : undefined}
          >
            {esPrimera ? (
              <CabeceraPrimera
                familia={datos.familia}
                pildoraSrc={datos.pildoraSrc}
                pildoraAlt={datos.pildoraAlt}
                version={datos.version}
                revision={datos.revision}
                anio={datos.anio}
              />
            ) : (
              <CabeceraInterior titulo={hoja.titulo} antetitulo={hoja.antetitulo} />
            )}

            <div className="grilla-bloques">
              {cuerpo.map((bloque) => (
                <RenderBloque key={bloque.id} bloque={bloque} assets={assets} />
              ))}
            </div>

            {pie.length > 0 ? (
              <div className="bloques-al-pie">
                {pie.map((bloque) => (
                  <RenderBloque key={bloque.id} bloque={bloque} assets={assets} />
                ))}
              </div>
            ) : null}

            <footer className="ficha-pie">
              <span>{datos.nota}</span>
              <span className="paginacion">
                {i + 1} / {total}
              </span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
