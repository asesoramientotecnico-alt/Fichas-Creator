import type { Bloque, FichaEstado } from "@/lib/tipos";
import { ESTADOS_SIN_MARCA_DE_AGUA } from "@/lib/tipos";
import { RenderBloque } from "./Bloques";
import "./ficha.css";

export interface Hoja {
  /** Título grande de la hoja. Sólo lo llevan las hojas interiores. */
  titulo?: string;
  /** Producto, en pequeño sobre el título de las hojas interiores. */
  antetitulo?: string;
  bloques: Bloque[];
}

export interface DatosFicha {
  catalogo: string;
  version: string;
  anio: number;
  estado: FichaEstado;
  nota: string;
  hojas: Hoja[];
}

function Cabecera({
  hoja,
  catalogo,
  version,
  anio,
  esPrimera,
}: {
  hoja: Hoja;
  catalogo: string;
  version: string;
  anio: number;
  esPrimera: boolean;
}) {
  return (
    <>
      <header className="ficha-cabecera">
        {esPrimera ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="logo" src="/ficha/logo-famiq.png" alt="Famiq — Aceros inoxidables" />
        ) : (
          <div className="titulo-hoja">
            {hoja.antetitulo ? <span className="antetitulo">{hoja.antetitulo}</span> : null}
            <h2>{hoja.titulo}</h2>
          </div>
        )}

        {esPrimera ? (
          <div className="identificacion">
            <span className="catalogo">{catalogo}</span>
            <span className="version">
              Versión {version} · {anio}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="isotipo" src="/ficha/isotipo-famiq.png" alt="Famiq" />
        )}
      </header>
      <div className="regla-marca" />
    </>
  );
}

/** La barra destacada se ancla al pie de su hoja: así está en las dos fichas reales. */
function separarPie(bloques: Bloque[]): [Bloque[], Bloque[]] {
  const cuerpo: Bloque[] = [];
  const pie: Bloque[] = [];
  for (const b of bloques) {
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
        const [cuerpo, pie] = separarPie(hoja.bloques);
        return (
          <article className="hoja" key={i} data-borrador={borrador}>
            <Cabecera
              hoja={hoja}
              catalogo={datos.catalogo}
              version={datos.version}
              anio={datos.anio}
              esPrimera={i === 0}
            />

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
