"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Bloque } from "@/lib/tipos";
import { TIPOS_DISPONIBLES, bloqueVacio } from "@/lib/bloques-nuevos";
import { guardarRevision } from "@/app/acciones-ficha";
import { compararRevisiones, ETIQUETA_CLASE } from "@/lib/diff";
import CamposBloque from "./CamposBloque";
import FichaVista, { type DatosFicha } from "@/components/ficha/FichaVista";
import "./editor.css";

const NOMBRE_TIPO = new Map(TIPOS_DISPONIBLES.map((t) => [t.tipo, t.nombre]));

export default function Editor({
  fichaId,
  bloquesIniciales,
  datosFicha,
  assets,
}: {
  fichaId: string;
  bloquesIniciales: Bloque[];
  datosFicha: Omit<DatosFicha, "hojas">;
  assets?: Record<string, string>;
}) {
  const router = useRouter();
  const [bloques, setBloques] = useState<Bloque[]>(bloquesIniciales);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const [verPrevia, setVerPrevia] = useState(false);

  // El diff contra la revisión cargada muestra en vivo qué se va a registrar.
  const diff = useMemo(
    () => compararRevisiones(bloquesIniciales, bloques),
    [bloquesIniciales, bloques],
  );

  const idsIniciales = useMemo(
    () => new Set(bloquesIniciales.map((b) => b.id)),
    [bloquesIniciales],
  );

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

  const previa: DatosFicha = { ...datosFicha, hojas: [{ bloques }] };

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
              <CamposBloque
                bloque={bloque}
                onChange={(nuevo) => setBloques(bloques.map((b, j) => (j === i ? nuevo : b)))}
              />
            </div>
          </article>
        ))}
      </div>

      <aside className="editor-panel">
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
          <FichaVista datos={previa} assets={assets} />
        </div>
      ) : null}
    </div>
  );
}
