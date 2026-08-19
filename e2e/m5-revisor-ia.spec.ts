import { test, expect } from "@playwright/test";

/**
 * M5 — el revisor con IA.
 *
 * La llamada al modelo necesita ANTHROPIC_API_KEY. Sin clave, se verifica todo
 * el resto del circuito — persistencia, panel, aceptar, rechazar, rastro de la
 * decisión — inyectando sugerencias directo en la base, que es exactamente lo
 * que dejaría el endpoint. La prueba de aceptación de §6 (detectar los cuatro
 * hallazgos) está en scripts/probar-revisor-real.mjs y requiere la clave.
 */

const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const SELLO = process.env.E2E_SELLO ?? String(Date.now());

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function rest(ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const texto = await r.text();
  return { ok: r.ok, status: r.status, cuerpo: texto ? JSON.parse(texto) : null };
}

async function entrar(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^(?!.*\/login).*$/, { timeout: 20_000 });
}

// Cada test necesita su propio producto: el SKU es único en la base.
let contador = 0;

/** Ficha con el error normativo real de la ficha de referencia. */
async function prepararFicha(page: import("@playwright/test").Page) {
  contador += 1;
  const sku = `M5-${SELLO}-${contador}`;
  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill("Tuerca de prueba M5");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });

  await page.goto("/fichas/nueva");
  await page.getByLabel("Producto").selectOption({ label: `${sku} — Tuerca de prueba M5` });
  await page.getByRole("button", { name: "Crear ficha" }).click();
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const fichaId = page.url().split("/").pop()!;

  await page.goto(`/fichas/${fichaId}/editar`);
  await page.getByRole("button", { name: /Tabla etiqueta/ }).click();
  await page.getByPlaceholder("Etiqueta", { exact: true }).first().fill("Pulgadas · ″");
  await page.getByPlaceholder("Valor", { exact: true }).first().fill("ANSI B18.16.6");
  await page.getByLabel("Comentario de la revisión").fill("Carga inicial de normas");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`${fichaId}$`), { timeout: 20_000 });

  return fichaId;
}

async function ultimaRevision(fichaId: string) {
  const { cuerpo } = await rest(
    `ficha_revision?ficha_id=eq.${fichaId}&select=id,n,bloques&order=n.desc&limit=1`,
  );
  return cuerpo[0] as { id: string; n: number; bloques: { id: string }[] };
}

test("sin ANTHROPIC_API_KEY el endpoint lo dice claro, no falla en silencio", async ({ page }) => {
  // Con clave configurada, la revisión real tarda minutos: no entra en el
  // timeout de un E2E, y su verificación vive en scripts/revisor-real.ts.
  test.skip(
    Boolean(process.env.ANTHROPIC_API_KEY),
    "Con ANTHROPIC_API_KEY la verificación es scripts/revisor-real.ts",
  );

  await entrar(page);
  const fichaId = await prepararFicha(page);

  const r = await page.request.post(`/api/fichas/${fichaId}/revisar`);
  expect(r.status()).toBe(503);
  expect((await r.json()).error).toContain("ANTHROPIC_API_KEY");
});

test("aceptar un hallazgo crea una revisión nueva y deja rastro de quién decidió", async ({ page }) => {
  await entrar(page);
  const fichaId = await prepararFicha(page);
  const revision = await ultimaRevision(fichaId);
  const bloqueId = revision.bloques[0].id;

  // Lo que dejaría el endpoint tras la llamada al modelo.
  const { ok } = await rest("sugerencia_ia", {
    method: "POST",
    body: JSON.stringify({
      revision_id: revision.id,
      bloque_id: bloqueId,
      campo: "filas[0].value",
      texto_original: "ANSI B18.16.6",
      texto_propuesto: "ASME B18.16.6",
      motivo: "La norma se cita como ANSI; su emisor actual es ASME.",
      severidad: "inconsistencia",
    }),
  });
  expect(ok).toBe(true);

  await page.goto(`/fichas/${fichaId}`);
  await expect(page.getByText(/su emisor actual es ASME/)).toBeVisible();

  await page.getByRole("button", { name: "Aceptar" }).click();

  // Se creó una revisión nueva; la anterior quedó intacta (append-only).
  await expect(page.getByText(/Acepta sugerencia de IA/)).toBeVisible({ timeout: 20_000 });
  const nueva = await ultimaRevision(fichaId);
  expect(nueva.n).toBe(revision.n + 1);

  // El cambio se aplicó al campo señalado.
  const { cuerpo: revs } = await rest(
    `ficha_revision?ficha_id=eq.${fichaId}&select=n,bloques&order=n.desc&limit=1`,
  );
  const bloques = revs[0].bloques as { filas?: { value: string }[] }[];
  expect(bloques[0].filas?.[0].value).toBe("ASME B18.16.6");

  // La decisión quedó sellada con autor y fecha (§5 invariante 3).
  const { cuerpo: sugs } = await rest(
    `sugerencia_ia?revision_id=eq.${revision.id}&select=estado,decidido_por,decidido_at`,
  );
  expect(sugs[0].estado).toBe("aceptada");
  expect(sugs[0].decidido_por).toBeTruthy();
  expect(sugs[0].decidido_at).toBeTruthy();
});

test("rechazar deja rastro y no toca el contenido", async ({ page }) => {
  await entrar(page);
  const fichaId = await prepararFicha(page);
  const revision = await ultimaRevision(fichaId);

  await rest("sugerencia_ia", {
    method: "POST",
    body: JSON.stringify({
      revision_id: revision.id,
      bloque_id: revision.bloques[0].id,
      campo: "filas[0].value",
      texto_original: "ANSI B18.16.6",
      texto_propuesto: "ALGO INCORRECTO",
      motivo: "Propuesta que el revisor humano debe rechazar.",
      severidad: "mejora",
    }),
  });

  await page.goto(`/fichas/${fichaId}`);
  await page.getByRole("button", { name: "Rechazar" }).click();
  await expect(page.getByText("Rechazada")).toBeVisible({ timeout: 20_000 });

  // No se creó revisión nueva.
  const despues = await ultimaRevision(fichaId);
  expect(despues.n).toBe(revision.n);

  const { cuerpo: sugs } = await rest(
    `sugerencia_ia?revision_id=eq.${revision.id}&select=estado,decidido_por,decidido_at`,
  );
  expect(sugs[0].estado).toBe("rechazada");
  expect(sugs[0].decidido_por).toBeTruthy();
});

test("un hallazgo sin propuesta no se puede aceptar: reporta un dato que falta", async ({ page }) => {
  await entrar(page);
  const fichaId = await prepararFicha(page);
  const revision = await ultimaRevision(fichaId);

  await rest("sugerencia_ia", {
    method: "POST",
    body: JSON.stringify({
      revision_id: revision.id,
      bloque_id: revision.bloques[0].id,
      campo: "filas[0].value",
      texto_original: "ANSI B18.16.6",
      texto_propuesto: null,
      motivo: "Falta el año de edición. Lo tiene que aportar Oficina Técnica.",
      severidad: "error",
    }),
  });

  await page.goto(`/fichas/${fichaId}`);
  await expect(page.getByText(/sin propuesta/)).toBeVisible();
  // §6 regla 1: la IA no rellena el dato, así que no hay nada que aplicar.
  await expect(page.getByRole("button", { name: "Aceptar" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Rechazar" })).toBeEnabled();
});
