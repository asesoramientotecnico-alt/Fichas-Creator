import type {
  Bloque,
  BloqueHeader,
  BloqueTablaKv,
  BloqueParTexto,
  BloqueTabla,
  BloqueInlineKv,
  BloqueTextoRico,
  BloqueChips,
  BloqueCroquis,
  BloqueTablaDim,
  BloqueBarraDestacada,
  BloqueChart,
} from "@/lib/tipos";
import { generarChartSvg, seriesATabla } from "@/lib/chart";

/**
 * Un componente por tipo de bloque de §4. Ninguno acepta HTML libre ni
 * estilos del usuario: sólo eligen entre los tipos que existen, y cada
 * tipo trae su estética fija.
 */

function Etiqueta({ children, tono }: { children: string; tono?: "gris" }) {
  return (
    <p className="bloque-etiqueta" data-tono={tono}>
      {children}
    </p>
  );
}

export function Header({ bloque, fotoSrc }: { bloque: BloqueHeader; fotoSrc?: string }) {
  return (
    <section className="bloque bloque-header" data-ancho="completo">
      <div className="titulos">
        <div className="acento" aria-hidden="true" />
        <div>
          <h1>{bloque.tituloEs}</h1>
          {bloque.subtituloEn ? <p className="nombre-en">{bloque.subtituloEn}</p> : null}
        </div>
      </div>
      {fotoSrc ? (
        <div className="foto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoSrc} alt={bloque.tituloEs} />
        </div>
      ) : (
        <div className="foto" aria-hidden="true" />
      )}
    </section>
  );
}

export function TablaKv({ bloque }: { bloque: BloqueTablaKv }) {
  return (
    <section className="bloque bloque-tabla-kv" data-ancho={bloque.ancho ?? "medio"}>
      <Etiqueta>{bloque.etiqueta}</Etiqueta>
      {bloque.filas.map((fila, i) => (
        <div className="fila" key={i}>
          <span className="label">{fila.label}</span>
          <span className="value">{fila.value}</span>
        </div>
      ))}
    </section>
  );
}

export function ParTexto({ bloque }: { bloque: BloqueParTexto }) {
  return (
    <section className="bloque bloque-par-texto" data-ancho={bloque.ancho ?? "completo"}>
      {[bloque.izquierda, bloque.derecha].map((lado, i) => (
        <div key={i}>
          <Etiqueta tono="gris">{lado.etiqueta}</Etiqueta>
          <p>{lado.texto}</p>
        </div>
      ))}
    </section>
  );
}

export function Tabla({ bloque }: { bloque: BloqueTabla }) {
  return (
    <section className="bloque bloque-tabla" data-ancho={bloque.ancho ?? "completo"}>
      <Etiqueta>{bloque.etiqueta}</Etiqueta>
      <table className="tabla-datos">
        <thead>
          <tr>
            {bloque.columnas.map((col, i) => (
              <th key={i} data-alineacion={col.alineacion ?? "izquierda"}>
                {col.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloque.filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => (
                <td key={j} data-alineacion={bloque.columnas[j]?.alineacion ?? "izquierda"}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function InlineKv({ bloque }: { bloque: BloqueInlineKv }) {
  return (
    <section className="bloque bloque-inline-kv" data-ancho={bloque.ancho ?? "completo"}>
      <span className="etiqueta">{bloque.etiqueta}</span>
      <span className="valor">{bloque.valor}</span>
    </section>
  );
}

export function TextoRico({ bloque }: { bloque: BloqueTextoRico }) {
  return (
    <section className="bloque bloque-texto-rico" data-ancho={bloque.ancho ?? "medio"}>
      <Etiqueta>{bloque.etiqueta}</Etiqueta>
      {bloque.parrafos.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </section>
  );
}

export function Chips({ bloque }: { bloque: BloqueChips }) {
  return (
    <section className="bloque bloque-chips" data-ancho={bloque.ancho ?? "medio"}>
      <Etiqueta>{bloque.etiqueta}</Etiqueta>
      <div className="items">
        {bloque.items.map((item, i) => (
          <span className="chip" key={i}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

export function Croquis({ bloque, src }: { bloque: BloqueCroquis; src?: string }) {
  return (
    <section className="bloque bloque-croquis" data-ancho={bloque.ancho ?? "completo"}>
      <div className="marco">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Croquis dimensional" />
        ) : (
          <div aria-hidden="true" />
        )}
        <div className="cotas">
          {bloque.cotas.map((cota, i) => (
            <div className="cota" key={i}>
              <span className="simbolo">{cota.simbolo}</span>
              <span>{cota.nombre}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TablaDim({ bloque }: { bloque: BloqueTablaDim }) {
  return (
    <section className="bloque bloque-tabla-dim" data-ancho={bloque.ancho ?? "completo"}>
      <div className="tablas">
        {bloque.tablas.map((tabla, i) => (
          <div key={i}>
            <div className="encabezado">
              <p className="bloque-etiqueta">{tabla.etiqueta}</p>
              <span className="unidad">{tabla.unidad}</span>
            </div>
            <table className="tabla-datos">
              <thead>
                <tr>
                  {tabla.columnas.map((col, j) => (
                    <th key={j}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabla.filas.map((fila, j) => (
                  <tr key={j}>
                    {fila.map((celda, k) => (
                      <td key={k}>{celda}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BarraDestacada({ bloque }: { bloque: BloqueBarraDestacada }) {
  return (
    <section className="bloque bloque-barra-destacada" data-ancho={bloque.ancho ?? "completo"}>
      <div className="banda">
        <span className="etiqueta">{bloque.etiqueta}</span>
        <span className="valor">{bloque.valor}</span>
      </div>
    </section>
  );
}

/**
 * El SVG se genera en el servidor y se inyecta como markup: es determinístico
 * y no lleva scripts (§7). Los datos van además como tabla, para que la
 * identidad de cada serie no dependa sólo del color.
 */
export function Chart({ bloque }: { bloque: BloqueChart }) {
  const svg = generarChartSvg({
    series: bloque.series,
    etiquetaX: bloque.etiquetaX,
    etiquetaY: bloque.etiquetaY,
  });
  const tabla = seriesATabla(bloque.series, bloque.etiquetaX || "x");

  return (
    <section className="bloque bloque-chart" data-ancho={bloque.ancho ?? "completo"}>
      <Etiqueta>{bloque.etiqueta}</Etiqueta>
      <div className="grafico" dangerouslySetInnerHTML={{ __html: svg }} />
      {tabla.filas.length > 0 ? (
        <table className="tabla-datos tabla-grafico">
          <thead>
            <tr>
              {tabla.columnas.map((c, i) => (
                <th key={i} data-alineacion={i === 0 ? "izquierda" : "derecha"}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j} data-alineacion={j === 0 ? "izquierda" : "derecha"}>
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

export function RenderBloque({
  bloque,
  assets,
}: {
  bloque: Bloque;
  assets?: Record<string, string>;
}) {
  switch (bloque.tipo) {
    case "header":
      return <Header bloque={bloque} fotoSrc={bloque.fotoAssetId ? assets?.[bloque.fotoAssetId] : undefined} />;
    case "tabla-kv":
      return <TablaKv bloque={bloque} />;
    case "par-texto":
      return <ParTexto bloque={bloque} />;
    case "tabla":
      return <Tabla bloque={bloque} />;
    case "inline-kv":
      return <InlineKv bloque={bloque} />;
    case "texto-rico":
      return <TextoRico bloque={bloque} />;
    case "chips":
      return <Chips bloque={bloque} />;
    case "croquis":
      return <Croquis bloque={bloque} src={bloque.assetId ? assets?.[bloque.assetId] : undefined} />;
    case "tabla-dim":
      return <TablaDim bloque={bloque} />;
    case "barra-destacada":
      return <BarraDestacada bloque={bloque} />;
    case "chart":
      return <Chart bloque={bloque} />;
    default: {
      // Si se agrega un tipo a §4 sin componente, esto no compila.
      const _exhaustivo: never = bloque;
      return _exhaustivo;
    }
  }
}
