# Handoff: Ficha técnica de producto — FAMIQ

## Overview
Plantilla de **ficha técnica de producto** (product datasheet) para FAMIQ, distribuidor de acero inoxidable. Dos páginas A4 verticales, pensadas para impresión y exportación a PDF, alimentadas por datos de producto (normas, propiedades mecánicas, dimensiones). El ejemplo cargado es "Tuerca autofrenante con inserto de nylon".

Objetivo en producción: generar esta ficha para cualquier producto del catálogo a partir de datos estructurados (idealmente desde el ERP/PIM), con salida a PDF.

## About the Design Files
Los archivos de `design/` son **referencias de diseño creadas en HTML** — prototipos que muestran el aspecto y el comportamiento buscados, **no código de producción para copiar tal cual**. La tarea es **recrear estos diseños en el entorno del codebase destino** (React, Vue, Next.js, un generador de PDF server-side, etc.) usando sus patrones y librerías establecidas. Si todavía no hay entorno, elegir el más apropiado (por ejemplo React + una librería de PDF headless como Playwright/Puppeteer imprimiendo HTML, que es lo que mejor se corresponde con este diseño) e implementar ahí.

`Ficha Tecnica Template.dc.html` usa un runtime de componentes propio del entorno de diseño (`<x-dc>`, `{{ }}`, `<sc-for>`, `<sc-if>`) y un web component `doc-page.js` que gobierna la geometría de página al imprimir. **Nada de eso debe portarse**: son andamiaje del prototipo. Lo que importa es el layout, la tipografía, los tokens y la paginación A4.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados y jerarquía son finales y provienen del FAMIQ Design System. Recrear pixel-perfect, respetando el sistema de diseño existente del codebase donde aplique.

## Screens / Views

### Página 1 — Identificación y datos técnicos
- **Purpose:** presentar el producto, sus normas aplicables, propiedades mecánicas, materiales, descripción, aplicaciones y condiciones de servicio.
- **Layout:** hoja A4 vertical (210 × 297 mm), `box-sizing: border-box`, padding `12mm 13mm 9mm`, fondo blanco. Contenedor interno `display:flex; flex-direction:column; height:100%`.
  1. **Header** (`display:flex; align-items:center; justify-content:space-between; padding-bottom:2mm`): isologo Famiq a la izquierda, ancho `36mm`; a la derecha, en una sola línea con `gap:4mm`, la etiqueta "FICHA TÉCNICA" y "{código} · {revisión}".
  2. **Regla de marca**: barra de `3px` de alto: segmento izquierdo de `36mm` en rojo `#D62717`, resto en gris `#D9D9D9`.
  3. **Bloque de título** (`display:grid; grid-template-columns: 1fr 40mm; gap:8mm; padding-top:5mm; align-items:center`):
     - Izquierda: línea de familia (subfamilia en rojo + familia en gris, ambas condensed bold uppercase); H1 con el nombre del producto; nombre en inglés en Roboto Light Italic gris.
     - Derecha: caja de foto de producto, `aspect-ratio:1/1`, borde `1px #D9D9D9`, fondo `#F6F6F6`, padding `4mm`, imagen `object-fit:contain`.
  4. **Grilla de datos** (`display:grid; grid-template-columns:1fr 1fr; column-gap:9mm; row-gap:7mm; padding-top:7mm; flex:1; align-content:space-between`) — 6 bloques en orden de DOM, de modo que cada fila alinee sus reglas superiores: `Normas aplicables | Descripción`, `Propiedades mecánicas | Aplicaciones típicas`, `Materiales disponibles | Condiciones de servicio`.
  5. **Footer** (`margin-top:6mm; border-top:1px solid #D9D9D9; padding-top:2.5mm`): nota legal a la izquierda, "1 / 2" a la derecha.

- **Componentes:**
  - **Encabezado de bloque:** `border-top: 2px solid #474746; padding-top: 2mm;` texto Roboto Condensed 700, 9pt, `letter-spacing:.2em`, uppercase, color `#474746`.
  - **Fila de norma:** `display:grid; grid-template-columns:33mm 1fr; gap:3mm; padding:1.8mm 0; border-bottom:1px solid #D9D9D9; align-items:baseline`. Etiqueta: Roboto Condensed 8pt, `letter-spacing:.12em`, uppercase, `#5E5E5E`. Valor: Roboto Medium 9pt, `line-height:1.35`, `#474746`.
  - **Tabla de propiedades mecánicas:** `border-collapse:collapse`, `font-variant-numeric: tabular-nums`. `thead tr`: fondo `#474746`, texto blanco, celdas `padding:1.6mm 2mm`, Roboto Condensed 700 7.5pt, `letter-spacing:.06em`, uppercase, `white-space:nowrap`. Columnas: Grado (izq.), Proof MPa, Rm mín MPa, Dureza máx (todas a la derecha). Filas: `border-bottom:1px solid #D9D9D9`, primera celda Roboto Medium 9pt `nowrap`, numéricas Roboto Condensed 9.5pt alineadas a la derecha.
  - **Chip de aplicación:** `border:1px solid #D9D9D9; background:#F6F6F6; border-radius:2px; padding:1.4mm 2.5mm;` Roboto Medium 8.5pt `#474746`. Contenedor `display:flex; flex-wrap:wrap; gap:2mm; padding-top:3mm`.
  - **Párrafos de descripción:** Roboto 9pt, `line-height:1.5`, `margin-top:2.5mm`, `text-wrap: pretty`.

- **Contenido del ejemplo:** familia "Tuercas de acero inoxidable"; subfamilia "Tuerca hexagonal"; nombre "Tuerca autofrenante con inserto de nylon"; nombre EN "Nylon Insert Lock Nut · Hex Nut"; código "FT"; revisión "Rev. 01 · 2026"; materiales "A2 — AISI 304/304L · A4 — AISI 316/316L"; nota de pie "Datos orientativos. Confirmar disponibilidad con equipo técnico · famiq.com.ar".

### Página 2 — Cotas y dimensiones
- **Purpose:** croquis dimensional y tablas de medidas en sistema métrico y en pulgadas.
- **Layout:** mismo padding y estructura de hoja.
  1. **Header espejado:** a la izquierda "Tabla de cotas y dimensiones" (Roboto Condensed 700, 15pt) más el nombre del producto en rojo condensed 9pt uppercase; a la derecha el isologo de `26mm`. La regla de marca invierte los segmentos (gris a la izquierda, rojo `26mm` a la derecha).
  2. **Croquis** (`grid-template-columns: 1fr 52mm; gap:8mm; align-items:center; padding-top:6mm`): imagen del croquis en caja con borde `1px #D9D9D9`, fondo `#F6F6F6`, padding `4mm`, `max-height:60mm`; a la derecha, leyenda de cotas — filas `grid-template-columns:7mm 1fr` con el símbolo en Roboto Bold Italic 11pt rojo y el nombre en Roboto 9pt, separadas por hairline.
  3. **Tablas de dimensiones** (`grid-template-columns:1fr 1fr; gap:9mm; padding-top:7mm; align-items:start`): "Dimensiones métricas" y "Dimensiones pulgadas", cada una con la unidad "mm" alineada a la derecha del encabezado. Mismo estilo de tabla que la página 1; columnas Nominal (d) / Entre caras (s) / Altura (h).
  4. **Presentación** (`margin-top:auto; padding-top:7mm`): bloque con encabezado y valor en Roboto Medium 9.5pt.
  5. **Footer** idéntico, con "2 / 2".

## Interactions & Behavior
Documento estático, sin interacciones de usuario. Comportamientos a preservar:
- **Impresión / PDF:** cada página es una hoja A4 completa, `overflow:hidden`, sin márgenes del navegador (`@page { margin: 0 }`) y sin encabezados/pies del navegador. Nada debe reflowear a una tercera hoja: el contenido está dimensionado para caber.
- **Visibilidad condicional:** `sistema` = Ambos | Métrico | Pulgadas controla qué tabla de dimensiones se renderiza (cuando queda una sola, ocupa su columna y la otra queda vacía; si en producción se prefiere que ocupe el ancho completo, es una mejora válida). `mostrarFoto` y `mostrarCroquis` ocultan la caja de imagen correspondiente.
- **Sin animaciones ni hover** (documento impreso). Si se muestra en web, seguir el sistema: easing `cubic-bezier(.2,.8,.2,1)`, 180–240 ms, sin rebotes.

## State Management
No hay estado de UI. Sólo datos de entrada (props del documento):

| Campo | Tipo | Ejemplo |
| --- | --- | --- |
| `familia` | string | "Tuercas de acero inoxidable" |
| `subfamilia` | string | "Tuerca hexagonal" |
| `nombre` | string | "Tuerca autofrenante con inserto de nylon" |
| `nombreEn` | string | "Nylon Insert Lock Nut · Hex Nut" |
| `codigo` | string | "FT" |
| `revision` | string | "Rev. 01 · 2026" |
| `sistema` | "Ambos" \| "Métrico" \| "Pulgadas" | "Ambos" |
| `mostrarFoto` / `mostrarCroquis` | boolean | true |
| `materiales`, `servicio`, `presentacion`, `nota` | string | ver ejemplo |
| `normas` | `{label, value}[]` | 7 filas |
| `mecanicas` | `{grado, proof, rm, dureza}[]` | 2 filas |
| `descripcion` | `string[]` | 3 párrafos |
| `aplicaciones` | `string[]` | 6 chips |
| `cotas` | `{simbolo, nombre}[]` | d, s, h |
| `dimsMetricas` / `dimsPulgadas` | `{d, s, h}[]` | 13 / 10 filas |

Los valores del ejemplo están en la clase lógica del archivo de diseño (`renderVals()`), al final del HTML — sirven como fixture para el desarrollo.

## Design Tokens
Fuente única: `design/colors_and_type.css` (copia del design system FAMIQ). Usados en esta ficha:

- **Colores:** rojo `#D62717` (`--famiq-red`), rojo oscuro `#A4210E`, grafito `#474746` (`--famiq-graphite`, texto y cabeceras de tabla), gris 200 `#D9D9D9` (hairlines, bordes), gris 50 `#F6F6F6` (fondos de caja de imagen y chips), gris 400 `#8A8A8A` (metadatos y pie), gris 500 `#5E5E5E` (etiquetas de norma), blanco `#FFFFFF`.
- **Tipografía:** Roboto y Roboto Condensed (Google Fonts). Condensed Bold para títulos, etiquetas de sección y datos numéricos; Roboto Regular/Medium para cuerpo y valores; Roboto Light Italic para el nombre en inglés.
- **Escala usada en la ficha (pt, documento impreso):** H1 29pt / `line-height:1.02` / `letter-spacing:-.015em`; título pág. 2 15pt; nombre EN 11.5pt; etiquetas de sección 9pt `letter-spacing:.2em`; valores 9–9.5pt; encabezados de tabla 7.5pt `letter-spacing:.06em`; chips 8.5pt; pie 7.5–8pt. **Mínimo absoluto 7.5pt.**
- **Espaciado:** milímetros para geometría de página — padding de hoja `12/13/9mm`, gap de columnas `9mm`, gap de filas `7mm`, padding de celdas `1.5–1.7mm 2mm`.
- **Radios:** 0 en general; 2px sólo en chips. **Sin sombras.**
- **Divisores:** hairline `1px solid #D9D9D9`; divisor fuerte de sección `2px solid #474746`.

## Assets
En `design/assets/` (extraídos del PDF original provisto por el cliente, `Ficha técnica Famiq.pdf`):
- `logo-famiq.png` — isologo + slogan "Aceros inoxidables". Tiene fondo blanco; conviene reemplazar por el SVG oficial con fondo transparente.
- `producto.png` — foto de producto (tuerca autofrenante), 214×218 px. Placeholder de baja resolución: en producción debe venir del PIM.
- `croquis.png` — croquis dimensional con cotas d, s, h, 722×439 px. Ídem: debería ser un SVG por familia de producto.

Tipografías: Roboto y Roboto Condensed vía Google Fonts (`@import` dentro de `colors_and_type.css`). Para impresión server-side, embeber las fuentes localmente.

## Files
- `design/Ficha Tecnica Template.dc.html` — el diseño completo (markup + datos de ejemplo). Referencia principal.
- `design/doc-page.js` — web component que da la geometría de página A4 y las reglas de impresión al prototipo. No portar; sirve para entender la paginación esperada.
- `design/colors_and_type.css` — tokens de color y tipografía del FAMIQ Design System.
- `design/assets/` — imágenes.
- `design/README.md` — notas de uso de la plantilla dentro del design system.
