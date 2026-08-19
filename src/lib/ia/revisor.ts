import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Bloque, SugerenciaSeveridad } from "@/lib/tipos";
import { SISTEMA, mensajeUsuario } from "./prompt";

/**
 * Revisor con IA (§6). Corre SIEMPRE server-side: la API key de Anthropic
 * nunca sale del servidor (§2).
 */

// El modelo lo fija §2. Se lee del entorno para poder cambiarlo sin tocar
// código, pero el valor por omisión es el que dice el documento.
const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const SEVERIDADES = ["error", "inconsistencia", "mejora"] as const;

const Hallazgo = z.object({
  bloque_id: z.string(),
  campo: z.string(),
  original: z.string(),
  /** Vacío cuando no se puede determinar el valor correcto sin inventarlo. */
  propuesta: z.string(),
  motivo: z.string(),
  severidad: z.enum(SEVERIDADES),
});

const Respuesta = z.object({
  hallazgos: z.array(Hallazgo),
});

export type Hallazgo = z.infer<typeof Hallazgo>;

export interface ResultadoRevision {
  hallazgos: Hallazgo[];
  /** Para el log: cuántos hallazgos se descartaron y por qué. */
  descartados: { hallazgo: unknown; motivo: string }[];
  uso?: { entrada: number; salida: number };
}

export class ErrorRevision extends Error {}

/** Cliente mínimo que necesita el revisor. Inyectable para poder probarlo. */
export interface ClienteRevision {
  revisar(sistema: string, usuario: string): Promise<{
    parsed: unknown;
    uso?: { entrada: number; salida: number };
  }>;
}

function clienteAnthropic(): ClienteRevision {
  return {
    async revisar(sistema, usuario) {
      // El cliente sin argumentos resuelve la credencial del entorno.
      const client = new Anthropic();

      const respuesta = await client.messages.parse({
        model: MODELO,
        max_tokens: 16000,
        system: sistema,
        // Revisar designaciones normativas y cruzar texto contra tablas es
        // razonamiento, no extracción.
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: zodOutputFormat(Respuesta),
        },
        messages: [{ role: "user", content: usuario }],
      });

      if (respuesta.stop_reason === "refusal") {
        throw new ErrorRevision(
          `El modelo declinó la revisión (${respuesta.stop_details?.category ?? "sin categoría"}).`,
        );
      }

      return {
        parsed: respuesta.parsed_output,
        uso: {
          entrada: respuesta.usage.input_tokens,
          salida: respuesta.usage.output_tokens,
        },
      };
    },
  };
}

/**
 * Valida la respuesta del modelo.
 *
 * §6 regla 4: si no parsea, se descarta y se informa el fallo — no se intenta
 * recuperar con regex. Los structured outputs hacen que un JSON inválido sea
 * casi imposible, pero la validación se hace igual: la regla existe para que
 * un fallo se vea, no para taparlo.
 *
 * Además se descarta hallazgo por hallazgo lo que no apunte a un bloque real:
 * un hallazgo sobre un bloque_id inexistente no se puede ni mostrar ni
 * persistir, y aceptarlo sería aceptar un dato inventado.
 */
export function validarRespuesta(
  parsed: unknown,
  bloques: Bloque[],
): { hallazgos: Hallazgo[]; descartados: { hallazgo: unknown; motivo: string }[] } {
  const resultado = Respuesta.safeParse(parsed);
  if (!resultado.success) {
    throw new ErrorRevision(
      "La respuesta del modelo no tiene la forma esperada. Se descarta la revisión completa.",
    );
  }

  const idsValidos = new Set(bloques.map((b) => b.id));
  const hallazgos: Hallazgo[] = [];
  const descartados: { hallazgo: unknown; motivo: string }[] = [];

  for (const h of resultado.data.hallazgos) {
    if (!idsValidos.has(h.bloque_id)) {
      descartados.push({ hallazgo: h, motivo: `bloque_id inexistente: ${h.bloque_id}` });
      continue;
    }
    if (!h.motivo.trim()) {
      descartados.push({ hallazgo: h, motivo: "hallazgo sin motivo" });
      continue;
    }
    // Una propuesta idéntica al original no es un hallazgo.
    if (h.propuesta.trim() && h.propuesta.trim() === h.original.trim()) {
      descartados.push({ hallazgo: h, motivo: "la propuesta es igual al original" });
      continue;
    }
    hallazgos.push(h);
  }

  return { hallazgos, descartados };
}

/** Orden de §6: los errores primero, la redacción al final. */
const PESO: Record<SugerenciaSeveridad, number> = {
  error: 0,
  inconsistencia: 1,
  mejora: 2,
};

export async function revisarFicha(
  bloques: Bloque[],
  cliente: ClienteRevision = clienteAnthropic(),
): Promise<ResultadoRevision> {
  if (bloques.length === 0) {
    throw new ErrorRevision("La ficha no tiene bloques para revisar.");
  }

  const { parsed, uso } = await cliente.revisar(SISTEMA, mensajeUsuario(bloques));
  const { hallazgos, descartados } = validarRespuesta(parsed, bloques);

  hallazgos.sort((a, b) => PESO[a.severidad] - PESO[b.severidad]);

  return { hallazgos, descartados, uso };
}
