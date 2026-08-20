"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { Bloque } from "@/lib/tipos";
import { repartirEnHojas, tituloDeHoja, type Medidas } from "@/lib/paginado";
import { medirEnDocumento } from "@/lib/medir";
import FichaVista, { type DatosFicha, type Hoja } from "./FichaVista";
import Medidor from "./Medidor";

/**
 * Ficha con el reparto en hojas calculado midiendo en el navegador, igual que
 * el PDF (§3: la misma vista para pantalla y PDF, y acá también el mismo
 * paginado — si midieran distinto, el preview mentiría sobre el PDF).
 *
 * Son dos pasadas: primero se monta el medidor oculto, se leen los altos, y
 * recién entonces se dibuja la ficha repartida. El medidor queda montado para
 * poder volver a medir cuando cambian los bloques o cargan las fuentes.
 */
export default function FichaPaginada({
  datos,
  bloques,
  assets,
  tituloInterior,
  antetitulo,
}: {
  datos: Omit<DatosFicha, "hojas">;
  bloques: Bloque[];
  assets?: Record<string, string>;
  tituloInterior: string;
  antetitulo: string;
}) {
  const [hojas, setHojas] = useState<Hoja[] | null>(null);
  // El medidor renderiza cada bloque una segunda vez, así que se desmonta en
  // cuanto las fuentes cargaron y la medición quedó firme. Con una ficha de
  // muchas filas, dejarlo montado duplicaría el DOM sin ganar nada.
  const [midiendo, setMidiendo] = useState(true);

  /** Mide y reparte. Devuelve false si el medidor todavía no está en el DOM. */
  const medir = useCallback((): boolean => {
    const medidas: Medidas = medirEnDocumento();
    // Sin alto útil no hay nada que repartir: pasa cuando el medidor todavía no
    // llegó al DOM, y es la señal de que hay que reintentar.
    if (medidas.altoUtilPrimera <= 0) return false;

    const repartidas = repartirEnHojas(bloques, medidas);
    setHojas(
      repartidas.map((h, i) => ({
        bloques: h.bloques,
        alPie: h.alPie,
        ...(i > 0
          ? { titulo: tituloDeHoja(h.bloques, tituloInterior), antetitulo }
          : {}),
      })),
    );
    return true;
  }, [bloques, tituloInterior, antetitulo]);

  // Un cambio de bloques exige volver a montar el medidor y medir de nuevo.
  useEffect(() => {
    setMidiendo(true);
  }, [bloques, tituloInterior, antetitulo]);

  /**
   * Medir antes de la pintura, para no mostrar el medidor.
   *
   * Las dos condiciones de este efecto son la corrección de un bug que dejaba
   * la hoja mostrando el reparto viejo —agregar un bloque no se veía—:
   *
   * - Depende de `midiendo` porque cuando cambian los bloques el medidor está
   *   desmontado, así que esta pasada no encuentra nada; recién en el render
   *   siguiente, ya montado, hay algo que medir.
   * - La pasada por las fuentes se encadena ACÁ, después de una medición que
   *   funcionó, y no en su propio efecto. Estando las fuentes ya cargadas,
   *   `document.fonts.ready` resuelve en el microtask siguiente: en un efecto
   *   aparte apagaba `midiendo` antes de que el medidor llegara al DOM, y
   *   entonces no se montaba nunca y no se medía nunca.
   */
  useLayoutEffect(() => {
    if (!midiendo) return;
    if (!medir()) return;

    // Las fuentes cambian el alto del texto: sin volver a medir cuando cargan,
    // el reparto usa las métricas de la fuente de sistema y corta en el lugar
    // equivocado. Al terminar se desmonta el medidor, que duplica el DOM.
    let vigente = true;
    document.fonts.ready.then(() => {
      if (!vigente) return;
      medir();
      setMidiendo(false);
    });
    return () => {
      vigente = false;
    };
  }, [medir, midiendo]);


  return (
    <>
      {midiendo ? (
        <div style={{ position: "absolute", left: -99999, top: 0 }} aria-hidden>
          <Medidor
            bloques={bloques}
            assets={assets}
            tituloInterior={tituloInterior}
            antetitulo={antetitulo}
            nota={datos.nota}
            familia={datos.familia}
            pildoraSrc={datos.pildoraSrc}
            pildoraAlt={datos.pildoraAlt}
            version={datos.version}
            revision={datos.revision}
            anio={datos.anio}
          />
        </div>
      ) : null}
      {hojas ? <FichaVista datos={{ ...datos, hojas }} assets={assets} /> : null}
    </>
  );
}
