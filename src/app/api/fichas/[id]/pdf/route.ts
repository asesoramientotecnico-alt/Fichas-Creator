import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { comoBloques, type FichaEstado } from "@/lib/tipos";
import { generarPdf } from "@/lib/pdf/generar";
import { TITULO_INTERIOR_POR_OMISION } from "@/lib/paginado";
import { NOTA_AL_PIE } from "@/components/ficha/FichaVista";
import { datosDeCabecera } from "@/lib/ficha-textos";
import { assetsDeFamilia } from "@/app/acciones-assets";

// Chromium necesita el runtime de Node, no el edge.
export const runtime = "nodejs";
// Un PDF con muchas filas puede pasar el default de 10 s. 60 s es además el
// techo del plan Hobby de Vercel; localmente el render tarda menos de 3 s.
export const maxDuration = 60;

function nombreArchivo(sku: string | undefined, version: string, anio: number) {
  const base = (sku ?? "ficha").replace(/[^\w.-]+/g, "-");
  return `${base}-v${version}-${anio}.pdf`;
}

export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  // El PDF sale con los permisos del usuario: si RLS no le deja ver la
  // ficha, tampoco puede exportarla.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  const { data: ficha } = await supabase
    .from("ficha")
    .select("id, estado, version, anio, producto(sku, nombre_es, familia_id)")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<{
      id: string;
      estado: FichaEstado;
      version: string;
      anio: number;
      producto: {
        sku: string;
        nombre_es: string;
            familia_id: string | null;
      } | null;
    }>();

  if (!ficha) {
    return NextResponse.json({ error: "No encontramos la ficha." }, { status: 404 });
  }

  const { data: revision } = await supabase
    .from("ficha_revision")
    .select("n, bloques")
    .eq("ficha_id", id)
    .order("n", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<{ n: number; bloques: unknown }>();

  const bloques = comoBloques(revision?.bloques);
  if (bloques.length === 0) {
    return NextResponse.json(
      { error: "La ficha no tiene bloques todavía." },
      { status: 409 },
    );
  }

  // Las imágenes salen de la librería de la familia (§7); el generador las
  // embebe como data URI para no depender de la URL firmada.
  const assets = await assetsDeFamilia(ficha.producto?.familia_id ?? null, bloques);
  // Familia y píldora de unidad de negocio salen del bloque header, no del
  // producto (ver unidades-negocio.ts).
  const cabecera = datosDeCabecera(bloques, assets.mapa);

  try {
    // La marca de agua BORRADOR la decide FichaVista a partir del estado
    // (§5 invariante 4): acá sólo se le pasa el estado real.
    // El paginado lo decide generarPdf midiendo en el navegador: la ficha
    // ocupa las hojas que haga falta, sin recortar.
    const { pdf, hojas } = await generarPdf(
      {
        familia: cabecera.familia,
        pildoraSrc: cabecera.pildoraSrc,
        pildoraAlt: cabecera.pildoraAlt,
        version: ficha.version,
        revision: revision?.n ?? 1,
        anio: ficha.anio,
        estado: ficha.estado,
        nota: NOTA_AL_PIE,
        bloques,
        tituloInterior: TITULO_INTERIOR_POR_OMISION,
        antetitulo: ficha.producto?.nombre_es ?? "",
      },
      assets.mapa,
    );

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nombreArchivo(ficha.producto?.sku, ficha.version, ficha.anio)}"`,
        "Cache-Control": "no-store",
        "X-Hojas": String(hojas),
      },
    });
  } catch (e) {
    console.error("[pdf] falló la generación", e);
    // El motivo va en la respuesta y no sólo al log. "Revisá el log del
    // servidor" obliga a entrar al panel de Vercel para enterarse de algo que
    // la app ya sabe, y el render del PDF falla por causas que se distinguen
    // entre sí: falta el binario de Chromium, se quedó sin memoria, o no
    // resolvió una imagen. Sin el motivo, las tres se ven igual.
    return NextResponse.json({ error: mensajeDeFallo(e) }, { status: 500 });
  }
}

/**
 * Traduce el fallo del render a algo que se pueda accionar.
 *
 * Los tres primeros casos son los que efectivamente aparecen en la función
 * serverless, donde Chromium es otro binario que el de desarrollo — así que
 * este camino no se ejercita corriendo la app local. El resto se informa con el
 * mensaje del error, que es más que nada.
 */
function mensajeDeFallo(e: unknown): string {
  const detalle = e instanceof Error ? e.message : String(e);
  const texto = detalle.toLowerCase();

  if (
    texto.includes("could not find chrome") ||
    texto.includes("executablepath") ||
    texto.includes("enoent") ||
    texto.includes("no encontramos chromium")
  ) {
    return (
      "El servidor no encontró el navegador que dibuja el PDF. En Vercel eso " +
      "suele ser que el binario de Chromium no entró en la función. " +
      `Detalle: ${detalle}`
    );
  }

  if (
    texto.includes("out of memory") ||
    texto.includes("oom") ||
    texto.includes("killed") ||
    texto.includes("target closed") ||
    texto.includes("connection closed") ||
    texto.includes("protocol error")
  ) {
    return (
      "El navegador se cerró antes de terminar el PDF, casi siempre por falta " +
      "de memoria en la función. Probá con una ficha de menos imágenes para " +
      `confirmarlo. Detalle: ${detalle}`
    );
  }

  if (texto.includes("timeout") || texto.includes("timed out")) {
    return (
      "El render del PDF pasó el tiempo máximo de la función. " +
      `Detalle: ${detalle}`
    );
  }

  return `No pudimos generar el PDF. ${detalle}`;
}
