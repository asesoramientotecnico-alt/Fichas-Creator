import type { Medidas } from "@/lib/paginado";

/**
 * Lee del DOM los altos reales del documento de medición.
 *
 * Es una función autocontenida a propósito: puppeteer la serializa para
 * ejecutarla dentro de Chromium (page.evaluate), así que no puede cerrar
 * sobre imports ni sobre nada del módulo. A cambio, el PDF y la pantalla
 * miden con el MISMO código, y el reparto en hojas sale igual en los dos.
 *
 * El alto disponible se mide de punta a punta —del borde interior de la hoja
 * al borde superior del pie— en lugar de sumar cabecera + pie + padding. La
 * primera hoja y las interiores tienen cabeceras y padding distintos, y sumar
 * los componentes uno por uno se desincroniza en cuanto el CSS cambia.
 */
export function medirEnDocumento(): Medidas {
  const num = (v: string) => parseFloat(v) || 0;

  const altoDisponible = (cual: string) => {
    const hoja = document.querySelector<HTMLElement>(`[data-medir-hoja="${cual}"]`);
    if (!hoja) return 0;

    const est = getComputedStyle(hoja);
    const caja = hoja.getBoundingClientRect();
    const grilla = hoja.querySelector(".grilla-bloques");
    const pie = hoja.querySelector(".ficha-pie");

    // Desde donde arranca el primer bloque: el borde de contenido de la
    // grilla, no su borde de caja — la grilla tiene padding arriba y ese
    // espacio no está disponible para bloques.
    const arriba = grilla
      ? grilla.getBoundingClientRect().top + num(getComputedStyle(grilla).paddingTop)
      : caja.top + num(est.paddingTop);
    // ...hasta donde empieza el pie. No se usa la posición del pie: en la
    // hoja de muestra la grilla va vacía y el margen automático del pie se
    // come todo el espacio libre, así que su posición no dice nada. El alto
    // del pie sí es el real, y el borde inferior del contenido también.
    const abajo =
      caja.bottom - num(est.paddingBottom) - (pie ? pie.getBoundingClientRect().height : 0);

    return abajo - arriba;
  };

  // La grilla aporta su propia separación entre filas.
  const grilla = document.createElement("div");
  grilla.className = "grilla-bloques";
  document.body.appendChild(grilla);
  const separacionFilas = num(getComputedStyle(grilla).rowGap);
  grilla.remove();

  const altoBloque: Record<string, number> = {};
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-medir]"))) {
    const id = el.getAttribute("data-medir");
    if (id) altoBloque[id] = el.getBoundingClientRect().height;
  }

  return {
    altoBloque,
    altoUtilPrimera: altoDisponible("primera"),
    altoUtilInterior: altoDisponible("interior"),
    separacionFilas,
    // La misma separación que .bloques-al-pie declara en ficha.css.
    separacionPie: separacionFilas,
  };
}
