"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Barra de búsqueda y filtros de una lista. El estado vive en la URL, no en el
 * componente: así un filtro se puede compartir por link, sobrevive al refresh y
 * la consulta la sigue haciendo el servidor con `range`, sin traerse la tabla
 * entera al navegador.
 *
 * El texto se escribe con retardo para no disparar una navegación por tecla.
 */

export interface OpcionFiltro {
  /** Nombre del parámetro en la URL. */
  clave: string;
  etiqueta: string;
  opciones: { valor: string; nombre: string }[];
}

export default function FiltrosLista({
  marcador = "Buscar…",
  filtros = [],
}: {
  marcador?: string;
  filtros?: OpcionFiltro[];
}) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();

  const [texto, setTexto] = useState(params.get("q") ?? "");
  // Un cambio de URL que no venga del input —volver atrás, limpiar filtros—
  // tiene que reflejarse en el campo.
  const ultimoEnviado = useRef(texto);

  useEffect(() => {
    const enUrl = params.get("q") ?? "";
    if (enUrl !== ultimoEnviado.current) {
      ultimoEnviado.current = enUrl;
      setTexto(enUrl);
    }
  }, [params]);

  const navegar = (cambios: Record<string, string>) => {
    const siguiente = new URLSearchParams(params.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) siguiente.set(clave, valor);
      else siguiente.delete(clave);
    }
    // Cualquier cambio de filtro vuelve a la primera página: quedarse en la
    // página 4 de un resultado que ahora tiene una sola es una pantalla vacía
    // que parece un error.
    siguiente.delete("pag");
    router.push(`${ruta}?${siguiente.toString()}`);
  };

  useEffect(() => {
    if (texto === (params.get("q") ?? "")) return;
    const t = setTimeout(() => {
      ultimoEnviado.current = texto;
      navegar({ q: texto });
    }, 300);
    return () => clearTimeout(t);
    // `navegar` y `params` cambian en cada render; el disparador es el texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const hayFiltro =
    (params.get("q") ?? "") !== "" ||
    filtros.some((f) => (params.get(f.clave) ?? "") !== "");

  return (
    <div className="filtros-lista">
      <div className="campo filtros-lista-buscar">
        <label htmlFor="q">Buscar</label>
        <input
          id="q"
          type="search"
          value={texto}
          placeholder={marcador}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      {filtros.map((f) => (
        <div className="campo" key={f.clave}>
          <label htmlFor={f.clave}>{f.etiqueta}</label>
          <select
            id={f.clave}
            value={params.get(f.clave) ?? ""}
            onChange={(e) => navegar({ [f.clave]: e.target.value })}
          >
            <option value="">Todos</option>
            {f.opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>
      ))}

      {hayFiltro ? (
        <button
          type="button"
          className="boton"
          data-variante="secundario"
          onClick={() => {
            setTexto("");
            ultimoEnviado.current = "";
            navegar(
              Object.fromEntries([
                ["q", ""],
                ...filtros.map((f) => [f.clave, ""] as const),
              ]),
            );
          }}
        >
          Limpiar
        </button>
      ) : null}
    </div>
  );
}
