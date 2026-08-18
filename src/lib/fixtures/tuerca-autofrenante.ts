import type { Bloque } from "@/lib/tipos";
import type { DatosFicha } from "@/components/ficha/FichaVista";

/**
 * Ficha de referencia: "Tuerca autofrenante con inserto de nylon".
 * Transcripta de referencia/Ficha Tecnica - Tuerca Autofrenante (fixture §6).pdf.
 *
 * CUIDADO: el contenido se transcribe TAL CUAL, con sus errores. §6 dice que
 * esta ficha contiene los cuatro primeros casos de hallazgo y sirve de fixture
 * del revisor con IA. Corregirlos acá rompería M5. Son:
 *
 *   1. Designación normativa: la descripción atribuye rosca whitworth a
 *      ANSI/ASME B18.16.6, que es serie unificada UNC/UNF.
 *   2. Texto vs tabla: dice "desde 1/8\"" y la tabla en pulgadas arranca
 *      en 1/4".
 *   3. Nomenclatura: ASME en normas aplicables, ANSI en la descripción.
 *   4. Trazabilidad: ninguna norma lleva año de edición.
 *
 * Además hay erratas de redacción ("withworth", "rosca métricas",
 * "1/8\" a 1\" pulgada") que sirven para verificar que la IA NO las reporte
 * antes que los cuatro hallazgos anteriores (§6 prioridad 5).
 */

const HOJA_1: Bloque[] = [
  {
    id: "b-header",
    tipo: "header",
    ancho: "completo",
    familia: "Tuercas de acero inoxidable",
    subfamilia: "Tuerca hexagonal",
    tituloEs: "Tuerca autofrenante con inserto de nylon",
    subtituloEn: "Nylon Insert Lock Nut · Hex Nut",
    fotoAssetId: "producto",
  },
  {
    id: "b-normas",
    tipo: "tabla-kv",
    ancho: "completo",
    etiqueta: "Normas aplicables",
    filas: [
      { label: "Métrico · M", value: "DIN 985" },
      { label: "Pulgadas · ″", value: "ASME B18.16.6 · ASTM F594" },
      { label: "Norma dimensional M", value: "DIN 985 / ISO 7042" },
      { label: "Norma dimensional ″", value: "ASME B18.16.6" },
      { label: "Norma material M", value: "EN ISO 3506-2 (cuerpo) + PA6" },
      { label: "Norma material ″", value: "ASTM F594" },
    ],
  },
  {
    id: "b-par-servicio",
    tipo: "par-texto",
    ancho: "completo",
    izquierda: {
      etiqueta: "Clase de resistencia",
      texto: "Cuerpo A2/A4 inox + inserto nylon PA6 (Tmáx inserto: +120 °C)",
    },
    derecha: {
      etiqueta: "Condiciones de servicio",
      texto:
        "Autofrenante por deformación elástica del nylon · No reutilizable en aplicaciones críticas",
    },
  },
  {
    id: "b-mecanicas",
    tipo: "tabla",
    ancho: "completo",
    etiqueta: "Propiedades mecánicas",
    columnas: [
      { titulo: "Grado" },
      { titulo: "Carga proof (MPa)" },
      { titulo: "Rm mín (MPa)" },
      { titulo: "Dureza máx" },
    ],
    filas: [
      ["A2-70 (304)", "450", "700", "223 HV"],
      ["A4-80 (316)", "600", "800", "250 HV"],
    ],
  },
  {
    id: "b-materiales",
    tipo: "inline-kv",
    ancho: "completo",
    etiqueta: "Materiales disponibles",
    valor: "A2 — AISI 304/304L · A4 — AISI 316/316L",
  },
  {
    id: "b-descripcion",
    tipo: "texto-rico",
    ancho: "medio",
    etiqueta: "Descripción",
    parrafos: [
      'Las tuercas autofrenantes rosca withworth de acero inoxidable son fabricadas bajo norma ANSI B18.16.6 - ASTM F594 en calidad AISI (304 «A2») y (316 «A4»). Los diámetros varían desde 1/8" a 1" pulgada.',
      'Las tuercas autofrenantes rosca métricas de acero inoxidable son fabricadas bajo norma DIN 985 en calidad AISI (304 «A2») y (316 «A4»). Los diámetros varían desde M3 a M24.',
      "Son utilizadas como tuercas de seguridad y en aplicaciones con vibración.",
    ],
  },
  {
    id: "b-aplicaciones",
    tipo: "chips",
    ancho: "medio",
    etiqueta: "Aplicaciones típicas",
    items: [
      "Uso general",
      "Estructuras",
      "Oil & Gas",
      "Bridas",
      "Equipos presión",
      "Ind. alimentaria",
    ],
  },
];

const HOJA_2: Bloque[] = [
  {
    id: "b-croquis",
    tipo: "croquis",
    ancho: "completo",
    assetId: "croquis",
    cotas: [
      { simbolo: "d", nombre: "diámetro nominal" },
      { simbolo: "s", nombre: "entre caras" },
      { simbolo: "h", nombre: "altura total" },
    ],
  },
  {
    id: "b-dimensiones",
    tipo: "tabla-dim",
    ancho: "completo",
    tablas: [
      {
        etiqueta: "Dimensiones métricas",
        unidad: "mm",
        columnas: ["Nominal (d)", "Entre caras (s)", "Altura (h)"],
        filas: [
          ["M3", "5,5", "4"],
          ["M4", "7", "5"],
          ["M5", "8", "5"],
          ["M6", "10", "6"],
          ["M8", "13", "8"],
          ["M10", "17", "10"],
          ["M12", "19", "12"],
          ["M14", "22", "14"],
          ["M16", "24", "16"],
          ["M18", "27", "18,5"],
          ["M20", "30", "20"],
          ["M22", "32", "22"],
          ["M24", "36", "24"],
        ],
      },
      {
        etiqueta: "Dimensiones pulgadas",
        unidad: "mm",
        columnas: ["Nominal (d)", "Entre caras (s)", "Altura total (h)"],
        filas: [
          ['1/4"', "11,2", "8,3"],
          ['5/16"', "12,8", "9,1"],
          ['3/8"', "14,3", "11,9"],
          ['7/16"', "15,9", "11,9"],
          ['1/2"', "19,1", "15,5"],
          ['9/16"', "22,3", "16,7"],
          ['5/8"', "23,9", "19,4"],
          ['3/4"', "27,0", "22,6"],
          ['7/8"', "31,8", "25,4"],
          ['1"', "36,6", "27,4"],
        ],
      },
    ],
  },
  {
    id: "b-presentacion",
    tipo: "barra-destacada",
    ancho: "completo",
    etiqueta: "Presentación",
    valor: "Pack 1 (20 un.) · Pack 2 (50 un.) · Pack 3 (100 un.)",
  },
];

export const FICHA_TUERCA: DatosFicha = {
  catalogo: "Tuercas de acero inoxidable · Tuerca hexagonal",
  version: "1.0",
  anio: 2026,
  estado: "publicada",
  nota: "Datos orientativos. Confirmar disponibilidad con equipo técnico · famiq.com.ar",
  hojas: [
    { bloques: HOJA_1 },
    {
      antetitulo: "Tuerca autofrenante con inserto de nylon",
      titulo: "Tabla de cotas y dimensiones",
      bloques: HOJA_2,
    },
  ],
};

export const ASSETS_TUERCA: Record<string, string> = {
  producto: "/ficha/producto.png",
  croquis: "/ficha/croquis.png",
};
