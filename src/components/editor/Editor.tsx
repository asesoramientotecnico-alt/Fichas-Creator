"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnchoBloque, Bloque, TipoBloque } from "@/lib/tipos";
import { TIPOS_DISPONIBLES, bloqueVacio, nuevoId } from "@/lib/bloques-nuevos";
import { guardarRevision } from "@/app/acciones-ficha";
import { compararRevisiones, ETIQUETA_CLASE } from "@/lib/diff";
import { revisarBloques } from "@/lib/validacion";
import {
  conAsset,
  insertarAntesDe as insertarAntesDeEn,
  insertarEn as insertarEnLista,
  moverA as moverAEn,
  moverAntesDe as moverAntesDeEn,
} from "@/lib/orden-bloques";
import { indiceReal, marcasDe, moverMarca } from "@/lib/marcas-cota";
import { useRetardado } from "@/lib/usar-retardado";
import Lienzo from "./Lienzo";
import PaletaBloques from "./PaletaBloques";
import ListaOrden from "./ListaOrden";
import Inspector from "./Inspector";
import type { DatosFicha } from "@/components/ficha/FichaVista";
import type { AssetDisponible } from "@/app/acciones-assets";
import { datosDeCabecera } from "@/lib/ficha-textos";
import "./editor.css";

const NOMBRE_TIPO = new Map(TIPOS_DISPONIBLES.map((t) => [t.tipo, t.nombre]));

/**
 * Editor de una ficha, en tres paneles: los bloques y la paleta a la izquierda,
 * la hoja al centro como lienzo, y los campos del bloque elegido a la derecha.
 *
 * Antes era un formulario largo con la vista previa abajo: se editaba a ciegas y
 * había que scrollear para ver el efecto, reordenar era subir y bajar de a un
 * paso, y el ancho se elegía de un desplegable sin ver a qué correspondía. Acá
 * la hoja es el lugar donde se trabaja.
 *
 * Lo que se puede hacer sigue acotado por §4: elegir entre los tipos que
 * existen y entre las cuatro fracciones de la grilla. Arrastrar es una forma más
 * directa de decir lo mismo, no una libertad nueva.
 */
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
  const [seleccionado, setSeleccionado] = useState<string | null>(
    bloquesIniciales[0]?.id ?? null,
  );
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const [extrayendo, setExtrayendo] = useState(false);
  const [omitido, setOmitido] = useState<string[]>([]);
  const [resumenExtraccion, setResumenExtraccion] = useState<string | null>(null);
  const archivoPdf = useRef<HTMLInputElement>(null);

  // El lienzo repagina midiendo el DOM, así que encadenarlo a cada tecla hacía
  // sentir trabado al editor. Con el retardo, tipear es inmediato.
  const bloquesParaLienzo = useRetardado(bloques, 250);

  const diff = useMemo(
    () => compararRevisiones(bloquesIniciales, bloques),
    [bloquesIniciales, bloques],
  );

  const avisos = useMemo(() => revisarBloques(bloques), [bloques]);

  const idsIniciales = useMemo(
    () => new Set(bloquesIniciales.map((b) => b.id)),
    [bloquesIniciales],
  );

  // La familia y la píldora de unidad de negocio se editan en el bloque header:
  // el lienzo las tiene que seguir en vivo, no sólo mostrar la que trajo el
  // servidor al abrir el editor.
  const datosPrevia = useMemo(() => {
    const cabecera = datosDeCabecera(bloquesParaLienzo, assets ?? {});
    return {
      ...datosFicha,
      familia: cabecera.familia || datosFicha.familia,
      pildoraSrc: cabecera.pildoraSrc ?? datosFicha.pildoraSrc,
      pildoraAlt: cabecera.pildoraAlt ?? datosFicha.pildoraAlt,
    };
  }, [bloquesParaLienzo, assets, datosFicha]);

  // ---------------------------------------------------------------
  // Operaciones sobre el array de bloques
  // ---------------------------------------------------------------

  const moverAntesDe = (id: string, antesDe: string | null) =>
    setBloques((previos) => moverAntesDeEn(previos, id, antesDe));

  const moverA = (id: string, destino: number) =>
    setBloques((previos) => moverAEn(previos, id, destino));

  const insertarEn = (tipo: TipoBloque, indice: number) => {
    const bloque = bloqueVacio(tipo);
    setBloques((previos) => insertarEnLista(previos, bloque, indice));
    setSeleccionado(bloque.id);
  };

  const insertarAntesDe = (tipo: TipoBloque, antesDe: string | null) => {
    const bloque = bloqueVacio(tipo);
    setBloques((previos) => insertarAntesDeEn(previos, bloque, antesDe));
    setSeleccionado(bloque.id);
  };

  const cambiarAncho = (id: string, ancho: AnchoBloque) =>
    setBloques((previos) => previos.map((b) => (b.id === id ? { ...b, ancho } : b)));

  const asignarAsset = (id: string, assetId: string) =>
    setBloques((previos) => conAsset(previos, id, assetId));

  /**
   * Reubica una marca de cota. El índice viene del DOM, donde sólo se dibujan
   * las marcas con símbolo: hay que traducirlo al del array o se movería otra.
   */
  const reubicarMarca = (id: string, indiceVisible: number, x: number, y: number) =>
    setBloques((previos) =>
      previos.map((b) => {
        if (b.id !== id) return b;
        const i = indiceReal(marcasDe(b), indiceVisible);
        return i < 0 ? b : moverMarca(b, i, x, y);
      }),
    );

  const duplicar = (id: string) => {
    const original = bloques.find((b) => b.id === id);
    if (!original) return;
    const copia = { ...original, id: nuevoId(original.tipo) } as Bloque;
    setBloques((previos) => {
      const i = previos.findIndex((b) => b.id === id);
      const siguiente = [...previos];
      siguiente.splice(i + 1, 0, copia);
      return siguiente;
    });
    setSeleccionado(copia.id);
  };

  const eliminar = (id: string) => {
    setBloques((previos) => previos.filter((b) => b.id !== id));
    setSeleccionado((previo) => (previo === id ? null : previo));
  };

  // ---------------------------------------------------------------
  // Cargar desde PDF
  // ---------------------------------------------------------------

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
    setResumenExtraccion(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("pdf", archivo);
      const r = await fetch(`/api/fichas/${fichaId}/extraer`, { method: "POST", body: cuerpo });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos.error ?? "No pudimos leer el PDF.");
        return;
      }
      const nuevos = datos.bloques as Bloque[];
      setBloques(nuevos);
      setSeleccionado(nuevos[0]?.id ?? null);
      setOmitido((datos.omitido ?? []) as string[]);

      const imagenes = (datos.imagenesUsadas ?? 0) as number;
      const partes = [`${nuevos.length} bloque(s)`];
      if (imagenes > 0) {
        partes.push(
          `${imagenes} ${imagenes === 1 ? "imagen" : "imágenes"} del PDF, ya en la librería de la familia`,
        );
      }
      setResumenExtraccion(
        `Se transcribió ${partes.join(" y ")}. Revisá antes de guardar.` +
          (datos.aviso ? ` ${datos.aviso}` : ""),
      );

      if (!comentario) setComentario(`Carga desde PDF: ${archivo.name}`);
    } catch {
      setError("No pudimos leer el PDF. Revisá la conexión y volvé a intentar.");
    } finally {
      setExtrayendo(false);
      if (archivoPdf.current) archivoPdf.current.value = "";
    }
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

  const seleccion = seleccionado ? (bloques.find((b) => b.id === seleccionado) ?? null) : null;

  return (
    <div className="taller">
      <div className="taller-barra">
        <div className="taller-barra-izq">
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
            {extrayendo ? "Leyendo el PDF…" : "Cargar desde PDF"}
          </button>
          <span className="taller-conteo">
            {bloques.length} bloque{bloques.length === 1 ? "" : "s"}
            {diff.hayCambios ? " · con cambios sin guardar" : ""}
          </span>
        </div>
        <button
          className="boton"
          type="button"
          onClick={guardar}
          disabled={guardando || !diff.hayCambios}
        >
          {guardando ? "Guardando…" : "Guardar revisión"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {resumenExtraccion ? <p className="aviso">{resumenExtraccion}</p> : null}

      {omitido.length > 0 ? (
        <div className="aviso">
          <strong>No se transcribió:</strong>
          <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.1rem" }}>
            {omitido.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="taller-paneles">
        <aside className="taller-izq">
          <ListaOrden
            bloques={bloques}
            seleccionado={seleccionado}
            nuevos={new Set(bloques.filter((b) => !idsIniciales.has(b.id)).map((b) => b.id))}
            onSeleccionar={setSeleccionado}
            onMover={moverA}
            onSoltarTipo={(tipo, destino) => insertarEn(tipo, destino)}
          />
          <PaletaBloques onAgregar={(tipo) => insertarEn(tipo, bloques.length)} />
        </aside>

        <Lienzo
          datos={datosPrevia}
          bloques={bloquesParaLienzo}
          assets={assets}
          producto={producto}
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
          onMover={moverAntesDe}
          onInsertar={insertarAntesDe}
          onAncho={cambiarAncho}
          onAsset={asignarAsset}
          onMarca={reubicarMarca}
        />

        <aside className="taller-der">
          <Inspector
            bloque={seleccion}
            esNuevo={seleccion ? !idsIniciales.has(seleccion.id) : false}
            assetsDisponibles={assetsDisponibles}
            onChange={(nuevo) =>
              setBloques((previos) => previos.map((b) => (b.id === nuevo.id ? nuevo : b)))
            }
            onAncho={(ancho) => seleccion && cambiarAncho(seleccion.id, ancho)}
            onDuplicar={() => seleccion && duplicar(seleccion.id)}
            onEliminar={() => seleccion && eliminar(seleccion.id)}
          />

          <div className="taller-guardar">
            {avisos.length > 0 ? (
              <div className="aviso">
                <strong>Revisá antes de guardar:</strong>
                <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.1rem" }}>
                  {avisos.map((a) => (
                    <li key={`${a.bloqueId}-${a.mensaje}`}>
                      <button
                        type="button"
                        className="enlace-aviso"
                        onClick={() => setSeleccionado(a.bloqueId)}
                      >
                        {a.mensaje}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <h3>Cambios sin guardar</h3>
            {diff.hayCambios ? (
              <ul className="lista-cambios">
                {diff.cambios.map((c) => (
                  <li key={`${c.clase}-${c.bloqueId}`}>
                    <strong>{ETIQUETA_CLASE[c.clase]}</strong>: {NOMBRE_TIPO.get(c.tipo) ?? c.tipo}
                    {c.campos.length ? ` · ${c.campos.length} campo(s)` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="paleta-vacia">Todavía no cambiaste nada.</p>
            )}

            <div className="campo">
              <label htmlFor="comentario">Comentario de la revisión</label>
              <textarea
                id="comentario"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Qué corregiste y por qué"
              />
            </div>

            <p className="aviso">
              Guardar crea una revisión nueva. Las anteriores no se modifican ni se borran.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
