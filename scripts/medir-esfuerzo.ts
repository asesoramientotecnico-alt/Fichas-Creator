/**
 * Mide cuánto tarda la revisión según el esfuerzo del modelo.
 * El plan Hobby de Vercel topea las funciones en 60 s, así que hay que saber
 * si la revisión entra o no.
 *
 * Uso: ANTHROPIC_API_KEY=... tsx scripts/medir-esfuerzo.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SISTEMA, mensajeUsuario } from "../src/lib/ia/prompt";
import { FICHA_TUERCA } from "../src/lib/fixtures/tuerca-autofrenante";

const Respuesta = z.object({
  hallazgos: z.array(
    z.object({
      bloque_id: z.string(),
      campo: z.string(),
      original: z.string(),
      propuesta: z.string(),
      motivo: z.string(),
      severidad: z.enum(["error", "inconsistencia", "mejora"]),
    }),
  ),
});

async function correr() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("Falta ANTHROPIC_API_KEY.");
    process.exit(2);
  }

  const bloques = FICHA_TUERCA.hojas.flatMap((h) => h.bloques);
  const usuario = mensajeUsuario(bloques);
  const client = new Anthropic();

  for (const effort of ["low", "medium", "high"] as const) {
    const t0 = Date.now();
    try {
      const r = await client.messages.parse({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SISTEMA,
        thinking: { type: "adaptive" },
        output_config: { effort, format: zodOutputFormat(Respuesta) },
        messages: [{ role: "user", content: usuario }],
      });
      const seg = (Date.now() - t0) / 1000;
      const n = r.parsed_output?.hallazgos.length ?? 0;
      const graves = r.parsed_output?.hallazgos.filter((h) => h.severidad === "error").length ?? 0;
      console.log(
        `effort=${effort.padEnd(6)} ${seg.toFixed(1).padStart(6)} s  ` +
          `hallazgos=${n} (errores=${graves})  ` +
          `tokens=${r.usage.input_tokens}/${r.usage.output_tokens}  ` +
          `${seg < 60 ? "entra en 60 s ✓" : "NO entra en 60 s ✗"}`,
      );
    } catch (e) {
      console.log(`effort=${effort}  FALLÓ: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

correr();
