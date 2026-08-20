import { test, expect } from "@playwright/test";

/**
 * Estado `anulada`: la salida para una ficha creada por error.
 *
 * Necesita supabase/migrations/0005_estado_anulada.sql aplicada. Si el valor
 * de enum no existe, la prueba lo dice en vez de fallar sin explicación.
 */

const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let n = 0;
const sufijo = () => `${Date.now().toString(36)}-${++n}`;

async function rest(ruta: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  return r.json();
}

async function entrar(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^(?!.*\/login).*$/, { timeout: 20_000 });
}

async function crearFicha(page: import("@playwright/test").Page) {
  const marca = sufijo();
  const sku = `ANUL-${marca}`;
  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill(`Anulable ${marca}`);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });

  await page.goto("/fichas/nueva");
  await page.getByLabel("Producto").selectOption({ label: `${sku} — Anulable ${marca}` });
  await page.getByRole("button", { name: "Crear ficha" }).click();
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  return { fichaId: page.url().split("/").pop()!, nombre: `Anulable ${marca}` };
}

test("anular saca la ficha del listado y conserva su historial", async ({ page }) => {
  await entrar(page);
  const { fichaId, nombre } = await crearFicha(page);

  const antes = await rest(`ficha_revision?ficha_id=eq.${fichaId}&select=n`);
  expect(antes.length).toBeGreaterThan(0);

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Anular ficha" }).click();

  const errorEnum = page.getByText(/invalid input value for enum|anulada/i).first();
  await expect(errorEnum).toBeVisible({ timeout: 20_000 });

  const texto = (await page.textContent("body")) ?? "";
  if (texto.includes("invalid input value for enum")) {
    throw new Error(
      "Falta aplicar supabase/migrations/0005_estado_anulada.sql: el enum ficha_estado " +
        "todavía no tiene el valor 'anulada'.",
    );
  }

  // Queda anulada, con el aviso, y fuera del listado.
  await expect(page.getByText(/Esta ficha está anulada/)).toBeVisible();

  // Se busca por nombre y no se confía en la primera página: con el listado
  // paginado, "no está en la página 1" no probaría que está excluida.
  await page.goto(`/?q=${encodeURIComponent(nombre)}`);
  await expect(page.getByRole("link", { name: nombre })).toHaveCount(0);

  await page.goto(`/?anuladas=1&q=${encodeURIComponent(nombre)}`);
  await expect(page.getByRole("link", { name: nombre })).toBeVisible();

  // El historial sigue intacto: ficha_revision no se borró.
  const despues = await rest(`ficha_revision?ficha_id=eq.${fichaId}&select=n`);
  expect(despues.length).toBe(antes.length);
});

test("una ficha anulada se puede restaurar a borrador", async ({ page }) => {
  await entrar(page);
  const { fichaId, nombre } = await crearFicha(page);

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Anular ficha" }).click();
  await expect(page.getByText(/Esta ficha está anulada/)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "→ Borrador" }).click();
  await expect(page.getByText(/Esta ficha está anulada/)).toHaveCount(0, { timeout: 20_000 });

  await page.goto(`/?q=${encodeURIComponent(nombre)}`);
  await expect(page.getByRole("link", { name: nombre })).toBeVisible();
});

test("una ficha anulada no exporta PDF sin marca de agua", async ({ page }) => {
  await entrar(page);
  const { fichaId } = await crearFicha(page);

  // Con contenido, para que el PDF se pueda generar.
  await page.goto(`/fichas/${fichaId}/editar`);
  await page.getByRole("button", { name: /Etiquetas cortas/ }).click();
  await page.getByLabel("Comentario de la revisión").fill("Contenido mínimo");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`${fichaId}$`), { timeout: 20_000 });

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Anular ficha" }).click();
  await expect(page.getByText(/Esta ficha está anulada/)).toBeVisible({ timeout: 20_000 });

  // §5 invariante 4: sólo aprobada y publicada exportan sin marca.
  await expect(page.getByText(/marca de agua BORRADOR/)).toBeVisible();
});
