/**
 * Prueba de ACEPTACIÓN de M5 (§8): sobre la ficha de referencia, el revisor
 * debe detectar los cuatro hallazgos de §6 y no inventar ningún dato.
 *
 * Requiere ANTHROPIC_API_KEY. Uso:
 *   ANTHROPIC_API_KEY=... npm run test:revisor-real
 */
import { revisarFicha } from "../src/lib/ia/revisor";
import { FICHA_TUERCA } from "../src/lib/fixtures/tuerca-autofrenante";

async function correr() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY no está definida. Esta prueba llama al modelo de verdad.");
    console.log("Definila y volvé a correr:  ANTHROPIC_API_KEY=... npm run test:revisor-real");
    process.exit(2);
  }

  const bloques = FICHA_TUERCA.hojas.flatMap((h) => h.bloques);
  console.log(`Revisando la ficha de referencia (${bloques.length} bloques)...\n`);

  const r = await revisarFicha(bloques);

  for (const h of r.hallazgos) {
    console.log(`[${h.severidad}] ${h.bloque_id} · ${h.campo}`);
    console.log(`   motivo: ${h.motivo}`);
    console.log(`   original: ${h.original.slice(0, 110)}`);
    console.log(`   propuesta: ${h.propuesta ? h.propuesta.slice(0, 110) : "(vacía — dato faltante)"}`);
    console.log();
  }
  if (r.descartados.length) console.log("descartados:", r.descartados.length, "\n");
  if (r.uso) console.log(`tokens: ${r.uso.entrada} entrada / ${r.uso.salida} salida\n`);

  // Los cuatro hallazgos que §6 dice que contiene la ficha.
  const texto = r.hallazgos.map(
    (h) => `${h.motivo} ${h.campo} ${h.original} ${h.propuesta}`.toLowerCase(),
  );
  const alguno = (re: RegExp) => texto.some((t) => re.test(t));

  const criterios: [string, boolean][] = [
    [
      '1. designación normativa: Whitworth atribuida a ANSI/ASME B18',
      alguno(/whit\s?worth|withworth|bsw|unc|unf|serie unificada/),
    ],
    [
      '2. coherencia texto vs tabla: 1/8" declarado, la tabla arranca en 1/4"',
      alguno(/1\/8|1\/4|rango|arranca|desde/),
    ],
    [
      "3. nomenclatura: ASME en normas vs ANSI en la descripción",
      alguno(/ansi|asme/),
    ],
    [
      "4. trazabilidad: normas sin año de edición",
      alguno(/año|edición|edicion/),
    ],
  ];

  console.log("=== criterio de aceptación de M5 ===");
  let ok = 0;
  for (const [nombre, paso] of criterios) {
    console.log((paso ? "  ✓ " : "  ✗ ") + nombre);
    if (paso) ok++;
  }

  // §6 regla 1: ninguna propuesta puede introducir un año que no estaba.
  const inventa = r.hallazgos.filter(
    (h) => /\b(19|20)\d{2}\b/.test(h.propuesta) && !/\b(19|20)\d{2}\b/.test(h.original),
  );
  console.log(
    (inventa.length === 0 ? "  ✓ " : "  ✗ ") + "no inventa años de edición en las propuestas",
  );
  for (const h of inventa) console.log("      ->", h.campo, "|", h.propuesta);

  const total = ok + (inventa.length === 0 ? 1 : 0);
  console.log(`\n${total}/5 criterios cumplidos`);
  if (total !== 5) process.exit(1);
}

correr();
