import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { comoBloques, type FichaEstado } from "@/lib/tipos";
import { generarPdf } from "@/lib/pdf/generar";
import { NOTA_AL_PIE } from "@/components/ficha/FichaVista";

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
    .select("id, estado, version, anio, producto(sku, nombre_es, categoria)")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<{
      id: string;
      estado: FichaEstado;
      version: string;
      anio: number;
      producto: { sku: string; nombre_es: string; categoria: string | null } | null;
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

  try {
    // La marca de agua BORRADOR la decide FichaVista a partir del estado
    // (§5 invariante 4): acá sólo se le pasa el estado real.
    // El paginado lo decide generarPdf midiendo en el navegador: la ficha
    // ocupa las hojas que haga falta, sin recortar.
    const { pdf, hojas } = await generarPdf(
      {
        familia: ficha.producto?.categoria ?? "",
        pildoraSrc: undefined,
        version: ficha.version,
        revision: revision?.n ?? 1,
        anio: ficha.anio,
        estado: ficha.estado,
        nota: NOTA_AL_PIE,
        bloques,
        tituloInterior: "Tabla de cotas y dimensiones",
        antetitulo: ficha.producto?.nombre_es ?? "",
      },
      { producto: "/ficha/producto.png", croquis: "/ficha/croquis.png" },
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
    return NextResponse.json(
      { error: "No pudimos generar el PDF. Revisá el log del servidor." },
      { status: 500 },
    );
  }
}
