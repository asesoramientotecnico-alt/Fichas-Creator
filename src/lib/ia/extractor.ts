import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AnchoBloque, AssetTipo, Bloque } from "@/lib/tipos";
import {
  describirImagen,
  imagenesDePdf,
  inventarioParaModelo,
  type ImagenExtraida,
} from "@/lib/pdf/imagenes";

/**
 * Extracción de bloques desde un PDF de ficha ya maquetado (§4bis).
 *
 * Qué hace y qué NO hace, porque la diferencia es todo:
 *
 * - TRANSCRIBE: lee el PDF y arma el array de bloques con el contenido que
 *   ya está escrito ahí. Es el trabajo mecánico de pasar un borrador a la
 *   estructura de la app.
 * - NO INVENTA: si un dato no está en el PDF, el campo queda vacío. Nunca
 *   completa un año de edición, una designación, una medida ni una unidad que
 *   no esté impresa. Es la misma regla dura que §6.1 para el revisor, y por
 *   el mismo motivo: un dato plausible que nadie cuestiona es peor que un
 *   campo vacío que se ve.
 * - NO GUARDA: el resultado es un borrador que se abre en el editor. La
 *   revisión la crea la persona cuando aprieta guardar, así que
 *   `ficha_revision` sigue teniendo sólo cambios que alguien aprobó (§1
 *   requisito 2). La extracción ahorra tipeo, no reemplaza la revisión
 *   humana.
 *
 * Las imágenes SÍ se extraen, pero no las extrae el modelo: las saca
 * `src/lib/pdf/imagenes.ts` del PDF, byte a byte y sin IA. Al modelo se le
 * pasa un inventario —`imagen1`, `imagen2`…— con la hoja y la posición de
 * cada una, y lo único que decide es a qué bloque pertenece cada imagen,
 * escribiendo su id en `imagenRef`. Elige de una lista cerrada: un id que no
 * está en el inventario se descarta, igual que un `bloque_id` inexistente en
 * el revisor. Así el modelo no puede inventar una imagen ni recortar mal una
 * cota.
 *
 * Sólo se sube lo que quedó asignado a un bloque. Una imagen del inventario
 * que el modelo no usó se le informa a la persona en vez de ensuciar la
 * librería de la familia: es lo que pasa con la píldora de unidad de negocio,
 * que sale del catálogo fijo y no de la ficha.
 */

/** Haiku por omisión, igual que el revisor: la extracción es trabajo mecánico. */
const MODELO = process.env.ANTHROPIC_MODELO_EXTRACCION
  ?? process.env.ANTHROPIC_MODEL
  ?? "claude-haiku-4-5-20251001";

const TAMANO_MAX = 12 * 1024 * 1024;

export class ErrorExtraccion extends Error {}

// ------------------------------------------------------------
// Schema de salida
// ------------------------------------------------------------
// Es el subconjunto de §4 que se puede transcribir de un PDF. Queda afuera
// `chart`, que no se transcribe: sus series son datos numéricos y el SVG lo
// dibuja el servidor (§7).

const ANCHOS = ["completo", "dos-tercios", "medio", "un-tercio"] as const;
const ANCHO = z.enum(ANCHOS);

const TIPOS = [
  "header",
  "texto-rico",
  "tabla-kv",
  "tabla",
  "tabla-ancha",
  "tabla-dim",
  "chips",
  "inline-kv",
  "par-texto",
  "barra-destacada",
  "imagen",
  "croquis",
  "lista-componentes",
  "codigos",
] as const;

/**
 * Una sola forma plana para todos los tipos, en vez de una unión discriminada
 * de catorce variantes: con la unión, la API rechaza el pedido porque la
 * gramática compilada de los structured outputs se vuelve demasiado grande.
 *
 * El modelo llena los campos que aplican al tipo y deja el resto vacío;
 * `aBloques` los traduce al bloque real. Campos con la misma forma se
 * comparten a propósito —`lineas` sirve a texto-rico y a chips, `pares` a
 * tabla-kv y a codigos— para que la gramática quede chica.
 */
const BloqueExtraido = z.object({
  tipo: z.enum(TIPOS),
  ancho: ANCHO,

  /** Rótulo de sección. Casi todos los tipos lo llevan. */
  etiqueta: z.string(),
  /** Texto chico a la derecha del rótulo. */
  sufijo: z.string(),
  /** Nota al pie: obligatoria en tabla-ancha, opcional en codigos. */
  nota: z.string(),
  /** Descripción de la imagen del bloque (imagen, codigos, header). */
  alt: z.string(),
  /**
   * Id del inventario de imágenes que le corresponde a este bloque
   * (`imagen1`, `imagen2`…), o "" si no lleva imagen. Aplica a header (la foto
   * de producto), imagen, croquis y codigos.
   */
  imagenRef: z.string(),
  /** Valor único: inline-kv y barra-destacada. */
  valor: z.string(),

  /** header. */
  familia: z.string(),
  subfamilia: z.string(),
  tituloEs: z.string(),
  subtituloEn: z.string(),

  /** tabla-kv: `horizontal` si el rótulo va a la izquierda del valor. */
  orientacion: z.enum(["horizontal", "vertical"]),
  /** imagen: true si en el PDF la figura tiene recuadro. */
  marco: z.boolean(),

  /** texto-rico (párrafos) y chips (etiquetas cortas). */
  lineas: z.array(z.string()),

  /** tabla y tabla-ancha. */
  columnas: z.array(
    z.object({ titulo: z.string(), alineacion: z.enum(["izquierda", "derecha"]) }),
  ),
  filas: z.array(z.array(z.string())),

  /** tabla-kv (rótulo → valor) y codigos (código → medida). */
  pares: z.array(z.object({ izquierda: z.string(), derecha: z.string() })),

  /** croquis: leyenda de cotas. */
  cotas: z.array(z.object({ simbolo: z.string(), nombre: z.string() })),

  /** tabla-dim: una o dos tablas dimensionales con su unidad. */
  tablas: z.array(
    z.object({
      etiqueta: z.string(),
      unidad: z.string(),
      columnas: z.array(z.string()),
      filas: z.array(z.array(z.string())),
    }),
  ),

  /** lista-componentes: ítem numerado → componente → material → cantidad. */
  componentes: z.array(
    z.object({
      n: z.string(),
      componente: z.string(),
      material: z.string(),
      cantidad: z.string(),
    }),
  ),

  /** par-texto: exactamente dos bloques de prosa a dos columnas. */
  ladoIzquierdo: z.object({ etiqueta: z.string(), texto: z.string() }),
  ladoDerecho: z.object({ etiqueta: z.string(), texto: z.string() }),
});

const Respuesta = z.object({
  /** Los bloques en el orden en que se leen en el PDF. */
  bloques: z.array(BloqueExtraido),
  /**
   * Contenido del PDF que el modelo NO pudo transcribir a un bloque: iconos
   * sin texto, sellos, marcas de agua. Se le muestra a la persona para que
   * decida, en vez de perderlo en silencio.
   */
  omitido: z.array(z.string()),
});

export type BloqueExtraido = z.infer<typeof BloqueExtraido>;

/**
 * Traduce una referencia del inventario (`imagen2`) al assetId ya subido.
 * Devuelve undefined si la referencia no existe o la imagen no se pudo subir.
 */
export type ResolverImagen = (ref: string) => string | undefined;

export const SISTEMA = `Transcribís fichas técnicas de producto de FAMIQ (distribuidor de acero inoxidable) desde un PDF ya maquetado hacia una estructura de bloques tipados.

Tu tarea es MECÁNICA: pasar lo que está escrito en el PDF a la estructura. No sos autor de la ficha.

# Reglas que no podés violar

1. TRANSCRIBÍ, NO INVENTES. Cada carácter que pongas en un campo tiene que estar en el PDF. Si un dato no está, el campo va vacío (""). Está prohibido completar años de edición de normas, designaciones AISI/ASTM, medidas, unidades, códigos o cualquier valor que no esté impreso. Un campo vacío se ve y se corrige; un dato inventado que parece plausible no lo cuestiona nadie y llega al cliente.

2. NO CORRIJAS. Si el PDF tiene un error de tipeo, una norma mal atribuida o una unidad inconsistente, transcribilo TAL CUAL. Corregir es tarea del revisor y de la persona, con su rastro en el historial. Si transcribís corrigiendo, el error desaparece sin que nadie lo haya decidido.

3. NO RESUMAS NI REDACTES. Los párrafos van completos y textuales. No unas dos oraciones en una, no acortes, no mejores el estilo.

4. LO QUE NO ENTRA EN UN BLOQUE VA A "omitido". Si el PDF tiene iconos sin texto, sellos de certificación, pictogramas o cualquier cosa que no puedas transcribir, describila en el array "omitido". No la fuerces dentro de un bloque ni la descartes.

5. LAS IMÁGENES NO LAS ELEGÍS VOS, LAS ASIGNÁS. Al final de este mensaje viene el inventario de las imágenes que ya se extrajeron del PDF, cada una con su id, su hoja y su posición. Tu única decisión es a qué bloque pertenece cada una: escribís su id en "imagenRef". No inventes ids que no estén en el inventario y no uses el mismo id en dos bloques.

# Cómo elegir el tipo de bloque

- header: el título del producto. UNO por ficha, SIEMPRE el primero. Llená "tituloEs", "subtituloEn" (si hay nombre en inglés), "familia" y "subfamilia" (la clasificación que suele ir arriba a la derecha o bajo el título) y "alt" describiendo la foto de producto.
- texto-rico: párrafos de prosa bajo un título de sección ("Descripción", "Aplicación", "Ventajas", "Características"). Cada viñeta o párrafo del PDF es un elemento de "lineas".
- tabla-kv: lista de etiqueta → valor, una por línea ("Datos técnicos", "Normas aplicables"). Va en "pares": "izquierda" es el rótulo, "derecha" el valor. Usá orientacion "vertical" sólo si en el PDF el rótulo está ARRIBA del valor en una columna angosta; si está a la izquierda, "horizontal".
- tabla: tabla con encabezados de columna y varias filas. Llená "columnas" y "filas" (una fila es un array de celdas, en el mismo orden que las columnas).
- tabla-ancha: como tabla ("columnas" + "filas"), pero a ancho completo con una nota al pie que define los símbolos de las columnas. Usala cuando la tabla tenga columnas con símbolos (Ød, ØD, P, W) que la nota explica. El campo "nota" es obligatorio.
- tabla-dim: una o dos tablas dimensionales con su unidad (métricas / pulgadas). Van en "tablas".
- chips: lista de etiquetas cortas, sueltas, tipo palabras clave ("Aplicaciones típicas: agua, vapor, aire"). Cada una es un elemento de "lineas".
- inline-kv: una sola etiqueta y su valor en una línea ("etiqueta" + "valor").
- par-texto: exactamente dos bloques de prosa a dos columnas, cada uno con su título. Van en "ladoIzquierdo" y "ladoDerecho".
- barra-destacada: un dato único resaltado sobre fondo, tipo "Presentación: caja x 100" ("etiqueta" + "valor").
- imagen: una figura con rótulo (un gráfico, un despiece, una curva). "alt" describe qué se ve, con el detalle suficiente para que alguien que no ve la imagen entienda qué dato aporta. "marco" true si en el PDF la figura tiene recuadro.
- croquis: esquema técnico CON leyenda de cotas (símbolo → significado), en "cotas". Sólo si el PDF trae esa leyenda; si la figura no tiene leyenda de cotas, usá imagen.
- lista-componentes: tabla de ítem numerado → componente → material → cantidad, típica de un despiece. Va en "componentes".
- codigos: pares código → medida, tipo lista de repuestos. Van en "pares": "izquierda" es el código, "derecha" la medida.

# Anchos

La hoja es una grilla de 12 pistas. "completo" (12) ocupa todo el ancho; "medio" (6) media hoja; "dos-tercios" (8) y "un-tercio" (4) para una figura ancha con secciones angostas al costado.

Reglas: el header siempre "completo". Una tabla de muchas columnas, "completo". Dos secciones que en el PDF están lado a lado, "medio" cada una. Una sección corta que en el PDF ocupa toda la línea, "completo".

# Imágenes

El inventario del final lista las imágenes con su id, hoja y posición. Los cuatro tipos que llevan imagen son header (la foto de producto), imagen, croquis y codigos: en esos, "imagenRef" lleva el id de la imagen del inventario que corresponde. En todos los demás va "".

Para emparejar, usá la posición: la imagen que está arriba a la derecha de la primera hoja es casi siempre la foto de producto del header; una imagen que está justo debajo o al lado del rótulo de una sección pertenece a esa sección.

Reglas:
- El "alt" lo escribís igual, describiendo qué se ve en la imagen. Sirve para que la persona la reconozca y para lectores de pantalla.
- Si una imagen del inventario no le corresponde a ningún bloque, no la asignes. Se le informa a la persona; no la fuerces en un bloque para "usarla".
- La píldora de unidad de negocio —el óvalo de color con el nombre de la línea, arriba a la derecha— NO se asigna nunca. Sale de un catálogo fijo de la app, no de la ficha.
- Si el inventario está vacío, "imagenRef" va "" en todos los bloques.

# Campos que no aplican

El schema es una sola forma para todos los tipos, así que la mayoría de los campos no aplican al tipo que estás emitiendo. Dejá los que no aplican vacíos: "" en los textos y [] en los arrays.

CUIDADO con tres campos que NO admiten "" y tienen que llevar siempre uno de sus valores, incluso cuando no aplican al tipo:
- "orientacion": siempre "horizontal" o "vertical". Si el tipo no es tabla-kv, poné "horizontal".
- "ancho": siempre "completo", "dos-tercios", "medio" o "un-tercio".
- "marco": siempre true o false, nunca "" ni null. Si el tipo no es imagen, poné false.
- "alineacion" de cada columna: siempre "izquierda" o "derecha".

Los campos "sufijo", "nota", "subtituloEn" y "alt" van vacíos también cuando el tipo los admite pero el PDF no los tiene. No los rellenes con algo aproximado.

Escribís en castellano rioplatense. Los nombres de sección los transcribís tal como están en el PDF.`;

/** Cliente mínimo que necesita el extractor. Inyectable para poder probarlo. */
export interface ClienteExtraccion {
  extraer(
    sistema: string,
    pdfBase64: string,
    instruccion: string,
  ): Promise<{ parsed: unknown; uso?: { entrada: number; salida: number } }>;
}

function soportaAdaptativo(modelo: string): boolean {
  return /^claude-(opus-(5|4-[6-9])|sonnet-(5|4-6)|fable-5|mythos)/.test(modelo);
}

function clienteAnthropic(): ClienteExtraccion {
  return {
    async extraer(sistema, pdfBase64, instruccion) {
      const client = new Anthropic();
      const adaptativo = soportaAdaptativo(MODELO);

      // Se pide con `create` y no con `parse` a propósito. El formato sigue
      // restringiendo la generación igual, pero la validación queda de este
      // lado: `parse` valida adentro y tira, y así no se puede normalizar la
      // respuesta antes (ver `normalizarPresentacion`).
      const respuesta = await client.messages.create({
        model: MODELO,
        max_tokens: 16000,
        system: sistema,
        ...(adaptativo ? { thinking: { type: "adaptive" as const } } : {}),
        output_config: { format: zodOutputFormat(Respuesta) },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              },
              { type: "text", text: instruccion },
            ],
          },
        ],
      });

      if (respuesta.stop_reason === "refusal") {
        throw new ErrorExtraccion(
          `El modelo declinó la extracción (${respuesta.stop_details?.category ?? "sin categoría"}).`,
        );
      }

      const json = respuesta.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new ErrorExtraccion(
          "El modelo no devolvió JSON válido. Se descarta la extracción completa.",
        );
      }

      return {
        parsed,
        uso: {
          entrada: respuesta.usage.input_tokens,
          salida: respuesta.usage.output_tokens,
        },
      };
    },
  };
}

let contador = 0;

/**
 * Normaliza los campos de presentación de la respuesta antes de validarla.
 *
 * Existe por un caso real: el modelo devolvió `orientacion` fuera del enum en
 * los ocho bloques de una ficha, y la validación descartó la transcripción
 * completa. Perder una ficha entera porque el rótulo iba arriba en vez de al
 * costado es un mal negocio.
 *
 * La línea es clara y no la cruza: acá sólo se corrigen campos que NO llevan
 * datos del producto —cómo se dispone un rótulo, qué ancho ocupa un bloque, si
 * una columna alinea a izquierda o derecha—, con un valor por omisión fijo. Un
 * campo de contenido nunca se completa ni se adivina: eso es §4bis regla 2, y
 * si viene mal el bloque se cae o la extracción falla, como corresponde.
 */
function normalizarPresentacion(parsed: unknown): unknown {
  if (typeof parsed !== "object" || parsed === null) return parsed;
  const raiz = parsed as { bloques?: unknown };
  if (!Array.isArray(raiz.bloques)) return parsed;

  const unaDe = <T extends string>(valor: unknown, validos: readonly T[], porOmision: T): T =>
    typeof valor === "string" && (validos as readonly string[]).includes(valor)
      ? (valor as T)
      : porOmision;

  const bloques = raiz.bloques.map((b) => {
    if (typeof b !== "object" || b === null) return b;
    const bloque = b as Record<string, unknown>;
    const columnas = Array.isArray(bloque.columnas)
      ? bloque.columnas.map((c) =>
          typeof c === "object" && c !== null
            ? {
                ...(c as Record<string, unknown>),
                alineacion: unaDe(
                  (c as Record<string, unknown>).alineacion,
                  ["izquierda", "derecha"] as const,
                  "izquierda",
                ),
              }
            : c,
        )
      : bloque.columnas;

    return {
      ...bloque,
      ancho: unaDe(bloque.ancho, ANCHOS, "completo"),
      orientacion: unaDe(bloque.orientacion, ["horizontal", "vertical"] as const, "horizontal"),
      marco: typeof bloque.marco === "boolean" ? bloque.marco : false,
      columnas,
    };
  });

  return { ...raiz, bloques };
}

/** Id estable dentro de la extracción. El diff y la IA emparejan por id. */
function nuevoId(tipo: string): string {
  contador += 1;
  return `${tipo}-${Date.now().toString(36)}-${contador}`;
}

/**
 * Convierte la salida del modelo en bloques del dominio.
 *
 * Acá se cae todo lo que no tiene contenido: un bloque cuyo único aporte sea
 * su etiqueta no ayuda a nadie, y dejarlo obligaría a la persona a borrarlo a
 * mano. Los campos opcionales vacíos se sacan en vez de guardarse como "".
 */
export function aBloques(
  extraidos: BloqueExtraido[],
  resolverImagen: ResolverImagen = () => undefined,
): Bloque[] {
  const salida: Bloque[] = [];

  const limpio = (v: string) => {
    const t = v.trim();
    return t === "" ? undefined : t;
  };
  /**
   * El assetId de la imagen que el modelo asignó a este bloque. Devuelve
   * undefined si no asignó ninguna, si el id no existe en el inventario o si
   * la imagen no se pudo subir: en los tres casos el bloque queda sin imagen y
   * la persona la elige de la librería, que es el comportamiento anterior.
   */
  const asset = (e: BloqueExtraido) => resolverImagen(e.imagenRef.trim());
  const conDatos = (filas: string[][]) => filas.filter((f) => f.some((c) => c.trim() !== ""));

  for (const e of extraidos) {
    const base = { id: nuevoId(e.tipo), ancho: e.ancho as AnchoBloque };

    switch (e.tipo) {
      case "header": {
        if (!e.tituloEs.trim()) break;
        salida.push({
          ...base, tipo: "header",
          familia: e.familia.trim(),
          subfamilia: e.subfamilia.trim(),
          tituloEs: e.tituloEs.trim(),
          subtituloEn: limpio(e.subtituloEn),
          fotoAssetId: asset(e),
        });
        break;
      }

      case "texto-rico": {
        const parrafos = e.lineas.map((p) => p.trim()).filter(Boolean);
        if (parrafos.length === 0) break;
        salida.push({ ...base, tipo: "texto-rico", etiqueta: e.etiqueta.trim(), parrafos });
        break;
      }

      case "chips": {
        const items = e.lineas.map((i) => i.trim()).filter(Boolean);
        if (items.length === 0) break;
        salida.push({ ...base, tipo: "chips", etiqueta: e.etiqueta.trim(), items });
        break;
      }

      case "tabla-kv": {
        const filas = e.pares
          .filter((p) => p.izquierda.trim() || p.derecha.trim())
          .map((p) => ({ label: p.izquierda.trim(), value: p.derecha.trim() }));
        if (filas.length === 0) break;
        salida.push({
          ...base, tipo: "tabla-kv",
          etiqueta: e.etiqueta.trim(),
          sufijo: limpio(e.sufijo),
          orientacion: e.orientacion,
          filas,
        });
        break;
      }

      case "codigos": {
        const pares = e.pares
          .filter((p) => p.izquierda.trim() || p.derecha.trim())
          .map((p) => ({ codigo: p.izquierda.trim(), medida: p.derecha.trim() }));
        if (pares.length === 0) break;
        salida.push({
          ...base, tipo: "codigos",
          etiqueta: e.etiqueta.trim(),
          sufijo: limpio(e.sufijo),
          pares,
          nota: limpio(e.nota),
          alt: limpio(e.alt),
          assetId: asset(e),
        });
        break;
      }

      case "tabla": {
        const filas = conDatos(e.filas);
        if (e.columnas.length === 0 || filas.length === 0) break;
        salida.push({
          ...base, tipo: "tabla",
          etiqueta: e.etiqueta.trim(),
          sufijo: limpio(e.sufijo),
          columnas: e.columnas,
          filas,
        });
        break;
      }

      case "tabla-ancha": {
        const filas = conDatos(e.filas);
        if (e.columnas.length === 0 || filas.length === 0) break;
        salida.push({
          ...base, tipo: "tabla-ancha",
          etiqueta: e.etiqueta.trim(),
          sufijo: limpio(e.sufijo),
          columnas: e.columnas,
          filas,
          nota: e.nota.trim(),
        });
        break;
      }

      case "tabla-dim": {
        const tablas = e.tablas
          .map((t) => ({ ...t, filas: conDatos(t.filas) }))
          .filter((t) => t.columnas.length > 0 && t.filas.length > 0);
        if (tablas.length === 0) break;
        salida.push({ ...base, tipo: "tabla-dim", tablas });
        break;
      }

      case "inline-kv": {
        if (!e.valor.trim()) break;
        salida.push({
          ...base, tipo: "inline-kv",
          etiqueta: e.etiqueta.trim(), valor: e.valor.trim(),
        });
        break;
      }

      case "barra-destacada": {
        if (!e.valor.trim()) break;
        salida.push({
          ...base, tipo: "barra-destacada",
          etiqueta: e.etiqueta.trim(), valor: e.valor.trim(),
        });
        break;
      }

      case "par-texto": {
        if (!e.ladoIzquierdo.texto.trim() && !e.ladoDerecho.texto.trim()) break;
        salida.push({
          ...base, tipo: "par-texto",
          izquierda: {
            etiqueta: e.ladoIzquierdo.etiqueta.trim(),
            texto: e.ladoIzquierdo.texto.trim(),
          },
          derecha: {
            etiqueta: e.ladoDerecho.etiqueta.trim(),
            texto: e.ladoDerecho.texto.trim(),
          },
        });
        break;
      }

      case "imagen": {
        // El assetId sale de la imagen que el modelo asignó del inventario.
        // Si no asignó ninguna, el bloque queda con su caja vacía y el alt
        // diciendo qué imagen va, para que la persona la elija de la librería.
        salida.push({
          ...base, tipo: "imagen",
          etiqueta: limpio(e.etiqueta),
          sufijo: limpio(e.sufijo),
          marco: e.marco,
          alt: e.alt.trim(),
          assetId: asset(e),
        });
        break;
      }

      case "croquis": {
        const cotas = e.cotas
          .filter((c) => c.simbolo.trim() || c.nombre.trim())
          .map((c) => ({ simbolo: c.simbolo.trim(), nombre: c.nombre.trim() }));
        if (cotas.length === 0) break;
        salida.push({ ...base, tipo: "croquis", cotas, assetId: asset(e) });
        break;
      }

      case "lista-componentes": {
        const items = e.componentes
          .filter((i) => i.componente.trim() || i.material.trim())
          .map((i) => ({
            n: i.n.trim(),
            componente: i.componente.trim(),
            material: i.material.trim(),
            cantidad: i.cantidad.trim(),
          }));
        if (items.length === 0) break;
        salida.push({
          ...base, tipo: "lista-componentes",
          etiqueta: e.etiqueta.trim(),
          sufijo: limpio(e.sufijo),
          // Los títulos de columna son fijos (§4: las cuatro columnas no
          // cambian de lugar porque el número remite al croquis), así que no
          // se le piden al modelo.
          columnas: {
            item: "Ítem",
            componente: "Componente",
            material: "Material",
            cantidad: "Cant.",
          },
          items,
        });
        break;
      }
    }
  }

  return salida;
}

export interface ResultadoExtraccion {
  bloques: Bloque[];
  /** Contenido del PDF que no entró en ningún bloque. */
  omitido: string[];
  /** Cuántos bloques devolvió el modelo y se descartaron por venir vacíos. */
  descartados: number;
  /** Cuántas imágenes del PDF quedaron asignadas a un bloque. */
  imagenesUsadas: number;
  uso?: { entrada: number; salida: number };
}

/**
 * Sube al bucket las imágenes que el modelo asignó a un bloque y devuelve
 * `id del inventario → assetId`. La inyecta la ruta, que es la que tiene la
 * sesión y la familia; el extractor no habla con la base para poder probarse
 * sin ella.
 */
export type SubirImagenes = (
  imagenes: ImagenAsignada[],
) => Promise<Map<string, string>>;

/**
 * Una imagen del inventario junto con lo que aporta el bloque que la usa: si
 * es foto o croquis para la librería, y su descripción.
 */
export interface ImagenAsignada extends ImagenExtraida {
  tipoAsset: AssetTipo;
  alt: string;
}

/**
 * Las imágenes que el modelo asignó a algún bloque, sin repetir.
 *
 * Se descarta la referencia a un id que no está en el inventario: es el mismo
 * criterio que usa el revisor con un `bloque_id` inexistente. Y se descarta la
 * segunda referencia al mismo id, porque una imagen pertenece a un bloque; si
 * el modelo la repite, gana el primer bloque en orden de lectura.
 */
function imagenesAsignadas(
  bloques: BloqueExtraido[],
  inventario: ImagenExtraida[],
): ImagenAsignada[] {
  const porId = new Map(inventario.map((im) => [im.id, im]));
  const usadas = new Map<string, ImagenAsignada>();

  for (const b of bloques) {
    const ref = b.imagenRef.trim();
    if (!ref || usadas.has(ref)) continue;
    const im = porId.get(ref);
    if (!im) continue;
    usadas.set(ref, {
      ...im,
      // La foto de producto del header es "foto"; el resto —croquis,
      // despieces, curvas— entra como "croquis" en la librería.
      tipoAsset: b.tipo === "header" ? "foto" : "croquis",
      alt: b.alt.trim(),
    });
  }

  return [...usadas.values()];
}

export async function extraerDePdf(
  pdf: Uint8Array,
  cliente: ClienteExtraccion = clienteAnthropic(),
  subirImagenes?: SubirImagenes,
): Promise<ResultadoExtraccion> {
  if (pdf.byteLength === 0) {
    throw new ErrorExtraccion("El archivo está vacío.");
  }
  if (pdf.byteLength > TAMANO_MAX) {
    throw new ErrorExtraccion(
      `El PDF pesa ${(pdf.byteLength / 1024 / 1024).toFixed(1)} MB; el máximo es ${TAMANO_MAX / 1024 / 1024} MB.`,
    );
  }
  // Un PDF real arranca con %PDF-. Se verifica acá para no gastar una llamada
  // al modelo con un archivo que no es lo que dice ser.
  const firma = new TextDecoder().decode(pdf.slice(0, 5));
  if (firma !== "%PDF-") {
    throw new ErrorExtraccion("El archivo no es un PDF.");
  }

  // Las imágenes salen del PDF antes de llamar al modelo, y sin él: son
  // objetos embebidos con su rectángulo de colocación. Si el PDF no tiene
  // ninguna, el inventario va vacío y el flujo es el de antes.
  let inventario: ImagenExtraida[] = [];
  try {
    inventario = await imagenesDePdf(pdf);
  } catch (e) {
    // Un PDF del que no se pueden leer las imágenes igual se transcribe: el
    // texto es lo principal y los bloques quedan sin imagen, como antes.
    console.warn("[extractor] no se pudieron leer las imágenes del PDF", e);
  }

  const base64 = Buffer.from(pdf).toString("base64");
  const { parsed, uso } = await cliente.extraer(
    SISTEMA,
    base64,
    "Transcribí esta ficha técnica a bloques. Respetá el orden en que se lee el PDF y no inventes ningún dato que no esté impreso." +
      inventarioParaModelo(inventario),
  );

  const resultado = Respuesta.safeParse(normalizarPresentacion(parsed));
  if (!resultado.success) {
    throw new ErrorExtraccion(
      "La respuesta del modelo no tiene la forma esperada. Se descarta la extracción completa.",
    );
  }

  // Sólo se suben las imágenes que el modelo asignó a un bloque. Las que
  // quedaron sin asignar no van a la librería de la familia: se le informan a
  // la persona más abajo. Así un falso positivo del filtro —la píldora de
  // unidad de negocio es el caso típico— no ensucia la librería.
  const asignadas = imagenesAsignadas(resultado.data.bloques, inventario);
  let subidas = new Map<string, string>();
  if (subirImagenes && asignadas.length > 0) {
    try {
      subidas = await subirImagenes(asignadas);
    } catch (e) {
      // Si la subida falla, la transcripción del texto igual sirve: los
      // bloques quedan sin imagen y la persona la elige de la librería.
      console.error("[extractor] falló la subida de las imágenes", e);
    }
  }

  const bloques = aBloques(resultado.data.bloques, (ref) => subidas.get(ref));
  if (bloques.length === 0) {
    throw new ErrorExtraccion(
      "No se pudo transcribir ningún bloque del PDF. Revisá que sea una ficha técnica con texto seleccionable.",
    );
  }

  // Una imagen que quedó fuera de todo bloque es contenido del PDF que no
  // entró en la ficha, así que va a la misma lista que lo demás (§4bis regla
  // 4): se muestra en pantalla, no se pierde en un log.
  const sinUsar = inventario
    .filter((im) => !subidas.has(im.id))
    .map((im) => `${describirImagen(im)} — no se asignó a ningún bloque`);

  return {
    bloques,
    omitido: [
      ...resultado.data.omitido.map((o) => o.trim()).filter(Boolean),
      ...sinUsar,
    ],
    descartados: resultado.data.bloques.length - bloques.length,
    imagenesUsadas: subidas.size,
    uso,
  };
}
