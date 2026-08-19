// Prueba del revisor con un cliente falso: no necesita API key.
// node scripts/probar-revisor.mjs
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "rev-"));
const entrada = join(dir, "prueba.ts");
const raiz = process.cwd();

writeFileSync(entrada, `
import { revisarFicha, validarRespuesta, ErrorRevision, type ClienteRevision } from "${raiz}/src/lib/ia/revisor";
import { serializarBloques, mensajeUsuario, SISTEMA } from "${raiz}/src/lib/ia/prompt";
import type { Bloque } from "${raiz}/src/lib/tipos";

const casos: [string, () => Promise<boolean> | boolean][] = [];
const chk = (n: string, f: () => Promise<boolean> | boolean) => casos.push([n, f]);

const kv: Bloque = {
  id: "b-normas", tipo: "tabla-kv", etiqueta: "Normas aplicables",
  filas: [{ label: "Pulgadas · ″", value: "ASME B18.16.6 · ASTM F594" }],
} as Bloque;
const texto: Bloque = {
  id: "b-desc", tipo: "texto-rico", etiqueta: "Descripción",
  parrafos: ["Rosca withworth bajo norma ANSI B18.16.6. Diámetros desde 1/8\\" a 1\\"."],
} as Bloque;
const BLOQUES = [kv, texto];

const falso = (respuesta: unknown): ClienteRevision => ({
  async revisar() { return { parsed: respuesta }; },
});

chk("serializa con las mismas rutas que el diff", () => {
  const s = serializarBloques(BLOQUES);
  return s.includes("bloque_id: b-normas") &&
         s.includes("filas[0].value: ASME B18.16.6 · ASTM F594") &&
         s.includes("parrafos[0]:");
});

chk("el mensaje aclara que no hay mas contexto", () => {
  return mensajeUsuario(BLOQUES).includes("no hay más contexto disponible");
});

chk("el sistema trae las cuatro reglas duras y el orden de prioridad", () => {
  return SISTEMA.includes("NO INVENTES NI COMPLETES DATOS") &&
         SISTEMA.includes("PROPUESTAS POR CAMPO") &&
         SISTEMA.includes("ERRORES TÉCNICOS DE DESIGNACIÓN NORMATIVA") &&
         SISTEMA.includes("SÓLO si no encontraste ningún hallazgo");
});

chk("acepta una lista vacia de hallazgos", async () => {
  const r = await revisarFicha(BLOQUES, falso({ hallazgos: [] }));
  return r.hallazgos.length === 0;
});

chk("ordena por severidad: error, inconsistencia, mejora", async () => {
  const r = await revisarFicha(BLOQUES, falso({ hallazgos: [
    { bloque_id: "b-desc", campo: "parrafos[0]", original: "a", propuesta: "b", motivo: "m", severidad: "mejora" },
    { bloque_id: "b-desc", campo: "parrafos[0]", original: "c", propuesta: "d", motivo: "m", severidad: "error" },
    { bloque_id: "b-normas", campo: "filas[0].value", original: "e", propuesta: "f", motivo: "m", severidad: "inconsistencia" },
  ]}));
  return r.hallazgos.map(h => h.severidad).join() === "error,inconsistencia,mejora";
});

chk("descarta un hallazgo sobre un bloque que no existe", async () => {
  const r = await revisarFicha(BLOQUES, falso({ hallazgos: [
    { bloque_id: "inventado", campo: "x", original: "a", propuesta: "b", motivo: "m", severidad: "error" },
  ]}));
  return r.hallazgos.length === 0 && r.descartados.length === 1 &&
         r.descartados[0].motivo.includes("inexistente");
});

chk("descarta una propuesta identica al original", async () => {
  const r = await revisarFicha(BLOQUES, falso({ hallazgos: [
    { bloque_id: "b-desc", campo: "parrafos[0]", original: "igual", propuesta: "igual", motivo: "m", severidad: "mejora" },
  ]}));
  return r.hallazgos.length === 0 && r.descartados[0].motivo.includes("igual al original");
});

chk("acepta propuesta vacia: es el caso de dato faltante", async () => {
  const r = await revisarFicha(BLOQUES, falso({ hallazgos: [
    { bloque_id: "b-normas", campo: "filas[0].value", original: "ASME B18.16.6",
      propuesta: "", motivo: "Falta el año de edición; lo tiene que aportar Oficina Técnica.", severidad: "error" },
  ]}));
  return r.hallazgos.length === 1 && r.hallazgos[0].propuesta === "";
});

chk("una respuesta que no parsea descarta la revision completa", async () => {
  try {
    await revisarFicha(BLOQUES, falso({ cualquier: "cosa" }));
    return false;
  } catch (e) {
    return e instanceof ErrorRevision && e.message.includes("descarta");
  }
});

chk("null no se intenta recuperar", async () => {
  try { await revisarFicha(BLOQUES, falso(null)); return false; }
  catch (e) { return e instanceof ErrorRevision; }
});

chk("una severidad invalida invalida la respuesta", () => {
  try {
    validarRespuesta({ hallazgos: [
      { bloque_id: "b-desc", campo: "x", original: "a", propuesta: "b", motivo: "m", severidad: "grave" },
    ]}, BLOQUES);
    return false;
  } catch (e) { return e instanceof ErrorRevision; }
});

chk("una ficha sin bloques no se manda a revisar", async () => {
  try { await revisarFicha([], falso({ hallazgos: [] })); return false; }
  catch (e) { return e instanceof ErrorRevision && e.message.includes("no tiene bloques"); }
});

async function correr() {
  let ok = 0;
  for (const [n, f] of casos) {
    let paso = false;
    try { paso = await f(); } catch (e) { console.log("  ERROR", n, e); }
    console.log((paso ? "  ✓ " : "  ✗ ") + n);
    if (paso) ok++;
  }
  console.log(\`\\n\${ok}/\${casos.length} pruebas pasan\`);
  if (ok !== casos.length) process.exit(1);
}
correr();
`);

execSync(`npx tsx ${entrada}`, { stdio: "inherit", cwd: raiz });
