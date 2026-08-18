# Notas de restauración

Estos archivos se recuperaron el 2026-08-18 y se consolidaron acá desde dos fuentes:

- **`Plantilla ficha técnica FAMIQ.zip`**, recuperado del historial de git (agregado en `7de3d59`,
  borrado en `3aa09ef`). Aportó el HTML, `doc-page.js`, `support.js` y los tres assets.
- **`Plantilla ficha técnica FAMIQ (1).zip`** (handoff de diseño), que aportó `colors_and_type.css`
  — el archivo de tokens que faltaba — más `HANDOFF.md`.

Los assets de ambos zips son idénticos (mismo checksum). El HTML difiere sólo en dos valores de
ejemplo (`codigo`, `revision`); se conservó la versión del handoff, que es la más nueva.

La ruta es `templates/ficha-tecnica/` (singular), como indica `CLAUDE.md` §3. En los zips venía como
`templates/fichas-tecnicas/` y `design_handoff_ficha_tecnica/design/`.

## El HTML no se modificó

`Ficha Tecnica Template.dc.html` está tal cual vino: es la fuente de verdad estética y no se toca.
Eso significa que **su `<head>` todavía apunta a rutas que no existen en este repo**:

```html
<link rel="stylesheet" href="../../_ds/famiq-design-system-<uuid>/colors_and_type.css">
<script src="../../_ds/famiq-design-system-<uuid>/_ds_bundle.js"></script>
```

- El **CSS** sí lo tenemos: es `./colors_and_type.css`, en esta misma carpeta. Para ver la plantilla
  renderizada, apuntar el `<link>` ahí (cambio local, no commitear sobre el original).
- El **`_ds_bundle.js`** no lo tenemos y no vino en ningún zip. No parece necesario para renderizar
  esta ficha: el HTML no usa ningún componente del bundle, sólo tokens CSS y el runtime `dc`.

## Dependencias de red del prototipo

Dos, y ambas importan para el PDF server-side de M4:

1. **`support.js` descarga React 18.3.1 + ReactDOM desde `unpkg.com`** en runtime (y Babel si hubiera
   imports JSX). Sin salida a internet, el prototipo no renderiza nada. Tiene escape: definir
   `window.__resources = { "<url>": "<ruta local>" }` antes de cargar `support.js`.
2. **`colors_and_type.css` hace `@import` de Google Fonts** (Roboto + Roboto Condensed). §3 de
   `CLAUDE.md` prohíbe esto para el render del PDF: hay que bajar los `woff2` a `public/fonts/` y
   reemplazar el `@import` por `@font-face` locales.

`support.js` es andamiaje del entorno de diseño (`<x-dc>`, `<sc-for>`, `<sc-if>`, `DCLogic`). Se
incluye sólo para que la plantilla sea visualizable como referencia. **No se porta a producción**,
igual que `doc-page.js` — así lo dice `HANDOFF.md`.

## Hueco conocido en el set de fuentes

El `@import` de `colors_and_type.css` pide estas itálicas de Roboto: `1,300` y `1,400`.

Pero la plantilla usa **`font-weight:700; font-style:italic`** para los símbolos de cota (`d`, `s`,
`h`; en la ficha de la arandela también `d1`, `d2`), y `HANDOFF.md` lo llama explícitamente "Roboto
Bold Italic". **Ese corte no está en el import.** Hoy el navegador lo sintetiza — inclina la bold
regular en vez de usar la itálica real.

Al armar el set de `woff2` para M4 hay que incluir **Roboto 700 italic**, que no figura en la lista
del design system.

## Referencia renderizada

`referencia/Ficha Tecnica - Arandela Chapista.pdf` es una ficha real de Famiq ya renderizada, en
formato distinto al ejemplo de la plantilla (la plantilla trae la tuerca autofrenante). Sirve para
contrastar; **no es** el fixture de `CLAUDE.md` §6, que pide la ficha de la tuerca.

Es un PDF rasterizado (páginas como imagen, sin texto ni fuentes embebidas), así que no se le pueden
extraer tipografías. Los colores sí se le extrajeron y coinciden exactamente con
`colors_and_type.css`.
