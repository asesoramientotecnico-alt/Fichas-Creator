"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnchoBloque, Bloque } from "@/lib/tipos";
import { anchoDe } from "@/lib/paginado";
import { TIPOS_DISPONIBLES, bloqueVacio } from "@/lib/bloques-nuevos";
import { guardarRevision } from "@/app/acciones-ficha";
import { compararRevisiones, ETIQUETA_CLASE } from "@/lib/diff";
import CamposBloque from "./CamposBloque";
import FichaPaginada from "@/components/ficha/FichaPaginada";
import type { DatosFicha } from "@/components/ficha/FichaVista";
import type { AssetDisponible } from "@/app/acciones-assets";
import { datosDeCabecera } from "@/lib/ficha-textos";
import "./editor.css";

const NOMBRE_TIPO = new Map(TIPOS_DISPONIBLES.map((t) => [t.tipo, t.nombre]));

const ANCHOS: { valor: AnchoBloque; nombre: string }[] = [
  { valor: "completo", nombre: "Ancho completo" },
  { valor: "dos-tercios", nombre: "Dos tercios" },
  { valor: "medio", nombre: "Media hoja" },
  { valor: "un-tercio", nombre: "Un tercio" },
];

export default function Editor({
  fichaId,
  bloquesIniciales,
  datosFicha,
  producto,
  assets,
  assetsDisponibles = [],
}: {
  fichaId: string;
  bloquesIniciales: Bloque[];
  datosFicha: Omit<DatosFicha, "hojas">;
  /** Nombre del producto: va en rojo en la cabecera de las hojas interiores. */
  producto: string;
  assets?: Record<string, string>;
  /** Librería de la familia: es de donde se eligen las imágenes de los bloques. */
  assetsDisponibles?: AssetDisponible[];
}) {
  const router = useRouter();
  const [bloques, setBloques] = useState<Bloque[]>(bloquesIniciales);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const [verPrevia, setVerPrevia] = useState(false);
  const [extrayendo, setExtrayendo] = useState(false);
  const [omitido, setOmitido] = useState<string[]>([]);
  const archivoPdf = useRef<HTMLInputElement>(null);

  // El diff contra la revisión cargada muestra en vivo qué se va a registrar.
  const diff = useMemo(
    () => compararRevisiones(bloquesIniciales, bloques),
    [bloquesIniciales, bloques],
  );

  const idsIniciales = useMemo(
    () => new Set(bloquesIniciales.map((b) => b.id)),
    [bloquesIniciales],
  );

  // La familia y la píldora de unidad de negocio se editan en el bloque
  // header: la vista previa las tiene que seguir en vivo, no sólo mostrar la
  // que trajo el servidor al abrir el editor.
  const datosPrevia = useMemo(() => {
    const cabecera = datosDeCabecera(bloques, assets ?? {});
    return {
      ...datosFicha,
      familia: cabecera.familia || datosFicha.familia,
      pildoraSrc: cabecera.pildoraSrc ?? datosFicha.pildoraSrc,
      pildoraAlt: cabecera.pildoraAlt ?? datosFicha.pildoraAlt,
    };
  }, [bloques, assets, datosFicha]);

  /**
   * Transcribe un PDF a bloques y los carga en el editor SIN guardar: el
   * borrador queda para revisar, y la revisión la crea la persona al guardar.
   * Reemplaza lo que haya en pantalla, así que se pide confirmación si ya hay
   * bloques cargados.
   */
  const extraerDesdePdf = async (archivo: File) => {
    if (
      bloques.length > 0 &&
      !window.confirm(
        `La ficha ya tiene ${bloques.length} bloque(s) en pantalla. ` +
          "Cargar el PDF los reemplaza. ¿Seguimos?",
      )
    ) {
      return;
    }

    setExtrayendo(true);
    setError(null);
    setOmitido([]);
    try {
      const cuerpo = new FormData();
      cuerpo.append("pdf", archivo);
      const r = await fetch(`/api/fichas/${fichaId}/extraer`, { method: "POST", body: cuerpo });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos.error ?? "No pudimos leer el PDF.");
        return;
      }
      setBloques(datos.bloques as Bloque[]);
      setOmitido((datos.omitido ?? []) as string[]);
      if (!comentario) setComentario(`Carga desde PDF: ${archivo.name}`);
    } catch {
      setError("No pudimos leer el PDF. Revisá la conexión y volvé a intentar.");
    } finally {
      setExtrayendo(false);
      if (archivoPdf.current) archivoPdf.current.value = "";
    }
  };

  const mover = (indice: number, delta: number) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= bloques.length) return;
    const copia = [...bloques];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setBloques(copia);
  };

  const guardar = () => {
    setError(null);
    iniciarGuardado(async () => {
      const r = await guardarRevision(fichaId, bloques, comentario);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.push(`/fichas/${fichaId}`);
      router.refresh();
    });
  };

  return (
    <div className="editor">
      <div className="editor-lista">
        {bloques.length === 0 ? (
          <p className="vacio">La ficha no tiene bloques. Agregá el primero desde el panel.</p>
        ) : null}

        {bloques.map((bloque, i) => (
          <article
            className="bloque-editor"
            key={bloque.id}
            data-nuevo={!idsIniciales.has(bloque.id)}
          >
            <header>
              <span className="tipo">
                {NOMBRE_TIPO.get(bloque.tipo) ?? bloque.tipo}
                {!idsIniciales.has(bloque.id) ? " · nuevo" : ""}
              </span>
              <div className="acciones-bloque">
                <button type="button" className="icono" title="Subir" aria-label="Subir"
                  disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
                <button type="button" className="icono" title="Bajar" aria-label="Bajar"
                  disabled={i === bloques.length - 1} onClick={() => mover(i, 1)}>↓</button>
                <button type="button" className="icono" data-peligro="true" title="Eliminar bloque"
                  aria-label="Eliminar bloque"
                  onClick={() => setBloques(bloques.filter((_, j) => j !== i))}>×</button>
              </div>
            </header>
            <div className="cuerpo">
              {/* El ancho es lo único de la maqueta que el usuario decide, y
                  sólo entre las cuatro fracciones de la grilla de 12 pistas.
                  Cualquier otro valor rompería la alineación de columnas. */}
              <div className="campo">
                <label htmlFor={`ancho-${bloque.id}`}>Ancho en la hoja</label>
                <select
                  id={`ancho-${bloque.id}`}
                  value={anchoDe(bloque)}
                  onChange={(e) =>
                    setBloques(
                      bloques.map((b, j) =>
                        j === i ? { ...b, ancho: e.target.value as AnchoBloque } : b,
                      ),
                    )
                  }
                >
                  {ANCHOS.map((a) => (
                    <option key={a.valor} value={a.valor}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <CamposBloque
                bloque={bloque}
                assetsDisponibles={assetsDisponibles}
                onChange={(nuevo) => setBloques(bloques.map((b, j) => (j === i ? nuevo : b)))}
              />
            </div>
          </article>
        ))}
      </div>

      <aside className="editor-panel">
        <div>
          <h2>Cargar desde PDF</h2>
          <p style={{ fontSize: "var(--fs-micro)", color: "var(--fg-3)", margin: "var(--space-2) 0" }}>
            Transcribe un PDF de ficha a bloques. No guarda nada: el resultado
            queda en pantalla para que lo revises antes de crear la revisión.
          </p>
          <input
            ref={archivoPdf}
            id="pdf-origen"
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void extraerDesdePdf(archivo);
            }}
          />
          <button
            type="button"
            className="boton"
            data-variante="secundario"
            disabled={extrayendo || guardando}
            onClick={() => archivoPdf.current?.click()}
          >
            {extrayendo ? "Leyendo el PDF…" : "Elegir PDF…"}
          </button>
          {omitido.length > 0 ? (
            <div className="aviso" style={{ marginTop: "var(--space-3)" }}>
              <strong>No se transcribió:</strong>
              <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.1rem" }}>
                {omitido.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div>
          <h2>Agregar bloque</h2>
          <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            {TIPOS_DISPONIBLES.map((t) => (
              <button key={t.tipo} type="button" className="tipo-opcion"
                onClick={() => setBloques([...bloques, bloqueVacio(t.tipo)])}>
                <span className="nombre">{t.nombre}</span>
                <span className="desc">{t.descripcion}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2>Cambios sin guardar</h2>
          {diff.hayCambios ? (
            <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.1rem", fontSize: "var(--fs-micro)" }}>
              {diff.cambios.map((c) => (
                <li key={`${c.clase}-${c.bloqueId}`}>
                  <strong>{ETIQUETA_CLASE[c.clase]}</strong>: {NOMBRE_TIPO.get(c.tipo) ?? c.tipo}
                  {c.campos.length ? ` · ${c.campos.length} campo(s)` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: "var(--fs-micro)", color: "var(--fg-3)", marginTop: "var(--space-2)" }}>
              Todavía no cambiaste nada.
            </p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="comentario">Comentario de la revisión</label>
          <textarea id="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)}
            placeholder="Qué corregiste y por qué" />
        </div>

        {error ? <p className="error">{error}</p> : null}

        <p className="aviso">
          Guardar crea una revisión nueva. Las anteriores no se modifican ni se borran.
        </p>

        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <button className="boton" type="button" onClick={guardar}
            disabled={guardando || !diff.hayCambios}>
            {guardando ? "Guardando…" : "Guardar revisión"}
          </button>
          <button className="boton" data-variante="secundario" type="button"
            onClick={() => setVerPrevia((v) => !v)}>
            {verPrevia ? "Ocultar vista previa" : "Ver vista previa"}
          </button>
        </div>
      </aside>

      {verPrevia ? (
        <div style={{ gridColumn: "1 / -1", background: "var(--famiq-grey-200)", padding: "8mm", display: "flex", justifyContent: "center" }}>
          <FichaPaginada
            datos={datosPrevia}
            bloques={bloques}
            assets={assets}
            tituloInterior="Tabla de cotas y dimensiones"
            antetitulo={producto}
          />
        </div>
      ) : null}
    </div>
  );
}
