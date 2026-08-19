# Rediseño de la ficha — plantilla V26 (válvulas)

Análisis de `referencia/Plantilla ficha tecnica FAMIQ V26.pdf`, la plantilla que
reemplaza a la anterior. Este documento existe porque §4 exige que agregar un
tipo de bloque sea una decisión de producto con su entrada en la tabla, no un
agregado ad hoc para una ficha puntual.

## Qué cambió respecto de lo construido

### La estética se revierte al estilo del prototipo

En M2 anclé el diseño en las dos fichas de producción de entonces (tuerca y
arandela), que usaban **encabezados de sección en rojo**, y descarté el estilo
del prototipo `.dc.html`, que los usaba en grafito. Esta plantilla vuelve al
grafito. Medido sobre el PDF:

| Elemento | Antes (tuerca/arandela) | Ahora (V26) |
|---|---|---|
| Encabezado de sección | Rojo `#D62717` | **Grafito `#474746`** con regla superior de 2px |
| Chips | Borde y fondo grises, texto grafito | **Borde rojo, texto `#A4210E`, fondo `#FFF5F4`**, en mayúsculas |
| Foto de producto | Marco de 1px sobre fondo `#F6F6F6` | **Sin marco**, sobre blanco |
| Rótulo de fila (tabla-kv) | 8pt `#8A8A8A` | 8pt `#5E5E5E` |
| Identificación | `VERSIÓN 1.0 · 2026` | `V26 · REV. 01 · 2026` |

Lo que sí sigue en rojo: el rótulo `FICHA TÉCNICA` (con subrayado rojo), el
nombre del producto en las cabeceras interiores, el número de ítem en la lista
de componentes, y el segmento derecho de la regla de marca.

### Cabecera de la primera hoja

Suma dos elementos que no existían:

- Una **píldora de categoría** con icono, a la derecha del logo. Es un asset
  raster provisto por diseño (`pildora-fluidos.png`), no un componente CSS: su
  color (`#EFC72F`) es una variante del amarillo del sistema y el icono es
  específico de la familia.
- Una **línea de familia** en gris debajo de la píldora (`VÁLVULAS
  INDUSTRIALES`).

El logo pasa de 12,5 mm a ~46 mm de ancho, y ya no hay barra roja vertical
junto al título.

### Cabeceras interiores

Título grande + nombre del producto en rojo a su derecha, y el **logotipo
completo** a la derecha (antes era sólo el isotipo). La regla de marca invierte
los segmentos: gris a la izquierda, rojo a la derecha.

### Pie

Texto nuevo: «Información orientativa. Reservado el derecho de modificar
cualquier material o característica sin previo aviso · famiq.com.ar».

## Tipos de bloque nuevos

Cuatro tipos nuevos y una variante de uno existente. Cada uno con su entrada
propuesta para la tabla de §4.

| Tipo | Contenido | Dónde aparece |
|---|---|---|
| `imagen` | Imagen con rótulo y sufijo opcional a la derecha del rótulo, con marco opcional | «PRESIÓN / TEMPERATURA» (gráfico, con sufijo `1/4" – 4"`), el despiece de la hoja 2 |
| `lista-componentes` | Tabla de ítem numerado → componente → material → cantidad, con banda de encabezado oscura y el número de ítem en rojo. Se reparte en dos columnas lado a lado | «LISTA DE COMPONENTES» |
| `tabla-ancha` | Tabla de N columnas a ancho completo, con banda de encabezado oscura, sufijo en el encabezado y nota al pie explicando los símbolos | «DIMENSIONES Y CÓDIGOS» |
| `codigos` | Pares código → medida en dos columnas, con imagen y nota opcionales | «REPUESTOS · KIT DE SELLOS RTFE» |

Y una variante, no un tipo nuevo:

- **`tabla-kv` con `orientacion: "vertical"`**: rótulo arriba y valor abajo, en
  vez de rótulo a la izquierda. Lo usan «MATERIALES DE SELLADO» y «NORMAS DE
  REFERENCIA», que van en una columna angosta donde el rótulo no entra al lado
  del valor. Es el mismo bloque con otra disposición, no otro tipo: los campos
  son idénticos.

### Por qué `tabla-ancha` no es `tabla`

`tabla` (§4) ya existe y tiene encabezados y N columnas. Se diferencian en tres
cosas que no son cosméticas: la banda de encabezado oscura, la nota al pie que
define los símbolos de las columnas, y que siempre ocupa el ancho completo de
la hoja. Podrían unificarse agregando esos tres campos opcionales a `tabla`; lo
dejo como tipo aparte porque la nota al pie es parte del contrato de lectura de
una tabla de cotas —sin ella las columnas `Ød`, `ØD`, `P`, `W` no se entienden—
y no quiero que sea opcional donde importa.

## Tipografía

El PDF embebe Segoe UI, pero **ninguno de sus glifos se usa**: todo el texto
visible es Type3, o sea contornos vectoriales. Comparados los glifos del título
contra las fuentes del repo, coinciden con **Roboto Condensed Bold**. Segoe UI
queda como resto del export. No hace falta cambiar ni licenciar nada.

## Lo que este cambio rompe

- Las capturas de referencia de M2 (`capturas/comparacion-hoja*.png`) quedan
  obsoletas: comparan contra la ficha de la tuerca con el estilo viejo.
- El criterio de aceptación de M2 —«la ficha de referencia renderizada es
  indistinguible del original»— pasa a medirse contra esta plantilla, no contra
  el PDF de la tuerca.
- La ficha de la tuerca, si se re-renderiza, va a salir con los encabezados en
  grafito. Eso es lo correcto si la estética es una sola para todas las fichas.
