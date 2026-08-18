# Plantilla — Ficha técnica FAMIQ

`Ficha Tecnica Template.dc.html` — ficha técnica de producto, 2 páginas A4, lista para imprimir/exportar a PDF (`<doc-page size="a4">`).

Basada en la ficha "6.1 Tuerca autofrenante con inserto de nylon" (`uploads/Ficha técnica Famiq.pdf`).

## Estructura
- **Pág. 1** — cabecera con isologo + código/revisión, bloque de título (familia / subfamilia / nombre ES / nombre EN), foto de producto, y cuatro bloques de datos: Normas aplicables, Propiedades mecánicas, Materiales disponibles, Descripción, Aplicaciones típicas, Condiciones de servicio.
- **Pág. 2** — croquis dimensional con leyenda de cotas (d, s, h), tablas de dimensiones métricas y en pulgadas, y Presentación.

## Parametrización
Props editables (Tweaks): `familia`, `subfamilia`, `nombre`, `nombreEn`, `codigo`, `revision`, `sistema` (Ambos / Métrico / Pulgadas — muestra u oculta cada tabla de cotas), `mostrarFoto`, `mostrarCroquis`, `materiales`, `servicio`, `presentacion`, `nota`.

Los datos tabulares (normas, propiedades mecánicas, descripción, aplicaciones, cotas y dimensiones) viven como arrays en `renderVals()` de la clase lógica: para una ficha nueva, duplicar el archivo y reemplazar esos arrays.

## Assets
`assets/logo-famiq.png` (isologo + slogan), `assets/producto.png` (foto de producto), `assets/croquis.png` (croquis dimensional). Reemplazar los dos últimos por producto.

## Tokens
Sólo tokens del sistema: `--famiq-red`, `--famiq-graphite`, `--famiq-grey-200/50/400/500`, `--font-condensed` (títulos, etiquetas, datos numéricos), `--font-sans` (cuerpo). Radios 0–2px, hairlines de 1px, divisores fuertes de 2px, sin sombras.
