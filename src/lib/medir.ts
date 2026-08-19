import type { Medidas } from "@/lib/paginado";

/**
 * Lee del DOM los altos reales del documento de medición.
 *
 * Es una función autocontenida a propósito: puppeteer la serializa para
 * ejecutarla dentro de Chromium (page.evaluate), así que no puede cerrar
 * sobre imports ni sobre nada del módulo. A cambio, el PDF y la pantalla
 * miden con el MISMO código, y el reparto en hojas sale igual en los dos.
 */
export function medirEnDocumento(): Medidas {
  const num = (v: string) => parseFloat(v) || 0;

  const leerHoja = (cual: string) => {
    const hoja = document.querySelector<HTMLElement>(`[data-medir-hoja="${cual}"]`);
    if (!hoja) return null;
    const est = getComputedStyle(hoja);
    const cabecera = hoja.querySelector(".ficha-cabecera");
    const regla = hoja.querySelector(".regla-marca");
    const pie = hoja.querySelector(".ficha-pie");
    return {
      // Alto útil: la hoja menos su padding vertical.
      altoUtil: hoja.clientHeight - num(est.paddingTop) - num(est.paddingBottom),
      altoCabecera:
        (cabecera ? cabecera.getBoundingClientRect().height : 0) +
        (regla ? regla.getBoundingClientRect().height : 0),
      altoPie: pie ? pie.getBoundingClientRect().height : 0,
    };
  };

  const primera = leerHoja("primera");
  const interior = leerHoja("interior");

  // La grilla aporta su propio padding superior y su separación entre filas.
  const grilla = document.createElement("div");
  grilla.className = "grilla-bloques";
  document.body.appendChild(grilla);
  const estiloGrilla = getComputedStyle(grilla);
  const separacionFilas = num(estiloGrilla.rowGap);
  const paddingGrilla = num(estiloGrilla.paddingTop);
  grilla.remove();

  const altoBloque: Record<string, number> = {};
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-medir]"))) {
    const id = el.getAttribute("data-medir");
    if (id) altoBloque[id] = el.getBoundingClientRect().height;
  }

  return {
    altoBloque,
    altoCabeceraPrimera: (primera?.altoCabecera ?? 0) + paddingGrilla,
    altoCabeceraInterior: (interior?.altoCabecera ?? 0) + paddingGrilla,
    altoPie: primera?.altoPie ?? 0,
    altoUtil: primera?.altoUtil ?? 0,
    separacionFilas,
    // La misma separación que .bloques-al-pie declara en ficha.css.
    separacionPie: separacionFilas,
  };
}
