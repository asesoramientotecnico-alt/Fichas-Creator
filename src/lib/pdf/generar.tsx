import type { Bloque } from "@/lib/tipos";
import FichaVista, { type DatosFicha, type Hoja } from "@/components/ficha/FichaVista";
import Medidor from "@/components/ficha/Medidor";
import { repartirEnHojas, type Medidas } from "@/lib/paginado";
import { medirEnDocumento } from "@/lib/medir";
import { cssDelDocumento, imagenEmbebida } from "./recursos";
import { abrirNavegador } from "./navegador";

/**
 * Genera el PDF A4 de una ficha.
 *
 * Se renderiza el MISMO componente que la pantalla (§3: nunca dos
 * implementaciones), se embeben CSS, fuentes e imágenes, y recién ahí entra
 * Chromium con setContent. El navegador no navega a la app, así que no
 * necesita la sesión del usuario ni salida a internet.
 *
 * Son dos pasadas en la misma página: la primera mide los altos reales de
 * cada bloque, la segunda renderiza con el reparto ya decidido. El alto no se
 * puede estimar desde el contenido — depende del wrapping y de las métricas
 * de la fuente — así que lo dice el navegador.
 *
 * react-dom/server se importa de forma dinámica: el App Router rechaza su
 * import estático porque en un componente sería un error, pero acá corre
 * dentro de un route handler de Node, que es su lugar legítimo.
 */

export interface DatosSinPaginar extends Omit<DatosFicha, "hojas"> {
  bloques: Bloque[];
  /** Título de las hojas interiores. */
  tituloInterior: string;
  /** Antetítulo de las hojas interiores: el nombre del producto. */
  antetitulo: string;
}

async function embeberAssets(rutas: Record<string, string>): Promise<Record<string, string>> {
  const pares = await Promise.all(
    Object.entries(rutas).map(async ([clave, ruta]) => {
      try {
        return [clave, await imagenEmbebida(ruta)] as const;
      } catch {
        // Un asset faltante no debe tumbar la ficha entera: el bloque queda
        // con su caja vacía, que es lo mismo que se ve en pantalla.
        return null;
      }
    }),
  );
  return Object.fromEntries(pares.filter((p): p is readonly [string, string] => p !== null));
}

function documento(css: string, cuerpo: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${css}</style></head>
<body>${cuerpo}</body>
</html>`;
}

export async function generarPdf(
  datos: DatosSinPaginar,
  assets: Record<string, string> = {},
): Promise<{ pdf: Uint8Array; hojas: number }> {
  const { renderToStaticMarkup } = await import("react-dom/server");

  const [css, assetsEmbebidos, logo, isotipo] = await Promise.all([
    cssDelDocumento(),
    embeberAssets(assets),
    imagenEmbebida("/ficha/logo-famiq.png"),
    imagenEmbebida("/ficha/isotipo-famiq.png"),
  ]);

  const conDataUri = (html: string) =>
    html
      .replaceAll("/ficha/logo-famiq.png", logo)
      .replaceAll("/ficha/isotipo-famiq.png", isotipo);

  const navegador = await abrirNavegador();
  try {
    const pagina = await navegador.newPage();

    // --- Pasada 1: medir ---
    const htmlMedicion = documento(
      // Sin la geometría de impresión: acá interesa el alto natural.
      css,
      conDataUri(
        renderToStaticMarkup(
          <Medidor
            bloques={datos.bloques}
            assets={assetsEmbebidos}
            tituloInterior={datos.tituloInterior}
            nota={datos.nota}
          />,
        ),
      ),
    );
    await pagina.setContent(htmlMedicion, { waitUntil: "load" });
    await pagina.evaluateHandle("document.fonts.ready");
    const medidas: Medidas = await pagina.evaluate(medirEnDocumento);

    const repartidas = repartirEnHojas(datos.bloques, medidas);

    const hojas: Hoja[] = repartidas.map((h, i) => ({
      bloques: h.bloques,
      alPie: h.alPie,
      ...(i > 0
        ? { titulo: datos.tituloInterior, antetitulo: datos.antetitulo }
        : {}),
    }));

    // --- Pasada 2: renderizar con el reparto decidido ---
    const ficha: DatosFicha = { ...datos, hojas };
    const htmlFinal = documento(
      css,
      conDataUri(renderToStaticMarkup(<FichaVista datos={ficha} assets={assetsEmbebidos} />)),
    );
    await pagina.setContent(htmlFinal, { waitUntil: "load" });
    await pagina.evaluateHandle("document.fonts.ready");

    const pdf = await pagina.pdf({
      format: "A4",
      // Los fondos grafito, las reglas rojas y las bandas grises son diseño.
      printBackground: true,
      // Manda el @page del documento, no el diálogo.
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return { pdf, hojas: hojas.length };
  } finally {
    await navegador.close();
  }
}
