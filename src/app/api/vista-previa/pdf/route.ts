import { NextResponse } from "next/server";
import { generarPdf } from "@/lib/pdf/generar";
import { FICHA_TUERCA, ASSETS_TUERCA } from "@/lib/fixtures/tuerca-autofrenante";
import {
  BLOQUES_VALVULA,
  ASSETS_VALVULA,
  HOJAS_VALVULA,
  datosCompletosValvula,
} from "@/lib/fixtures/valvula-esferica";
import { BLOQUES_CHART } from "@/lib/fixtures/chart-demo";
import type { FichaEstado } from "@/lib/tipos";

/**
 * PDF de las fichas de referencia, con datos del fixture y sin base ni sesión.
 * Es el par de /vista-previa y sirve de prueba del criterio de aceptación de
 * M4: la plantilla V26 debe salir en exactamente tres páginas A4.
 *
 * `?ficha=tuerca` sirve la ficha de la tuerca autofrenante, que sigue siendo
 * el fixture del revisor con IA (§6) y tiene que salir en dos hojas.
 * `?estado=borrador` fuerza el estado para verificar la marca de agua.
 * `?repetir=N` duplica los bloques N veces, para verificar que el paginado
 * abre hojas de más en vez de recortar.
 * `?chart=1` agrega el bloque de gráfico. Va aparte de las fichas de
 * referencia porque cambiaría su cantidad de hojas.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const ESTADOS: FichaEstado[] = ["borrador", "en_revision", "aprobada", "publicada"];

/** Las dos fichas de referencia, ya aplanadas: el paginado decide el reparto. */
function referencia(cual: string | null) {
  if (cual === "tuerca") {
    const { hojas, ...datos } = FICHA_TUERCA;
    return {
      datos,
      bloques: hojas.flatMap((h) => h.bloques),
      assets: ASSETS_TUERCA,
      tituloInterior: "Tabla de cotas y dimensiones",
      antetitulo: "Tuerca autofrenante con inserto de nylon",
      archivo: "ficha-tuerca.pdf",
    };
  }
  return {
    datos: datosCompletosValvula(),
    bloques: BLOQUES_VALVULA,
    assets: ASSETS_VALVULA,
    tituloInterior: HOJAS_VALVULA.tituloInterior,
    antetitulo: HOJAS_VALVULA.antetitulo,
    archivo: "plantilla-v26.pdf",
  };
}

export async function GET(peticion: Request) {
  const params = new URL(peticion.url).searchParams;
  const ref = referencia(params.get("ficha"));

  const pedido = params.get("estado");
  const estado = ESTADOS.includes(pedido as FichaEstado)
    ? (pedido as FichaEstado)
    : ref.datos.estado;

  try {
    // Duplicar bloques exige ids nuevos: el reparto (y el diff) los usan
    // como identidad.
    const repetir = Math.min(Math.max(Number(params.get("repetir")) || 1, 1), 8);
    const conChart = params.get("chart") === "1";
    const conjunto = conChart ? [...ref.bloques, ...BLOQUES_CHART] : ref.bloques;
    const bloques = Array.from({ length: repetir }, (_, vuelta) =>
      conjunto.map((b) => (vuelta === 0 ? b : { ...b, id: `${b.id}-r${vuelta}` })),
    ).flat();

    const { pdf, hojas } = await generarPdf(
      {
        ...ref.datos,
        estado,
        bloques,
        tituloInterior: ref.tituloInterior,
        antetitulo: ref.antetitulo,
      },
      ref.assets,
    );
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ref.archivo}"`,
        "Cache-Control": "no-store",
        "X-Hojas": String(hojas),
      },
    });
  } catch (e) {
    console.error("[pdf] falló la ficha de referencia", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
