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
    const pdf = await generarPdf({ ...FICHA_TUERCA, estado }, ASSETS_TUERCA);
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
