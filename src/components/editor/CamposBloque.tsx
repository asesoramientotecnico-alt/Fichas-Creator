"use client";

import { useId } from "react";
import type { Bloque, AssetTipo, MarcaCota } from "@/lib/tipos";
import type { AssetDisponible } from "@/app/acciones-assets";
import { UNIDADES_NEGOCIO } from "@/lib/unidades-negocio";
import { posicionInicial } from "@/lib/marcas-cota";

/** Editores de campo por tipo de bloque. Ninguno acepta HTML ni estilos. */

/**
 * Símbolos colocados encima de la imagen. Acá se agregan, se nombran y se
 * borran; la POSICIÓN se da arrastrándolos sobre la hoja, que es la única forma
 * razonable de decir "esta cota va acá".
 *
 * No hay campo para el tipo de letra, el cuerpo ni el color: eso lo fija
 * `ficha.css` (ver MarcaCota en tipos.ts).
 */
function MarcasEncima({
  marcas,
  onChange,
}: {
  marcas: MarcaCota[];
  onChange: (marcas: MarcaCota[]) => void;
}) {
  return (
    <div className="campo">
      <label>Símbolos sobre la imagen</label>
      <p className="paleta-vacia">
        {marcas.length === 0
          ? "Agregá un símbolo y arrastralo sobre la hoja hasta el punto que mide."
          : "Arrastrá cada símbolo sobre la hoja para ubicarlo."}
      </p>
      <div className="sub-lista">
        {marcas.map((m, i) => (
          <div className="fila-lista" key={i}>
            <div className="fila-campos" style={{ gridTemplateColumns: "1fr 76px" }}>
              <input
                value={m.simbolo}
                placeholder="Ød"
                aria-label={`Símbolo ${i + 1}`}
                onChange={(e) =>
                  onChange(marcas.map((o, j) => (j === i ? { ...o, simbolo: e.target.value } : o)))
                }
              />
              <span className="marca-posicion">
                {Math.round(m.x)}% · {Math.round(m.y)}%
              </span>
            </div>
            <BotonQuitar
              titulo="Quitar símbolo"
              onClick={() => onChange(marcas.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <BotonAgregar
        onClick={() => onChange([...marcas, { simbolo: "", ...posicionInicial(marcas.length) }])}
      >
        Agregar símbolo sobre la imagen
      </BotonAgregar>
    </div>
  );
}

function Texto({
  etiqueta, valor, onChange, multilinea, placeholder,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  multilinea?: boolean;
  placeholder?: string;
}) {
  // El label tiene que apuntar a su campo: sin htmlFor no lo anuncia un lector
  // de pantalla ni lo encuentra una prueba por etiqueta.
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {multilinea ? (
        <textarea id={id} value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function Opcion({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  opciones: { valor: string; nombre: string }[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Elige una imagen de la librería de la familia (§7). No se sube desde acá: el
 * asset se carga una vez en la familia y todas sus fichas lo reusan.
 */
function SelectorAsset({
  etiqueta,
  valor,
  disponibles,
  tipo,
  onChange,
}: {
  etiqueta: string;
  valor: string | undefined;
  disponibles: AssetDisponible[];
  tipo?: AssetTipo;
  onChange: (v: string | undefined) => void;
}) {
  const id = useId();
  const opciones = tipo ? disponibles.filter((a) => a.tipo === tipo) : disponibles;

  if (opciones.length === 0) {
    return (
      <p className="aviso">
        La familia de este producto no tiene imágenes cargadas todavía. Subilas en la ficha de la
        familia y volvé a elegirlas acá.
      </p>
    );
  }

  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">Sin imagen</option>
        {opciones.map((a) => (
          <option key={a.id} value={a.id}>
            {a.alt || `${a.tipo} sin descripción`}
          </option>
        ))}
      </select>
    </div>
  );
}

function BotonQuitar({ onClick, titulo }: { onClick: () => void; titulo: string }) {
  return (
    <button type="button" className="icono" data-peligro="true" onClick={onClick} title={titulo} aria-label={titulo}>
      ×
    </button>
  );
}

function BotonAgregar({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" className="boton" data-variante="secundario" onClick={onClick}>
      {children}
    </button>
  );
}

export default function CamposBloque({
  bloque,
  onChange,
  assetsDisponibles = [],
}: {
  bloque: Bloque;
  onChange: (b: Bloque) => void;
  assetsDisponibles?: AssetDisponible[];
}) {
  // Cada rama devuelve una copia con el campo cambiado: nunca se muta el
  // bloque original, para que el diff pueda comparar contra la revisión previa.
  const set = <T extends Bloque>(cambios: Partial<T>) => onChange({ ...bloque, ...cambios } as Bloque);

  switch (bloque.tipo) {
    case "header":
      return (
        <>
          <Texto etiqueta="Línea (el texto gris debajo de la píldora)" valor={bloque.familia}
            placeholder="Consumibles industriales" onChange={(v) => set({ familia: v })} />
          <Texto etiqueta="Subfamilia" valor={bloque.subfamilia} onChange={(v) => set({ subfamilia: v })} />
          <Texto etiqueta="Título (castellano)" valor={bloque.tituloEs} onChange={(v) => set({ tituloEs: v })} />
          <Texto etiqueta="Subtítulo (inglés)" valor={bloque.subtituloEn ?? ""} onChange={(v) => set({ subtituloEn: v })} />
          <Opcion
            etiqueta="Unidad de negocio"
            valor={bloque.pildoraAssetId ?? ""}
            opciones={[
              { valor: "", nombre: "Sin píldora" },
              ...UNIDADES_NEGOCIO.map((u) => ({ valor: u.id, nombre: u.nombre })),
            ]}
            onChange={(v) => {
              const unidad = UNIDADES_NEGOCIO.find((u) => u.id === v);
              set({ pildoraAssetId: v || undefined, pildoraAlt: unidad?.nombre });
            }}
          />
          <SelectorAsset
            etiqueta="Foto de producto" tipo="foto" valor={bloque.fotoAssetId}
            disponibles={assetsDisponibles} onChange={(v) => set({ fotoAssetId: v })}
          />
        </>
      );

    case "tabla-kv":
      return (
        <>
          <Texto etiqueta="Etiqueta de la sección" valor={bloque.etiqueta} onChange={(v) => set({ etiqueta: v })} />
          <Texto etiqueta="Sufijo (opcional)" valor={bloque.sufijo ?? ""} placeholder='Ej. 1/4" – 4"'
            onChange={(v) => set({ sufijo: v })} />
          <Opcion
            etiqueta="Disposición"
            valor={bloque.orientacion ?? "horizontal"}
            opciones={[
              { valor: "horizontal", nombre: "Rótulo a la izquierda del valor" },
              { valor: "vertical", nombre: "Rótulo arriba del valor (columna angosta)" },
            ]}
            onChange={(v) => set({ orientacion: v as "horizontal" | "vertical" })}
          />
          <div className="sub-lista">
            {bloque.filas.map((fila, i) => (
              <div className="fila-lista" key={i}>
                <div className="fila-campos" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
                  <input
                    value={fila.label} placeholder="Etiqueta"
                    onChange={(e) => {
                      const filas = bloque.filas.map((f, j) => (j === i ? { ...f, label: e.target.value } : f));
                      set({ filas });
                    }}
                  />
                  <input
                    value={fila.value} placeholder="Valor"
                    onChange={(e) => {
                      const filas = bloque.filas.map((f, j) => (j === i ? { ...f, value: e.target.value } : f));
                      set({ filas });
                    }}
                  />
                </div>
                <BotonQuitar titulo="Quitar fila" onClick={() => set({ filas: bloque.filas.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({ filas: [...bloque.filas, { label: "", value: "" }] })}>
            Agregar fila
          </BotonAgregar>
        </>
      );

    case "par-texto":
      return (
        <>
          <Texto etiqueta="Etiqueta izquierda" valor={bloque.izquierda.etiqueta}
            onChange={(v) => set({ izquierda: { ...bloque.izquierda, etiqueta: v } })} />
          <Texto etiqueta="Texto izquierdo" multilinea valor={bloque.izquierda.texto}
            onChange={(v) => set({ izquierda: { ...bloque.izquierda, texto: v } })} />
          <Texto etiqueta="Etiqueta derecha" valor={bloque.derecha.etiqueta}
            onChange={(v) => set({ derecha: { ...bloque.derecha, etiqueta: v } })} />
          <Texto etiqueta="Texto derecho" multilinea valor={bloque.derecha.texto}
            onChange={(v) => set({ derecha: { ...bloque.derecha, texto: v } })} />
        </>
      );

    case "tabla":
      return (
        <>
          <Texto etiqueta="Etiqueta de la tabla" valor={bloque.etiqueta} onChange={(v) => set({ etiqueta: v })} />
          <Texto etiqueta="Sufijo (opcional)" valor={bloque.sufijo ?? ""} onChange={(v) => set({ sufijo: v })} />
          <p className="campo" style={{ margin: 0 }}><label>Columnas</label></p>
          <div className="sub-lista">
            {bloque.columnas.map((col, i) => (
              <div className="fila-lista" key={i}>
                <input
                  value={col.titulo} placeholder={`Columna ${i + 1}`}
                  onChange={(e) => {
                    const columnas = bloque.columnas.map((c, j) => (j === i ? { ...c, titulo: e.target.value } : c));
                    set({ columnas });
                  }}
                />
                <BotonQuitar titulo="Quitar columna" onClick={() => set({
                  columnas: bloque.columnas.filter((_, j) => j !== i),
                  filas: bloque.filas.map((f) => f.filter((_, j) => j !== i)),
                })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({
            columnas: [...bloque.columnas, { titulo: "" }],
            filas: bloque.filas.map((f) => [...f, ""]),
          })}>Agregar columna</BotonAgregar>

          <p className="campo" style={{ margin: 0 }}><label>Filas</label></p>
          <div className="sub-lista">
            {bloque.filas.map((fila, i) => (
              <div className="fila-lista" key={i}>
                <div className="fila-campos" style={{ gridTemplateColumns: `repeat(${bloque.columnas.length}, 1fr)` }}>
                  {fila.map((celda, j) => (
                    <input
                      key={j} value={celda} placeholder={bloque.columnas[j]?.titulo || `Col ${j + 1}`}
                      onChange={(e) => {
                        const filas = bloque.filas.map((f, fi) =>
                          fi === i ? f.map((c, ci) => (ci === j ? e.target.value : c)) : f);
                        set({ filas });
                      }}
                    />
                  ))}
                </div>
                <BotonQuitar titulo="Quitar fila" onClick={() => set({ filas: bloque.filas.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({ filas: [...bloque.filas, bloque.columnas.map(() => "")] })}>
            Agregar fila
          </BotonAgregar>
        </>
      );

    case "inline-kv":
    case "barra-destacada":
      return (
        <>
          <Texto etiqueta="Etiqueta" valor={bloque.etiqueta} onChange={(v) => set({ etiqueta: v })} />
          <Texto etiqueta="Valor" valor={bloque.valor} onChange={(v) => set({ valor: v })} />
        </>
      );

    case "texto-rico":
      return (
        <>
          <Opcion
            etiqueta="Disposición de los párrafos"
            valor={bloque.columnas === 2 ? "2" : "1"}
            opciones={[
              { valor: "1", nombre: "Uno debajo del otro" },
              { valor: "2", nombre: "En dos columnas" },
            ]}
            onChange={(v) => set({ columnas: v === "2" ? 2 : undefined })}
          />
          <Texto etiqueta="Etiqueta de la sección" valor={bloque.etiqueta} onChange={(v) => set({ etiqueta: v })} />
          <div className="sub-lista">
            {bloque.parrafos.map((p, i) => (
              <div className="fila-lista" key={i}>
                <textarea
                  value={p} placeholder={`Párrafo ${i + 1}`}
                  onChange={(e) => set({ parrafos: bloque.parrafos.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <BotonQuitar titulo="Quitar párrafo" onClick={() => set({ parrafos: bloque.parrafos.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({ parrafos: [...bloque.parrafos, ""] })}>Agregar párrafo</BotonAgregar>
        </>
      );

    case "chips":
      return (
        <>
          <Texto etiqueta="Etiqueta de la sección" valor={bloque.etiqueta} onChange={(v) => set({ etiqueta: v })} />
          <div className="sub-lista">
            {bloque.items.map((item, i) => (
              <div className="fila-lista" key={i}>
                <input
                  value={item} placeholder={`Etiqueta ${i + 1}`}
                  onChange={(e) => set({ items: bloque.items.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <BotonQuitar titulo="Quitar" onClick={() => set({ items: bloque.items.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({ items: [...bloque.items, ""] })}>Agregar etiqueta</BotonAgregar>
        </>
      );

    case "croquis":
      return (
        <>
          <SelectorAsset
            etiqueta="Croquis" tipo="croquis" valor={bloque.assetId}
            disponibles={assetsDisponibles} onChange={(v) => set({ assetId: v })}
          />
          <div className="sub-lista">
            {bloque.cotas.map((cota, i) => (
              <div className="fila-lista" key={i}>
                <div className="fila-campos" style={{ gridTemplateColumns: "70px 1fr" }}>
                  <input
                    value={cota.simbolo} placeholder="d"
                    onChange={(e) => set({ cotas: bloque.cotas.map((c, j) => (j === i ? { ...c, simbolo: e.target.value } : c)) })}
                  />
                  <input
                    value={cota.nombre} placeholder="diámetro nominal"
                    onChange={(e) => set({ cotas: bloque.cotas.map((c, j) => (j === i ? { ...c, nombre: e.target.value } : c)) })}
                  />
                </div>
                <BotonQuitar titulo="Quitar cota" onClick={() => set({ cotas: bloque.cotas.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({ cotas: [...bloque.cotas, { simbolo: "", nombre: "" }] })}>Agregar cota</BotonAgregar>
          <MarcasEncima
            marcas={bloque.marcas ?? []}
            onChange={(marcas) => set({ marcas: marcas.length ? marcas : undefined })}
          />
        </>
      );

    case "tabla-dim":
      return (
        <>
          {bloque.tablas.map((tabla, ti) => (
            <div className="sub-lista" key={ti}>
              <div className="fila-lista">
                <div className="fila-campos" style={{ gridTemplateColumns: "1fr 80px" }}>
                  <input
                    value={tabla.etiqueta} placeholder="Dimensiones métricas"
                    onChange={(e) => set({ tablas: bloque.tablas.map((t, j) => (j === ti ? { ...t, etiqueta: e.target.value } : t)) })}
                  />
                  <input
                    value={tabla.unidad} placeholder="mm"
                    onChange={(e) => set({ tablas: bloque.tablas.map((t, j) => (j === ti ? { ...t, unidad: e.target.value } : t)) })}
                  />
                </div>
                <BotonQuitar titulo="Quitar tabla" onClick={() => set({ tablas: bloque.tablas.filter((_, j) => j !== ti) })} />
              </div>

              <div className="fila-campos" style={{ gridTemplateColumns: `repeat(${tabla.columnas.length}, 1fr)` }}>
                {tabla.columnas.map((col, ci) => (
                  <input
                    key={ci} value={col} placeholder={`Col ${ci + 1}`}
                    onChange={(e) => set({
                      tablas: bloque.tablas.map((t, j) =>
                        j === ti ? { ...t, columnas: t.columnas.map((c, k) => (k === ci ? e.target.value : c)) } : t),
                    })}
                  />
                ))}
              </div>

              {tabla.filas.map((fila, fi) => (
                <div className="fila-lista" key={fi}>
                  <div className="fila-campos" style={{ gridTemplateColumns: `repeat(${tabla.columnas.length}, 1fr)` }}>
                    {fila.map((celda, ci) => (
                      <input
                        key={ci} value={celda}
                        onChange={(e) => set({
                          tablas: bloque.tablas.map((t, j) =>
                            j === ti
                              ? { ...t, filas: t.filas.map((f, k) => (k === fi ? f.map((c, l) => (l === ci ? e.target.value : c)) : f)) }
                              : t),
                        })}
                      />
                    ))}
                  </div>
                  <BotonQuitar titulo="Quitar fila" onClick={() => set({
                    tablas: bloque.tablas.map((t, j) => (j === ti ? { ...t, filas: t.filas.filter((_, k) => k !== fi) } : t)),
                  })} />
                </div>
              ))}

              <BotonAgregar onClick={() => set({
                tablas: bloque.tablas.map((t, j) => (j === ti ? { ...t, filas: [...t.filas, t.columnas.map(() => "")] } : t)),
              })}>Agregar fila</BotonAgregar>
            </div>
          ))}
          <BotonAgregar onClick={() => set({
            tablas: [...bloque.tablas, { etiqueta: "", unidad: "mm", columnas: ["", "", ""], filas: [["", "", ""]] }],
          })}>Agregar tabla</BotonAgregar>
        </>
      );

    case "imagen":
      return (
        <>
          <Texto etiqueta="Etiqueta de la sección (vacía = imagen sin rótulo)"
            valor={bloque.etiqueta ?? ""} onChange={(v) => set({ etiqueta: v })} />
          <Texto etiqueta="Sufijo (opcional)" valor={bloque.sufijo ?? ""} placeholder='Ej. 1/4" – 4"'
            onChange={(v) => set({ sufijo: v })} />
          <Texto etiqueta="Descripción para lectores de pantalla" valor={bloque.alt}
            placeholder="Curva de presión / temperatura" onChange={(v) => set({ alt: v })} />
          <Opcion
            etiqueta="Marco"
            valor={bloque.marco ? "si" : "no"}
            opciones={[
              { valor: "no", nombre: "Sin marco" },
              { valor: "si", nombre: "Con marco" },
            ]}
            onChange={(v) => set({ marco: v === "si" })}
          />
          <SelectorAsset
            etiqueta="Imagen" valor={bloque.assetId}
            disponibles={assetsDisponibles} onChange={(v) => set({ assetId: v })}
          />
          <MarcasEncima
            marcas={bloque.marcas ?? []}
            onChange={(marcas) => set({ marcas: marcas.length ? marcas : undefined })}
          />
        </>
      );

    case "lista-componentes":
      return (
        <>
          <Texto etiqueta="Etiqueta de la sección" valor={bloque.etiqueta} onChange={(v) => set({ etiqueta: v })} />
          <Texto etiqueta="Sufijo (opcional)" valor={bloque.sufijo ?? ""} placeholder="Ítems 1 – 17"
            onChange={(v) => set({ sufijo: v })} />

          <p className="campo" style={{ margin: 0 }}><label>Títulos de columna</label></p>
          <div className="fila-campos" style={{ gridTemplateColumns: "0.6fr 1.4fr 1fr 0.6fr" }}>
            <input value={bloque.columnas.item} placeholder="Ítem"
              onChange={(e) => set({ columnas: { ...bloque.columnas, item: e.target.value } })} />
            <input value={bloque.columnas.componente} placeholder="Componente"
              onChange={(e) => set({ columnas: { ...bloque.columnas, componente: e.target.value } })} />
            <input value={bloque.columnas.material} placeholder="Material"
              onChange={(e) => set({ columnas: { ...bloque.columnas, material: e.target.value } })} />
            <input value={bloque.columnas.cantidad} placeholder="Cant."
              onChange={(e) => set({ columnas: { ...bloque.columnas, cantidad: e.target.value } })} />
          </div>

          <p className="campo" style={{ margin: 0 }}><label>Componentes</label></p>
          <div className="sub-lista">
            {bloque.items.map((item, i) => (
              <div className="fila-lista" key={i}>
                <div className="fila-campos" style={{ gridTemplateColumns: "0.6fr 1.4fr 1fr 0.6fr" }}>
                  {(["n", "componente", "material", "cantidad"] as const).map((campo) => (
                    <input
                      key={campo} value={item[campo]} placeholder={campo === "n" ? "1" : campo}
                      onChange={(e) => set({
                        items: bloque.items.map((x, j) => (j === i ? { ...x, [campo]: e.target.value } : x)),
                      })}
                    />
                  ))}
                </div>
                <BotonQuitar titulo="Quitar componente"
                  onClick={() => set({ items: bloque.items.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({
            items: [...bloque.items, { n: String(bloque.items.length + 1), componente: "", material: "", cantidad: "" }],
          })}>Agregar componente</BotonAgregar>
        </>
      );

    case "tabla-ancha":
      return (
        <>
          <Texto etiqueta="Etiqueta de la sección" valor={bloque.etiqueta} onChange={(v) => set({ etiqueta: v })} />
          <Texto etiqueta="Sufijo (opcional)" valor={bloque.sufijo ?? ""} placeholder="Cotas en mm"
            onChange={(v) => set({ sufijo: v })} />

          <p className="campo" style={{ margin: 0 }}><label>Columnas</label></p>
          <div className="sub-lista">
            {bloque.columnas.map((col, i) => (
              <div className="fila-lista" key={i}>
                <div className="fila-campos" style={{ gridTemplateColumns: "1fr 110px" }}>
                  <input
                    value={col.titulo} placeholder={`Columna ${i + 1}`}
                    onChange={(e) => set({
                      columnas: bloque.columnas.map((c, j) => (j === i ? { ...c, titulo: e.target.value } : c)),
                    })}
                  />
                  <select
                    aria-label={`Alineación de la columna ${i + 1}`}
                    value={col.alineacion ?? "izquierda"}
                    onChange={(e) => set({
                      columnas: bloque.columnas.map((c, j) =>
                        j === i ? { ...c, alineacion: e.target.value as "izquierda" | "derecha" } : c),
                    })}
                  >
                    <option value="izquierda">Izquierda</option>
                    <option value="derecha">Derecha</option>
                  </select>
                </div>
                <BotonQuitar titulo="Quitar columna" onClick={() => set({
                  columnas: bloque.columnas.filter((_, j) => j !== i),
                  filas: bloque.filas.map((f) => f.filter((_, j) => j !== i)),
                })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({
            columnas: [...bloque.columnas, { titulo: "" }],
            filas: bloque.filas.map((f) => [...f, ""]),
          })}>Agregar columna</BotonAgregar>

          <p className="campo" style={{ margin: 0 }}><label>Filas</label></p>
          <div className="sub-lista">
            {bloque.filas.map((fila, i) => (
              <div className="fila-lista" key={i}>
                <div className="fila-campos" style={{ gridTemplateColumns: `repeat(${bloque.columnas.length}, 1fr)` }}>
                  {fila.map((celda, j) => (
                    <input
                      key={j} value={celda} placeholder={bloque.columnas[j]?.titulo || `Col ${j + 1}`}
                      onChange={(e) => set({
                        filas: bloque.filas.map((f, fi) =>
                          fi === i ? f.map((c, ci) => (ci === j ? e.target.value : c)) : f),
                      })}
                    />
                  ))}
                </div>
                <BotonQuitar titulo="Quitar fila"
                  onClick={() => set({ filas: bloque.filas.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({ filas: [...bloque.filas, bloque.columnas.map(() => "")] })}>
            Agregar fila
          </BotonAgregar>

          {/* La nota no es opcional: define qué significa cada símbolo de las
              columnas, y sin ella la tabla no se puede leer. */}
          <Texto etiqueta="Nota que define los símbolos" multilinea valor={bloque.nota}
            placeholder="Ød paso de esfera · ØD diámetro de alojamiento…"
            onChange={(v) => set({ nota: v })} />
        </>
      );

    case "codigos":
      return (
        <>
          <Texto etiqueta="Etiqueta de la sección" valor={bloque.etiqueta} onChange={(v) => set({ etiqueta: v })} />
          <Texto etiqueta="Sufijo (opcional)" valor={bloque.sufijo ?? ""} placeholder="1 kit por válvula"
            onChange={(v) => set({ sufijo: v })} />
          <div className="sub-lista">
            {bloque.pares.map((par, i) => (
              <div className="fila-lista" key={i}>
                <div className="fila-campos" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <input
                    value={par.codigo} placeholder="350834"
                    onChange={(e) => set({ pares: bloque.pares.map((p, j) => (j === i ? { ...p, codigo: e.target.value } : p)) })}
                  />
                  <input
                    value={par.medida} placeholder='1/2"'
                    onChange={(e) => set({ pares: bloque.pares.map((p, j) => (j === i ? { ...p, medida: e.target.value } : p)) })}
                  />
                </div>
                <BotonQuitar titulo="Quitar código"
                  onClick={() => set({ pares: bloque.pares.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <BotonAgregar onClick={() => set({ pares: [...bloque.pares, { codigo: "", medida: "" }] })}>
            Agregar código
          </BotonAgregar>
          <Texto etiqueta="Nota (opcional)" multilinea valor={bloque.nota ?? ""} onChange={(v) => set({ nota: v })} />
          <SelectorAsset
            etiqueta="Imagen" valor={bloque.assetId}
            disponibles={assetsDisponibles} onChange={(v) => set({ assetId: v })}
          />
          <Texto etiqueta="Descripción de la imagen" valor={bloque.alt ?? ""} onChange={(v) => set({ alt: v })} />
        </>
      );

    case "chart":
      return <p className="aviso">El bloque de gráfico se implementa en M6.</p>;
  }
}
