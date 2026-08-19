import { NextResponse } from "next/server";
import { generarPdf } from "@/lib/pdf/generar";
import { FICHA_TUERCA, ASSETS_TUERCA } from "@/lib/fixtures/tuerca-autofrenante";
import type { FichaEstado } from "@/lib/tipos";

/**
 * PDF de la ficha de referencia, con datos del fixture y sin base ni sesión.
 * Es el par de /vista-previa y sirve de prueba del criterio de aceptación de
 * M4: la ficha de referencia debe salir en exactamente dos páginas A4.
 *
 * `?estado=borrador` fuerza el estado para verificar la marca de agua.
 * `?repetir=N` duplica los bloques N veces, para verificar que el paginado
 * abre hojas de más en vez de recortar.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const ESTADOS: FichaEstado[] = ["borrador", "en_revision", "aprobada", "publicada"];

export async function GET(peticion: Request) {
  const pedido = new URL(peticion.url).searchParams.get("estado");
  const estado = ESTADOS.includes(pedido as FichaEstado)
    ? (pedido as FichaEstado)
    : FICHA_TUERCA.estado;

  try {
    // El fixture trae las hojas ya cortadas a mano; acá se aplanan para que
    // el paginado automático decida el reparto, que es lo que hace la app con
    // una ficha real.
    const { hojas: _hojas, ...resto } = FICHA_TUERCA;
    const base = FICHA_TUERCA.hojas.flatMap((h) => h.bloques);

    // Duplicar bloques exige ids nuevos: el reparto (y el diff) los usan
    // como identidad.
    const repetir = Math.min(Math.max(Number(new URL(peticion.url).searchParams.get("repetir")) || 1, 1), 8);
    const bloques = Array.from({ length: repetir }, (_, vuelta) =>
      base.map((b) => (vuelta === 0 ? b : { ...b, id: `${b.id}-r${vuelta}` })),
    ).flat();

    const { pdf } = await generarPdf(
      {
        ...resto,
        estado,
        bloques,
        tituloInterior: "Tabla de cotas y dimensiones",
        antetitulo: "Tuerca autofrenante con inserto de nylon",
      },
      ASSETS_TUERCA,
    );
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="ficha-referencia.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[pdf] falló la ficha de referencia", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
