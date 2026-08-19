"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { Bloque } from "@/lib/tipos";
import { repartirEnHojas, type Medidas } from "@/lib/paginado";
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

  const medir = useCallback(() => {
    const medidas: Medidas = medirEnDocumento();
    // Sin alto útil el reparto no tiene sentido: pasa si el medidor todavía
    // no llegó al DOM. Se reintenta cuando las fuentes terminan de cargar.
    if (medidas.altoUtil <= 0) return;

    const repartidas = repartirEnHojas(bloques, medidas);
    setHojas(
      repartidas.map((h, i) => ({
        bloques: h.bloques,
        alPie: h.alPie,
        ...(i > 0 ? { titulo: tituloInterior, antetitulo } : {}),
      })),
    );
  }, [bloques, tituloInterior, antetitulo]);

  // Un cambio de bloques exige volver a montar el medidor y medir de nuevo.
  useEffect(() => {
    setMidiendo(true);
  }, [bloques]);

  // Medir antes de la pintura, para no mostrar el medidor.
  useLayoutEffect(() => {
    medir();
  }, [medir]);

  // Las fuentes cambian el alto del texto: sin volver a medir cuando cargan,
  // el primer reparto usa las métricas de la fuente de sistema y corta en el
  // lugar equivocado.
  useEffect(() => {
    let vigente = true;
    document.fonts.ready.then(() => {
      if (!vigente) return;
      medir();
      setMidiendo(false);
    });
    return () => {
      vigente = false;
    };
  }, [medir]);

  return (
    <>
      {midiendo ? (
        <div style={{ position: "absolute", left: -99999, top: 0 }} aria-hidden>
          <Medidor
            bloques={bloques}
            assets={assets}
            tituloInterior={tituloInterior}
            nota={datos.nota}
          />
        </div>
      ) : null}
      {hojas ? <FichaVista datos={{ ...datos, hojas }} assets={assets} /> : null}
    </>
  );
}
