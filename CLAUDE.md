# App de Fichas Técnicas — FAMIQ

Documento de diseño cerrado. Las decisiones acá **no se redefinen sin consultar**. Si algo no está
especificado, preguntar antes de asumir. No sobre-ingenierizar: si una feature no está en el
milestone actual, no se implementa "por si acaso".

Idioma de todo el producto y del código de cara al usuario: **castellano**. Comentarios y commits
también en castellano.

---

## 1. Objetivo

Aplicación web interna donde el equipo de Oficina Técnica carga y corrige fichas técnicas de
producto, y el sistema las renderiza en PDF A4 con una estética fija e inalterable.

Tres requisitos que definen el producto:

1. **La estética es invariante.** El contenido y los campos cambian ficha a ficha; el layout, la
   tipografía y el color nunca. Esto se garantiza estructuralmente (ver §4), no por disciplina del
   usuario.

   > **Precisión, agosto 2026.** Los símbolos de cota sobre una imagen (§4, `marcas`) son la única
   > cosa que el usuario posiciona libremente, porque una cota tiene que apuntar a lo que mide y eso
   > es un dato inherentemente posicional. Lo que sigue siendo invariante es la APARIENCIA: el tipo
   > de letra, el cuerpo, el color, el recuadro y el fondo los fija `ficha.css` y no hay ningún
   > campo que los cambie. El usuario elige dónde, nunca cómo se ve.
2. **Toda corrección queda registrada.** Quién, cuándo, qué cambió. Historial auditable, no un
   `updated_at`.
3. **Botón de revisión con IA.** La IA revisa y propone mejoras sobre contenido ya cargado. No
   completa, no inventa.
4. **Carga de una ficha desde su PDF.** Un borrador en PDF se transcribe a bloques (§4bis). Es
   trabajo mecánico de tipeo, y ninguna transcripción entra al historial sin que una persona la
   apruebe.

### Fuera de alcance (v1)

- Detección automática de familia por similitud. Las familias se guardan manualmente como plantilla.
- Generación de croquis técnicos por IA desde cero (ver §7).
- Catálogo unificado multi-ficha.
- Extracción de tablas dimensionales desde PDFs de **normas** (una norma es un documento de decenas
  de páginas con tablas que no son la ficha; transcribir un borrador de ficha de una o tres páginas,
  que sí está en alcance, es otro problema — ver §4bis).
- Rasterizado de dibujos vectoriales de un PDF. Medido sobre la plantilla V26 y sobre la ficha del
  disco Steelox, los vectores de una ficha son el fondo de la hoja, las bandas, las reglas y los
  marcos de las figuras — cromo del layout. Las fotos, croquis, despieces y curvas vienen como
  bitmap y sí se extraen (§4bis regla 5). Si algún día aparece un croquis vectorial, se sube a mano.
- Integración con SAP.

> **Cambio de alcance, agosto 2026.** "Extracción desde PDF" estaba fuera de alcance completo. El
> pedido de Oficina Técnica fue explícito: cargar el PDF y que la app arme la ficha, con ajustes
> posteriores a mano. Se acotó a lo que no arriesga el requisito 2 —transcribir un borrador de ficha,
> sin guardar— y se implementó como §4bis.

---

## 2. Stack

| Capa | Elección |
|---|---|
| Front + API | Next.js (App Router), TypeScript, Vercel |
| DB / Storage / Auth | Supabase (Postgres + Storage + Auth), RLS activo |
| Estilos | CSS del template original, portado a CSS Modules o vanilla CSS. **No Tailwind para la ficha** |
| PDF | `puppeteer-core` + `@sparticuz/chromium` en route handler |
| IA | Anthropic API (`claude-haiku-4-5-20251001`) desde route handler server-side |

La API key de Anthropic vive **solo** en el servidor. Nunca en un componente cliente, nunca en una
variable `NEXT_PUBLIC_*`.

---

## 3. Fuente de verdad estética

La fuente única de verdad visual es `referencia/Plantilla ficha tecnica FAMIQ V26.pdf` — la plantilla
"Válvula esférica 3 cuerpos Socket Weld", de 3 páginas A4. Reemplazó al HTML/CSS original de
`templates/ficha-tecnica/`, que queda como referencia histórica. El cambio, lo que revirtió y lo que
rompió están en `docs/rediseno-plantilla-v26.md`.

Los valores de `src/components/ficha/ficha.css` se miden sobre ese PDF: geometría, tamaños de
tipografía, colores y tracking. No se ajustan a ojo. No rediseñar, no "mejorar" el diseño, no cambiar
spacing ni tipografías. Si un valor parece raro, dejarlo como está y anotarlo.

La misma vista React se usa para el preview en pantalla y para el render del PDF. Nunca dos
implementaciones.

### Tipografías

El template usa una sans condensada con tracking amplio en etiquetas. Los `woff2` van **embebidos en
el repo** (`public/fonts/`) y declarados con `@font-face` local. Prohibido cargarlas desde un CDN: el
Chromium serverless no siempre resuelve fuentes externas y el PDF sale con fallback, rompiendo la
maqueta. Esto es un criterio de aceptación de la milestone 4.

---

## 4. Modelo de bloques

Una ficha **no** tiene un schema de campos fijo. Es un array ordenado de bloques tipados. Cada tipo
de bloque tiene un componente React y un estilo propio. Los campos varían libremente; la estética no
puede variar porque el usuario solo elige entre tipos existentes.

Tipos de la v1. Los once primeros vienen de la ficha de referencia "Tuerca autofrenante con inserto
de nylon"; los cuatro últimos se agregaron con la plantilla V26 "Válvula esférica 3 cuerpos Socket
Weld" (ver `docs/rediseno-plantilla-v26.md`):

| Tipo | Contenido | Notas |
|---|---|---|
| `header` | Categoría, subcategoría, título ES, subtítulo EN, foto de producto | Uno por ficha, siempre primero |
| `tabla-kv` | Lista etiqueta → valor | Ej. "Normas aplicables" |
| `par-texto` | Dos bloques de texto a dos columnas con su etiqueta | Ej. "Clase de resistencia" / "Condiciones de servicio" |
| `tabla` | Tabla con encabezados y N columnas | Ej. "Propiedades mecánicas" |
| `inline-kv` | Etiqueta + valor en una línea | Ej. "Materiales disponibles" |
| `texto-rico` | Párrafos. Negrita e itálica únicamente | Ej. "Descripción" |
| `chips` | Lista de etiquetas cortas | Ej. "Aplicaciones típicas" |
| `croquis` | Imagen/SVG + leyenda de cotas (símbolo → significado) | Asset desde la librería de la familia |
| `tabla-dim` | Una o dos tablas dimensionales a dos columnas, con unidad | Ej. métricas / pulgadas |
| `barra-destacada` | Etiqueta + valor sobre fondo gris | Ej. "Presentación" |
| `chart` | SVG generado server-side desde una tabla de datos | Sin IA. Milestone 6 |
| `imagen` | Imagen con rótulo opcional, sufijo y marco opcional | Ej. "Presión / temperatura", el despiece. Asset desde la librería de la familia |
| `lista-componentes` | Ítem numerado → componente → material → cantidad, con banda de encabezado oscura. Se reparte en dos columnas | Ej. "Lista de componentes". Las cuatro columnas son fijas: el número remite al croquis |
| `tabla-ancha` | Tabla de N columnas a ancho completo, con banda oscura y nota que define los símbolos | Ej. "Dimensiones y códigos". La nota es obligatoria |
| `codigos` | Pares código → medida en dos columnas, con imagen y nota opcionales | Ej. "Repuestos · Kit de sellos" |

Variantes, que no son tipos nuevos:

- `tabla-kv` con `orientacion: "vertical"`: rótulo arriba del valor en vez de a su izquierda. Es la
  disposición que necesita una columna angosta. Mismos campos, misma estética.
- `croquis` e `imagen` con `marcas`: símbolos colocados ENCIMA de la imagen, en el punto que miden.
  Las coordenadas van en porcentaje de la caja de la imagen, no en píxeles, así la marca cae en el
  mismo punto del dibujo en pantalla, en el PDF y con el bloque a un tercio o a ancho completo. Se
  colocan arrastrándolas sobre la hoja en el editor. La leyenda de `croquis.cotas` sigue existiendo
  y es otra cosa: la lista símbolo → significado que va al costado. Ver la precisión de §1
  requisito 1 sobre por qué la posición es libre y la apariencia no.

Reglas:

- Agregar un tipo nuevo es una decisión de producto: requiere componente, estilo y entrada en esta
  tabla. No se agregan tipos ad hoc para una ficha puntual.
- Ningún bloque acepta HTML libre ni CSS inline del usuario.
- El paginado A4 lo maneja el CSS (`@page`, `page-break`). Los bloques no declaran en qué página van;
  el título de una hoja interior lo aporta el bloque que la abre (`tituloHoja`), no la hoja.
- La hoja es una grilla de **12 pistas**. Un bloque declara su ancho como una de cuatro fracciones
  de esas 12 —`un-tercio` (4), `medio` (6), `dos-tercios` (8), `completo` (12)— y nada más. Un
  bloque alto puede declarar `filasGrilla: 2` para que los dos bloques que lo siguen se apilen a su
  costado.

---

## 4bis. Carga de una ficha desde su PDF

Botón **"Cargar desde PDF"** en el editor. Sube un PDF de ficha ya maquetada y la transcribe al array
de bloques de §4.

Es el flujo inverso al PDF de §8 M4: ahí la app dibuja una ficha a partir de bloques; acá lee una
ficha dibujada y recupera los bloques. Sirve para el catálogo que ya existe en PDF y para los
borradores que Oficina Técnica arma en Word o InDesign antes de cargarlos.

### Reglas duras

1. **NO GUARDA.** El resultado se carga en el editor como borrador, sin tocar la base. La revisión la
   crea la persona al apretar guardar. `ficha_revision` sigue teniendo únicamente cambios que alguien
   aprobó, que es el requisito 2 de §1 — la transcripción ahorra tipeo, no reemplaza la revisión
   humana.
2. **NO INVENTA.** Si un dato no está en el PDF, el campo queda vacío. Misma regla que §6.1 y por el
   mismo motivo: un campo vacío se ve y se corrige, un dato plausible no lo cuestiona nadie.
3. **NO CORRIGE.** Un error de tipeo o una norma mal atribuida se transcriben tal cual. Corregir es
   tarea del revisor (§6) y de la persona, con su rastro en el historial. Una transcripción que
   corrige hace desaparecer el error sin que nadie lo haya decidido.
4. **Lo que no entra en un bloque se informa.** Pictogramas, sellos, iconos sin texto: van a una
   lista "no se transcribió" que se le muestra a la persona. No se fuerzan dentro de un bloque ni se
   descartan en silencio.
5. **Las imágenes se extraen, pero no las extrae el modelo.** Las saca `src/lib/pdf/imagenes.ts`
   del PDF, sin IA: los rectángulos salen del texto estructurado y cada región se **renderiza sobre
   blanco**, no se copia del objeto embebido. La diferencia no es cosmética: la foto del disco
   Steelox tiene su transparencia en una máscara suave aparte, y el objeto embebido por sí solo es
   la foto sobre negro. Renderizando la región, MuPDF compone la máscara y lo que haya encima, y
   sale lo que se ve en el PDF; de paso entran los rótulos que son parte de la figura sin ser parte
   del bitmap, como las leyendas de la escala de dureza.
   El modelo recibe un inventario —`imagen1`, `imagen2`…, con hoja y posición— y su única decisión
   es a qué bloque pertenece cada una. Elige de una lista cerrada: una referencia que no está en el
   inventario se descarta, igual que un `bloque_id` inexistente en el revisor. Así no puede inventar
   una imagen ni recortar mal una cota.

   Sólo se sube lo que quedó asignado a un bloque, y deduplicado por hash del contenido: §7 dice que
   un croquis se sube una vez y todas las fichas de la familia lo reusan, y sin deduplicar cada
   ficha cargada desde su PDF metería su propia copia. Una imagen del inventario que el modelo no
   usó va a la lista "no se transcribió" (regla 4) en vez de ensuciar la librería — es lo que pasa
   con la píldora de unidad de negocio, que sale del catálogo fijo y no de la ficha.

   Un bloque sin imagen asignada queda como antes: sin `assetId` y con su `alt` describiendo qué
   imagen va, para que la persona la elija de la librería.

### Implementación

- `src/lib/ia/extractor.ts` — prompt y schema. El schema es **una sola forma plana** para los
  catorce tipos transcribibles, no una unión discriminada: con la unión, la API rechaza el pedido
  porque la gramática compilada de los structured outputs se vuelve demasiado grande. El modelo llena
  los campos que aplican y `aBloques` los traduce al bloque real, descartando lo que venga vacío.
- `src/lib/pdf/imagenes.ts` — extracción de las imágenes y filtro de cromo. Determinístico, sin IA.
  El filtro descarta por cuatro señales geométricas: área de colocación menor al 0,6% de la hoja,
  lado mayor menor a 120 px, relación de aspecto mayor a 8:1, y repetición en todas las hojas (que
  es el logo). Calibrado sobre las dos fichas de `referencia/`: en la del disco, las tres figuras
  reales ocupan 11,8%, 3,1% y 1,0% de la hoja y los ocho pictogramas 0,16% o menos. El recorte se
  renderiza a la resolución del bitmap de origen, acotada entre 150 y 300 DPI, y se guarda en PNG o
  JPEG según cuál pese menos — una foto gana en JPEG, un dibujo de líneas gana en PNG y además sale
  sin ringing. El hash de deduplicación es del objeto embebido, no del recorte: identifica la imagen
  sin depender de dónde esté colocada. `mupdf` se importa de forma diferida: usa top-level await y
  arrastra 10 MB de WASM.
- La respuesta del modelo pasa por `normalizarPresentacion` antes de validarse. Corrige **sólo**
  campos que no llevan datos del producto —`ancho`, `orientacion`, `marco`, la alineación de una
  columna— con un valor por omisión fijo. Existe por un caso real: el modelo devolvió `orientacion`
  fuera del enum en los ocho bloques de una ficha y se descartaba la transcripción completa. Un
  campo de contenido nunca se completa ni se adivina; para eso está la regla 2.
- `src/lib/pdf/subir-imagenes.ts` — sube a la librería de la familia lo asignado. El hash del
  contenido va en el nombre del archivo y es la clave de deduplicación.
- `POST /api/fichas/[id]/extraer` — recibe el PDF, devuelve bloques. No toca `ficha_revision`; lo
  único que escribe son los assets de las imágenes asignadas.
- `chart` queda afuera: sus series son datos numéricos y el SVG lo dibuja el servidor (§7).

Modelo: `ANTHROPIC_MODELO_EXTRACCION`, y si no está, el mismo del revisor. Medido con Haiku: la ficha
del disco (una hoja, 3 imágenes) ~35 s y ~6.100 tokens de entrada; la plantilla V26 (tres hojas, 5
imágenes) ~37 s y ~10.700. El tamaño del PDF pesa menos que la cantidad de bloques a emitir.

---

## 5. Modelo de datos

```sql
producto        id, sku, nombre_es, nombre_en, categoria, subcategoria, familia_id, created_at
familia         id, nombre, plantilla_bloques jsonb, created_at   -- estructura sin datos
ficha           id, producto_id, estado, revision_actual_id, created_at
ficha_revision  id, ficha_id, n, bloques jsonb, autor_id, comentario, created_at
sugerencia_ia   id, revision_id, bloque_id, campo, texto_original, texto_propuesto,
                motivo, severidad, estado, decidido_por, decidido_at
norma           id, codigo, edicion_anio            -- "ASME B18.16.6", 2020
asset           id, tipo, storage_path, familia_id, alt, created_at   -- tipo: foto | croquis
```

### Invariantes (no negociables)

1. **`ficha_revision` es append-only.** Nunca `UPDATE`, nunca `DELETE`. Cada guardado inserta una
   fila nueva con `n = anterior + 1`, su autor y su comentario. Revocar el `UPDATE`/`DELETE` a nivel
   de política RLS, no solo evitarlo en el código de la app.
2. **`norma.edicion_anio` es `NOT NULL`.** Una norma sin año de edición no se puede guardar.
3. **`sugerencia_ia.decidido_por` y `decidido_at`** se completan siempre que `estado != 'pendiente'`.
   Toda propuesta de la IA queda con rastro de quién la aceptó o rechazó.
4. `estado` de ficha: `borrador → en_revision → aprobada → publicada`. Solo `aprobada` y `publicada`
   exportan PDF sin marca de agua.

### Diff de revisiones

Pantalla que compara dos revisiones cualesquiera de una ficha y muestra las diferencias a nivel de
bloque y de campo. Es la materialización del requisito 2; no es opcional ni "nice to have".

---

## 6. Revisor con IA

Un botón por ficha: **"Revisar con IA"**. Route handler server-side que recibe los bloques de la
revisión actual y devuelve hallazgos.

### Reglas duras del prompt

1. **No inventar ni completar.** Si un dato falta, se reporta como hallazgo con severidad, jamás se
   rellena con un valor plausible.
2. **Propuestas por campo, no reescrituras.** Salida en JSON estricto, sin markdown ni preámbulo:
   `[{bloque_id, campo, original, propuesta, motivo, severidad}]`.
   `severidad`: `error | inconsistencia | mejora`.
3. **Nada se aplica automáticamente.** La UI muestra cada hallazgo como diff con aceptar/rechazar
   individual. Cada decisión se persiste en `sugerencia_ia`.
4. Si la respuesta no parsea como JSON válido, se descarta y se informa el fallo. No se intenta
   recuperar con regex.

### Qué debe buscar (en este orden de prioridad)

1. **Errores técnicos de designación normativa.** Ej. atribuir rosca Whitworth/BSW a ASME B18.16.6,
   que es serie unificada UNC/UNF.
2. **Coherencia texto ↔ tabla.** Ej. la descripción dice "desde 1/8\"" y la tabla dimensional arranca
   en 1/4".
3. **Nomenclatura inconsistente de normas.** Ej. la misma norma citada como ASME en el header y ANSI
   en la descripción.
4. **Campos de trazabilidad vacíos.** Normas sin año de edición, materiales sin designación AISI.
5. Redacción: solo al final y solo si no hay hallazgos de los tipos anteriores. Nunca reescribir el
   tono técnico ni "mejorar el estilo" por iniciativa propia.

La ficha de referencia adjunta contiene los cuatro primeros casos reales; sirve como fixture de test
del revisor.

---

## 7. Croquis y gráficos

Dos problemas distintos, no mezclar:

- **`chart`** (datos numéricos): SVG generado server-side desde la tabla del bloque. Determinístico,
  sin IA.
- **`croquis`** (esquema técnico con cotas): **librería de assets por familia.** Se sube una vez, se
  asocia a la familia, y todas las fichas de esa familia lo reusan con su leyenda editable. Los
  símbolos que van encima del dibujo son del BLOQUE, no del asset (§4, `marcas`): el mismo croquis
  reusado por dos fichas puede llevar cotas distintas sin duplicar la imagen.

Prohibido en v1: generar croquis con IA desde cero. Produce geometría plausible pero incorrecta y
cotas mal ubicadas, lo cual es inaceptable en una ficha que va a cliente. En una versión futura, la
IA puede como máximo redibujar un croquis existente al estilo estándar o vectorizar un boceto, con
validación visual humana obligatoria.

---

## 8. Milestones

Cada milestone termina en algo usable y desplegado. No arrancar la siguiente sin cumplir los
criterios de aceptación de la anterior.

### M1 — Base
Schema Supabase completo con RLS y las invariantes de §5 como políticas/constraints. Auth con
Supabase. CRUD de producto y ficha. Sin editor de bloques, sin IA, sin PDF.
*Aceptación:* un intento de `UPDATE` sobre `ficha_revision` falla a nivel de base de datos.

### M2 — Render
Template portado a componentes React por tipo de bloque. Vista de ficha en pantalla, pixel-fiel al
HTML original. Datos hardcodeados o desde DB.
*Aceptación:* la plantilla V26 renderizada es indistinguible del original en captura.

### M3 — Editor y revisiones
Editor de bloques (agregar, reordenar, eliminar, editar campos). Cada guardado crea una revisión.
Historial + pantalla de diff entre revisiones. Estados de ficha.
*Aceptación:* se puede reconstruir quién cambió qué y cuándo, para cualquier corrección.

### M4 — PDF
Export A4 con `puppeteer-core` + `@sparticuz/chromium`. Fuentes embebidas. Marca de agua BORRADOR
si el estado no es `aprobada`/`publicada`.
*Aceptación:* la plantilla V26 sale en exactamente 3 páginas A4 y la ficha de la tuerca en 2, sin
página en blanco, con las tipografías correctas y sin ningún carácter sin cobertura en los subsets
embebidos.

### M5 — Revisor IA
Botón, endpoint, panel de hallazgos con aceptar/rechazar por campo, persistencia en `sugerencia_ia`.
*Aceptación:* sobre la ficha de referencia, detecta los 4 hallazgos de §6 y no propone ningún cambio
que invente datos.

### M6 — Familias y assets
Guardar ficha como plantilla de familia. Nueva ficha desde plantilla. Librería de croquis y fotos por
familia. Bloque `chart`.

---

## 9. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Bundle de Chromium excede el límite de la función serverless | Fallback a runner self-hosted (NB-JORTIZ2) o servicio de browser gestionado. Decidir en M4, no antes |
| Fuentes no resuelven en el PDF | `woff2` en el repo, `@font-face` local. Test visual en M4 |
| Deriva estética por agregado de tipos de bloque ad hoc | §4: agregar tipo es decisión de producto, con entrada en la tabla |
| La IA "mejora" datos técnicos correctos | §6 regla 1 y prioridad 5. Fixture de test con la ficha de referencia |
| Sobre-ingeniería del modelo de datos | Este documento ya recortó el alcance respecto de diseños previos. No reintroducir extracción de normas ni schemas por familia |
| La transcripción del PDF mete un dato que el PDF no dice | §4bis reglas 2 y 3. La transcripción no se guarda: queda en el editor para revisar. `scripts/extractor.test.ts` cubre el descarte de bloques vacíos |
| Se confía en la transcripción y nadie la revisa | El estado nace `borrador`, así que el PDF sale con marca de agua hasta que alguien lo apruebe (§5 invariante 4). Lo no transcripto se muestra en pantalla, no en un log |
| La extracción de una ficha de tres hojas no entra en los 60 s de Vercel Hobby | Medido: una hoja ~35 s, tres hojas ~37 s. Entra, pero con poco margen. Si una ficha lo pasa, partir el PDF o mover la extracción a un trabajo asincrónico — no subir `maxDuration` a ciegas |
| El filtro de imágenes deja pasar cromo (un logo, una píldora) y ensucia la librería de la familia | Sólo se sube lo que el modelo asigna a un bloque. Lo que sobrevive al filtro y no se usa se informa en pantalla. `scripts/imagenes-pdf.test.ts` fija el filtro contra las dos fichas de `referencia/` |
| La misma imagen se sube una vez por ficha y la librería de §7 queda inservible | Deduplicación por hash del contenido en el nombre del archivo. Un E2E carga el mismo PDF en dos fichas y verifica que el assetId es el mismo |
| El modelo asigna una imagen al bloque equivocado | Elige de un inventario cerrado, así que el error posible es de emparejamiento, no de invención: la imagen existe y está en la ficha, sólo en el bloque de al lado. Se ve en el preview y se cambia con el selector de assets del editor |
| El recorte de una figura arrastra texto vecino que cae dentro de su rectángulo | Es el comportamiento buscado: los rótulos de la escala de dureza son parte de la figura y no del bitmap. El riesgo es un rectángulo que se solape con texto ajeno; se ve en el preview y el bloque se puede dejar sin imagen |
| Los símbolos de cota sobre la imagen abren la puerta a la deriva estética | La posición es libre pero la apariencia la fija `ficha.css` y no hay campo que la cambie (§1 requisito 1, precisión). Una marca mal ubicada se ve en el lienzo, que es la misma vista que el PDF |
| Un bloque apunta a un asset que la librería de su familia no cubre y queda un hueco | `assetsDeFamilia` recibe los bloques y resuelve además todo asset referenciado, sea de otra familia o de ninguna. Pasa con las imágenes de un PDF cuando el producto todavía no tiene familia |
