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
| Cuerpo de texto | 10pt, interlínea 1,45 | 9pt, interlínea 1,5 |
| Tracking del rótulo de sección | 0,14em | 0,20em, medido carácter por carácter |
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

El logo pasa de 12,5 mm a 42,2 mm de ancho —medido de su tinta, no de la caja
de la imagen en el PDF— y ya no hay barra roja vertical junto al título.

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

## La grilla pasa a 12 pistas

Antes la hoja era una grilla de dos columnas y un bloque ocupaba media hoja o
el ancho completo. La plantilla V26 necesita además un croquis ancho con dos
secciones angostas al costado, así que la grilla pasa a **12 pistas** y el
ancho de un bloque es una de cuatro fracciones: `un-tercio` (4), `medio` (6),
`dos-tercios` (8), `completo` (12). `medio` sigue midiendo exactamente lo que
medía —87,5 mm— así que las fichas ya cargadas no se mueven.

Un bloque alto puede declarar `filasGrilla: 2`: los dos bloques que lo siguen
se apilan en las pistas que sobran a su costado en vez de arrancar una fila
nueva. Es lo que hace el despiece de la hoja 2 con "materiales de sellado" y
"normas de referencia". El paginado calcula el alto de esa fila como el mayor
entre el bloque alto y la columna apilada.

El título de una hoja interior lo aporta el bloque que la abre
(`tituloHoja`), no la hoja: el reparto en hojas lo decide el paginado, así que
un título declarado por hoja se desincronizaría en cuanto cambia el contenido.
Por eso la hoja 2 se titula "Despiece y componentes" y la 3 "Tabla de cotas y
códigos" sin que nadie declare cuántas hojas hay.

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

## Desviaciones deliberadas respecto del PDF

Tres, y las tres están medidas:

1. **La foto de producto mide 34,3 mm de alto y no 38,6.** En la plantilla la
   foto llega a tocar la regla de la sección siguiente, sin separación. Acá la
   fila del bloque de cabecera respeta la separación de la grilla como
   cualquier otra, así que la foto cede esos 4,3 mm. La alternativa era un
   caso especial en el paginado para una sola fila.
2. **El despiece mide 119,7 mm de ancho y no 124,1.** La plantilla parte la
   hoja 2 en 124,1 / 52,1 mm con 7,9 de separación, un corte que no cae en
   ningún módulo de la grilla de la hoja 1 (87,6 / 87,6 con 9 de separación).
   Se elige el módulo: `dos-tercios` da 119,7 mm y `un-tercio` 55,3. Son 4 mm
   de diferencia en una imagen que se escala, a cambio de una sola grilla
   coherente para toda la ficha.
3. **El cuadrado del vástago se escribe `SQ C` y no `□C`.** El glifo U+25A1 no
   está en los subsets de Roboto que van embebidos, y una fuente de reserva no
   está garantizada en el Chromium serverless: el símbolo saldría como caja
   vacía en una ficha que va a cliente. `scripts/cobertura-glifos.test.ts`
   verifica que ningún texto de una ficha use un carácter sin cobertura, así
   que este caso no puede volver por descuido.

## Lo que este cambio rompe

- Las capturas de referencia de M2 (`capturas/comparacion-hoja*.png`) quedan
  obsoletas: comparan contra la ficha de la tuerca con el estilo viejo.
- El criterio de aceptación de M2 —«la ficha de referencia renderizada es
  indistinguible del original»— pasa a medirse contra esta plantilla, no contra
  el PDF de la tuerca.
- La ficha de la tuerca se re-renderiza con los encabezados en grafito y el
  cuerpo en 9pt. Sigue saliendo en 2 hojas A4, que es su criterio de M4.
- `DatosFicha.catalogo` pasa a ser `familia`, y se suma `revision`: la segunda
  línea de la cabecera es `V26 · Rev. 01 · 2026`, donde la revisión es el `n`
  de `ficha_revision`. No hace falta migración: `ficha.version` ya era texto
  libre.
- `Medidas` deja de exponer cabecera, pie y alto útil por separado; ahora dice
  directamente cuánto lugar hay en la primera hoja y en las interiores, que son
  distintas. El medidor usa las MISMAS cabeceras que la ficha, no una copia:
  si midieran distinto, el paginado cortaría en el lugar equivocado.
