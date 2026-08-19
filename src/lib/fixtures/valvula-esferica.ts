import type { Bloque } from "@/lib/tipos";
import type { DatosFicha } from "@/components/ficha/FichaVista";
import { NOTA_AL_PIE } from "@/lib/ficha-textos";

/**
 * Plantilla de referencia V26: "Válvula esférica 3 cuerpos Socket Weld".
 * Transcripta de referencia/Plantilla ficha tecnica FAMIQ V26.pdf.
 *
 * Es la ficha contra la que se mide el criterio de aceptación de M2 —que el
 * render sea indistinguible del original— y la que ejercita los cuatro tipos
 * de bloque nuevos (`imagen`, `lista-componentes`, `tabla-ancha`, `codigos`)
 * más la variante vertical de `tabla-kv`.
 *
 * A diferencia de la ficha de la tuerca, esta NO es fixture del revisor con
 * IA: su contenido está bien y no hay hallazgos plantados. La de la tuerca
 * sigue siendo el fixture de §6.
 *
 * Única desviación de contenido respecto del PDF: el cuadrado del vástago se
 * escribe "SQ C" y no "□C". El glifo ▫ (U+25A1) no está en los subsets de
 * Roboto que van embebidos (§3), y una fuente de reserva no está garantizada
 * en el Chromium serverless: el símbolo saldría como caja vacía. La prueba
 * scripts/cobertura-glifos.test.ts verifica que ningún texto de una ficha use
 * un carácter sin cobertura.
 */

export const BLOQUES_VALVULA: Bloque[] = [
  {
    id: "v-header",
    tipo: "header",
    ancho: "completo",
    familia: "Válvulas industriales",
    subfamilia: "Válvula esférica",
    tituloEs: "Válvula esférica 3 cuerpos Socket Weld",
    pildoraAssetId: "pildora",
    pildoraAlt: "Conducción de Fluidos Industriales",
    fotoAssetId: "producto",
  },
  {
    id: "v-caracteristicas",
    tipo: "texto-rico",
    ancho: "medio",
    etiqueta: "Características",
    parrafos: [
      "Válvula esférica de paso total para el manejo de fluidos industriales: agua, vapor, aceite y derivados del petróleo (servicio W.O.G.).",
      "Cuerpo de tres piezas con vástago antiestático y a prueba de expulsión, maneta con seguro de posición y dispositivo para candado.",
      "A diferencia de las válvulas de dos cuerpos, la construcción de tres piezas permite desarmarla en línea para reemplazar asientos, sellos y bujes sin retirarla de la instalación. Alojamiento superior ISO 5211 para montaje directo de actuador.",
    ],
  },
  {
    id: "v-datos-tecnicos",
    tipo: "tabla-kv",
    ancho: "medio",
    etiqueta: "Datos técnicos",
    filas: [
      { label: "Material cuerpo", value: "ASTM A351 CF8M (316L)" },
      { label: "Conexión", value: "Socket Weld — soldadura a enchufe" },
      { label: "Presión nominal", value: "1000 PSI W.O.G. (69 bar)" },
      { label: "Presión con vapor", value: "150 PSI máx. (10 bar)" },
      { label: "Temperatura", value: "−25 °C a +180 °C" },
      { label: "Vacío admisible", value: "29 in Hg" },
      { label: "Paso", value: "Total (full port)" },
      { label: "Vástago", value: "Antiestático y a prueba de expulsión" },
      { label: "Actuación", value: "Maneta con seguro de posición y dispositivo de candado · brida ISO 5211" },
    ],
  },
  {
    id: "v-presion-temperatura",
    tipo: "imagen",
    ancho: "medio",
    etiqueta: "Presión / temperatura",
    sufijo: '1/4" – 4"',
    assetId: "grafico-presion",
    alt: "Curva de presión admisible en función de la temperatura, de 1000 PSI a −13 °F hasta 0 PSI a 400 °F",
  },
  {
    id: "v-aplicaciones",
    tipo: "chips",
    ancho: "medio",
    etiqueta: "Aplicaciones típicas",
    items: [
      "Agua",
      "Vapor",
      "Aceites y derivados",
      "Aire comprimido",
      "Oil & Gas",
      "Industria química",
    ],
  },
  {
    id: "v-despiece",
    tipo: "imagen",
    ancho: "dos-tercios",
    // Dos filas: al costado se apilan "materiales de sellado" y "normas de
    // referencia", que son las dos secciones angostas que lo siguen.
    filasGrilla: 2,
    tituloHoja: "Despiece y componentes",
    // Sin rótulo: el título de la hoja ya dice "Despiece y componentes".
    marco: true,
    assetId: "despiece",
    alt: "Corte de la válvula con los diecisiete componentes numerados y las cotas W, H, H1, h, L, Ød, ØD, P y SQ C",
  },
  {
    id: "v-materiales-sellado",
    tipo: "tabla-kv",
    ancho: "un-tercio",
    orientacion: "vertical",
    etiqueta: "Materiales de sellado",
    filas: [
      { label: "Asiento", value: "RTFE — PTFE reforzado con 15 % fibra de vidrio" },
      { label: "Sello de asiento", value: "RTFE" },
      { label: "O-ring", value: "FKM (Vitón)" },
      { label: "Empaquetadura", value: "PTFE" },
    ],
  },
  {
    id: "v-normas",
    tipo: "tabla-kv",
    ancho: "un-tercio",
    orientacion: "vertical",
    etiqueta: "Normas de referencia",
    filas: [
      { label: "Diseño", value: "ASME B16.34" },
      { label: "Extremos SW", value: "ASME B16.11 · DIN 3239 parte 2" },
      { label: "Espesor de pared", value: "EN 12516-3" },
      { label: "Inspección y ensayo", value: "API 598 · EN 12266-1" },
      { label: "Interfaz de actuador", value: "ISO 5211" },
    ],
  },
  {
    id: "v-componentes",
    tipo: "lista-componentes",
    ancho: "completo",
    etiqueta: "Lista de componentes",
    sufijo: "Ítems 1 – 17",
    columnas: { item: "Ítem", componente: "Componente", material: "Material", cantidad: "Cant." },
    items: [
      { n: "1", componente: "Cuerpo", material: "A351-CF8M", cantidad: "1" },
      { n: "2", componente: "Bola", material: "AISI 316", cantidad: "1" },
      { n: "3", componente: "Asiento de bola + sello", material: "RTFE", cantidad: "2" },
      { n: "4", componente: "Tapa", material: "A351-CF8M", cantidad: "2" },
      { n: "5", componente: "Vástago", material: "AISI 316", cantidad: "1" },
      { n: "6", componente: "Arandela de empuje", material: "PTFE", cantidad: "1" },
      { n: "7", componente: "O-ring", material: "FKM (Vitón)", cantidad: "1" },
      { n: "8", componente: "Empaque del vástago", material: "PTFE", cantidad: "1" },
      { n: "9", componente: "Prensaestopa", material: "AISI 304", cantidad: "1" },
      { n: "10", componente: "Arandela de prensaestopa", material: "AISI 304", cantidad: "1" },
      { n: "11", componente: "Tope de maneta", material: "AISI 304", cantidad: "1" },
      { n: "12", componente: "Maneta", material: "AISI 304", cantidad: "1" },
      { n: "13", componente: "Seguro de maneta", material: "AISI 304", cantidad: "1" },
      { n: "14", componente: "Cubierta de maneta", material: "Plástico", cantidad: "1" },
      { n: "15", componente: "Tuerca de unión", material: "AISI 304", cantidad: "4 (6)" },
      { n: "16", componente: "Arandela de unión", material: "AISI 304", cantidad: "4 (6)" },
      { n: "17", componente: "Perno de unión", material: "AISI 304", cantidad: "4 (6)" },
    ],
  },
  {
    id: "v-dimensiones",
    tipo: "tabla-ancha",
    ancho: "completo",
    tituloHoja: "Tabla de cotas y códigos",
    etiqueta: "Dimensiones y códigos",
    sufijo: "Cotas en mm · ver plano pág. 2",
    columnas: [
      { titulo: "Código" },
      { titulo: "Medida SW" },
      { titulo: "Ød", alineacion: "derecha" },
      { titulo: "ØD", alineacion: "derecha" },
      { titulo: "P", alineacion: "derecha" },
      { titulo: "W", alineacion: "derecha" },
      { titulo: "L", alineacion: "derecha" },
      { titulo: "H1", alineacion: "derecha" },
      { titulo: "h", alineacion: "derecha" },
      { titulo: "H", alineacion: "derecha" },
      { titulo: "SQ C", alineacion: "derecha" },
      { titulo: "ISO 5211" },
      { titulo: "Par N·m", alineacion: "derecha" },
    ],
    filas: [
      ["351636", '1/4"', "11", "14,1", "9,6", "140", "60", "30", "9", "52", "9", "F03", "4"],
      ["—", '3/8"', "12,5", "17,6", "9,6", "140", "60", "30", "9", "52", "9", "F03", "4"],
      ["351637", '1/2"', "15", "21,7", "9,6", "140", "68", "36,5", "9", "62", "9", "F03/F04", "5"],
      ["351638", '3/4"', "20", "27,1", "12,7", "140", "72", "40,5", "9", "72", "9", "F03/F04", "8"],
      ["351639", '1"', "25", "33,8", "12,7", "160", "86", "48,5", "11", "81", "11", "F04/F05", "10"],
      ["351680", '1 1/4"', "32", "42,5", "12,7", "160", "94", "57,5", "11", "95", "11", "F04/F05", "14"],
      ["351681", '1 1/2"', "38", "48,6", "12,7", "185", "101", "61,5", "14", "106", "14", "F05/F07", "18"],
      ["351682", '2"', "50", "61,1", "15,8", "185", "110", "70,5", "14", "127", "14", "F05/F07", "25"],
      ["—", '2 1/2"', "65", "77", "15,8", "230", "143", "95,5", "17", "160", "17", "F07/F10", "48"],
      ["—", '3"', "76", "90", "15,8", "230", "157", "109", "17", "182", "17", "F07/F10", "75"],
      ["—", '4"', "94", "115,2", "20", "320", "182", "131", "22", "220", "17", "F07/F10", "110"],
    ],
    nota:
      "Ød paso de esfera · ØD diámetro de alojamiento del extremo soldable · P profundidad de encastre · L largo entre caras · W largo de maneta · H altura total · H1 altura al eje de maneta · h espesor de brida superior · SQ C cuadrado del vástago. Medidas sin código (—) se cotizan a pedido.",
  },
  {
    id: "v-repuestos",
    tipo: "codigos",
    ancho: "completo",
    etiqueta: "Repuestos · Kit de sellos RTFE",
    sufijo: "1 kit por válvula",
    pares: [
      { codigo: "350834", medida: '1/2"' },
      { codigo: "350840", medida: '3/4"' },
      { codigo: "350841", medida: '1"' },
      { codigo: "350845", medida: '1 1/4"' },
      { codigo: "350846", medida: '1 1/2"' },
      { codigo: "350850", medida: '2"' },
      { codigo: "350851", medida: '2 1/2"' },
      { codigo: "350853", medida: '3"' },
      { codigo: "350830", medida: '4"' },
    ],
    assetId: "kit-sellos",
    alt: "Kit de sellos: dos asientos, empaquetadura, arandela de vástago y O-ring",
    nota:
      'Cada kit incluye dos asientos con sello RTFE, empaquetadura y arandela de vástago en PTFE y O-ring FKM. Medidas 1/4" y 3/8" a pedido.',
  },
];

export const ASSETS_VALVULA: Record<string, string> = {
  pildora: "/ficha/valvula/pildora-fluidos.png",
  producto: "/ficha/valvula/producto.png",
  "grafico-presion": "/ficha/valvula/grafico-presion.png",
  despiece: "/ficha/valvula/despiece.png",
  "kit-sellos": "/ficha/valvula/kit-sellos.png",
};

export const DATOS_VALVULA: Omit<DatosFicha, "hojas"> = {
  familia: "Válvulas industriales",
  pildoraSrc: ASSETS_VALVULA.pildora,
  pildoraAlt: "Conducción de Fluidos Industriales",
  version: "V26",
  revision: 1,
  anio: 2026,
  estado: "publicada",
  nota: NOTA_AL_PIE,
};

/** Título y antetítulo de las hojas interiores. */
export const HOJAS_VALVULA = {
  tituloInterior: "Despiece y componentes",
  antetitulo: "Válvula esférica 3 cuerpos Socket Weld",
};
