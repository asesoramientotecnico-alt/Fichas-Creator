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
  BloqueImagen,
  BloqueListaComponentes,
  BloqueTablaAncha,
  BloqueCodigos,
  MarcaCota,
} from "@/lib/tipos";
import { generarChartSvg, seriesATabla } from "@/lib/chart";

/**
 * Un componente por tipo de bloque de §4. Ninguno acepta HTML libre ni
 * estilos del usuario: sólo eligen entre los tipos que existen, y cada
 * tipo trae su estética fija.
 */

/** Filas de la grilla que ocupa el bloque, si ocupa más de una. */
function filasDe(bloque: { filasGrilla?: number }): string | undefined {
  return bloque.filasGrilla && bloque.filasGrilla > 1 ? String(bloque.filasGrilla) : undefined;
}

/**
 * Los símbolos de cota colocados sobre una imagen.
 *
 * La posición viene del bloque en porcentaje; la apariencia la fija el CSS y no
 * hay forma de cambiarla desde el contenido. Cada marca lleva su índice en un
 * atributo para que el editor pueda arrastrarla; en el PDF el atributo es
 * inerte.
 */
function MarcasDeCota({ marcas }: { marcas?: MarcaCota[] }) {
  const conSimbolo = (marcas ?? []).filter((m) => m.simbolo.trim());
  if (conSimbolo.length === 0) return null;
  return (
    <div className="marcas-cota">
      {conSimbolo.map((m, i) => (
        <span
          className="marca-cota"
          key={i}
          data-marca-indice={i}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
        >
          {m.simbolo}
        </span>
      ))}
    </div>
  );
}

function Etiqueta({ children, tono }: { children: string; tono?: "gris" }) {
  return (
    <p className="bloque-etiqueta" data-tono={tono}>
      {children}
    </p>
  );
}

/**
 * Rótulo de sección con su regla de 2px y el sufijo opcional a la derecha.
 * Es el encabezado de la V26 y lo comparten todos los bloques con rótulo.
 */
function Encabezado({ etiqueta, sufijo }: { etiqueta: string; sufijo?: string }) {
  return (
    <div className="bloque-encabezado">
      <p className="bloque-etiqueta">{etiqueta}</p>
      {sufijo ? <span className="sufijo">{sufijo}</span> : null}
    </div>
  );
}

export function Header({ bloque, fotoSrc }: { bloque: BloqueHeader; fotoSrc?: string }) {
  return (
    <section className="bloque bloque-header"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <div>
        <h1>{bloque.tituloEs}</h1>
        {bloque.subtituloEn ? <p className="nombre-en">{bloque.subtituloEn}</p> : null}
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
    <section
      className="bloque bloque-tabla-kv"
      data-bloque-id={bloque.id}
      data-ancho={bloque.ancho ?? "medio"}
      data-orientacion={bloque.orientacion ?? "horizontal"}
    >
      <Encabezado etiqueta={bloque.etiqueta} sufijo={bloque.sufijo} />
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
    <section className="bloque bloque-par-texto"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
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
    <section className="bloque bloque-tabla"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <Encabezado etiqueta={bloque.etiqueta} sufijo={bloque.sufijo} />
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
    <section className="bloque bloque-inline-kv"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <span className="etiqueta">{bloque.etiqueta}</span>
      <span className="valor">{bloque.valor}</span>
    </section>
  );
}

export function TextoRico({ bloque }: { bloque: BloqueTextoRico }) {
  return (
    <section className="bloque bloque-texto-rico"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "medio"}
      data-columnas={bloque.columnas === 2 ? "2" : undefined}>
      <Encabezado etiqueta={bloque.etiqueta} />
      {/* El rótulo queda arriba, a ancho completo: son los párrafos los que se
          reparten en columnas, no la sección entera. */}
      <div className="cuerpo-texto">
        {bloque.parrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}

export function Chips({ bloque }: { bloque: BloqueChips }) {
  return (
    <section className="bloque bloque-chips"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "medio"}>
      <Encabezado etiqueta={bloque.etiqueta} />
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
    <section className="bloque bloque-croquis"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <div className="marco">
        <div className="lienzo-cotas">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="Croquis dimensional" />
          ) : (
            <div aria-hidden="true" />
          )}
          <MarcasDeCota marcas={bloque.marcas} />
        </div>
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
    <section className="bloque bloque-tabla-dim"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
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
    <section className="bloque bloque-barra-destacada"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <div className="banda">
        <span className="etiqueta">{bloque.etiqueta}</span>
        <span className="valor">{bloque.valor}</span>
      </div>
    </section>
  );
}

export function Imagen({ bloque, src }: { bloque: BloqueImagen; src?: string }) {
  return (
    <section
      className="bloque bloque-imagen"
      data-bloque-id={bloque.id}
      data-ancho={bloque.ancho ?? "medio"}
      data-filas={filasDe(bloque)}
      data-marco={bloque.marco ? "true" : undefined}
    >
      {bloque.etiqueta ? (
        <Encabezado etiqueta={bloque.etiqueta} sufijo={bloque.sufijo} />
      ) : null}
      <div className="cuadro">
        <div className="lienzo-cotas">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={bloque.alt} />
          ) : (
            <div aria-hidden="true" />
          )}
          <MarcasDeCota marcas={bloque.marcas} />
        </div>
      </div>
    </section>
  );
}

/**
 * La lista se reparte en dos columnas del mismo alto: con diecisiete ítems
 * en una sola columna la tabla ocuparía media hoja y dejaría el resto vacío.
 * El corte es por mitades para que la numeración siga leyéndose de arriba a
 * abajo en cada columna.
 */
export function ListaComponentes({ bloque }: { bloque: BloqueListaComponentes }) {
  const corte = Math.ceil(bloque.items.length / 2);
  const mitades = [bloque.items.slice(0, corte), bloque.items.slice(corte)].filter(
    (m) => m.length > 0,
  );

  return (
    <section className="bloque bloque-lista-componentes"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <Encabezado etiqueta={bloque.etiqueta} sufijo={bloque.sufijo} />
      <div className="columnas">
        {mitades.map((mitad, i) => (
          <table className="tabla-banda" key={i}>
            <colgroup>
              <col className="c-item" />
              <col className="c-componente" />
              <col className="c-material" />
              <col className="c-cantidad" />
            </colgroup>
            <thead>
              <tr>
                <th>{bloque.columnas.item}</th>
                <th>{bloque.columnas.componente}</th>
                <th>{bloque.columnas.material}</th>
                <th data-alineacion="derecha">{bloque.columnas.cantidad}</th>
              </tr>
            </thead>
            <tbody>
              {mitad.map((item, j) => (
                <tr key={j}>
                  <td className="item">{item.n}</td>
                  <td className="componente">{item.componente}</td>
                  <td>{item.material}</td>
                  <td data-alineacion="derecha">{item.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}

export function TablaAncha({ bloque }: { bloque: BloqueTablaAncha }) {
  return (
    <section className="bloque bloque-tabla-ancha"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <Encabezado etiqueta={bloque.etiqueta} sufijo={bloque.sufijo} />
      <table className="tabla-banda">
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
      {/* La nota define los símbolos de las columnas: sin ella la tabla no se
          puede leer, así que el tipo la exige (ver tipos.ts). */}
      <p className="nota-simbolos">{bloque.nota}</p>
    </section>
  );
}

export function Codigos({ bloque, src }: { bloque: BloqueCodigos; src?: string }) {
  // Por mitades, no por filas: los códigos van ordenados por medida y hay que
  // poder recorrerlos de arriba a abajo en cada columna. La colocación
  // automática de la grilla los intercalaría.
  const corte = Math.ceil(bloque.pares.length / 2);
  const mitades = [bloque.pares.slice(0, corte), bloque.pares.slice(corte)].filter(
    (m) => m.length > 0,
  );

  return (
    <section className="bloque bloque-codigos"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <Encabezado etiqueta={bloque.etiqueta} sufijo={bloque.sufijo} />
      <div className="cuerpo">
        <div>
          <div className="pares">
            {mitades.map((mitad, i) => (
              <div className="columna" key={i}>
                {mitad.map((par, j) => (
                  <div className="par" key={j}>
                    <span className="codigo">{par.codigo}</span>
                    <span className="medida">{par.medida}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {bloque.nota ? <p className="nota">{bloque.nota}</p> : null}
        </div>
        {src ? (
          <div className="figura">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={bloque.alt ?? ""} />
          </div>
        ) : null}
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
    <section className="bloque bloque-chart"
      data-bloque-id={bloque.id} data-ancho={bloque.ancho ?? "completo"}>
      <Encabezado etiqueta={bloque.etiqueta} />
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
    case "imagen":
      return <Imagen bloque={bloque} src={bloque.assetId ? assets?.[bloque.assetId] : undefined} />;
    case "lista-componentes":
      return <ListaComponentes bloque={bloque} />;
    case "tabla-ancha":
      return <TablaAncha bloque={bloque} />;
    case "codigos":
      return <Codigos bloque={bloque} src={bloque.assetId ? assets?.[bloque.assetId] : undefined} />;
    default: {
      // Si se agrega un tipo a §4 sin componente, esto no compila.
      const _exhaustivo: never = bloque;
      return _exhaustivo;
    }
  }
}
