import FichaVista, { type DatosFicha } from "@/components/ficha/FichaVista";
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
 * react-dom/server se importa de forma dinámica: el App Router rechaza su
 * import estático porque en un componente sería un error, pero acá corre
 * dentro de un route handler de Node, que es su lugar legítimo.
 */

/** Assets que la ficha puede referenciar, resueltos a data URI. */
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

export async function generarPdf(
  datos: DatosFicha,
  assets: Record<string, string> = {},
): Promise<Uint8Array> {
  const [css, assetsEmbebidos, logo, isotipo] = await Promise.all([
    cssDelDocumento(),
    embeberAssets(assets),
    imagenEmbebida("/ficha/logo-famiq.png"),
    imagenEmbebida("/ficha/isotipo-famiq.png"),
  ]);

  const { renderToStaticMarkup } = await import("react-dom/server");
  let cuerpo = renderToStaticMarkup(
    <FichaVista datos={datos} assets={assetsEmbebidos} />,
  );

  // El logo y el isotipo los pone FichaVista por ruta pública; acá se
  // reemplazan por su data URI para no depender del servidor de estáticos.
  cuerpo = cuerpo
    .replaceAll("/ficha/logo-famiq.png", logo)
    .replaceAll("/ficha/isotipo-famiq.png", isotipo);

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><style>${css}</style></head>
<body>${cuerpo}</body>
</html>`;

  const navegador = await abrirNavegador();
  try {
    const pagina = await navegador.newPage();
    await pagina.setContent(html, { waitUntil: "load" });
    // Con font-display:block y woff2 embebidas esto resuelve de inmediato,
    // pero sin esperarlo la primera página puede pintarse sin la fuente.
    await pagina.evaluateHandle("document.fonts.ready");

    return await pagina.pdf({
      format: "A4",
      // Los fondos grafito, las reglas rojas y las bandas grises son diseño.
      printBackground: true,
      // Manda el @page del documento, no el diálogo.
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  } finally {
    await navegador.close();
  }
}
