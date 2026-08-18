import { test, expect } from "@playwright/test";

/**
 * M3 — criterio de aceptación: se puede reconstruir quién cambió qué y
 * cuándo, para cualquier corrección.
 */

const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const SELLO = process.env.E2E_SELLO ?? String(Date.now());

async function entrar(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^(?!.*\/login).*$/, { timeout: 20_000 });
}

test("editar crea revisiones y el diff reconstruye el cambio", async ({ page }) => {
  await entrar(page);

  // Producto y ficha nuevos para aislar la prueba.
  const sku = `M3-${SELLO}`;
  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill("Tuerca de prueba M3");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });

  await page.goto("/fichas/nueva");
  await page.getByLabel("Producto").selectOption({ label: `${sku} — Tuerca de prueba M3` });
  await page.getByRole("button", { name: "Crear ficha" }).click();
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const urlFicha = page.url();

  // --- Revisión 2: agregar un bloque tabla-kv con un dato ---
  await page.goto(`${urlFicha}/editar`);
  await page.getByRole("button", { name: /Tabla etiqueta/ }).click();

  await page.getByPlaceholder("Etiqueta", { exact: true }).first().fill("Pulgadas · ″");
  await page.getByPlaceholder("Valor", { exact: true }).first().fill("ANSI B18.16.6");

  // Guardar está deshabilitado sin comentario: el historial exige explicación.
  await page.getByLabel("Comentario de la revisión").fill("Agrego normas aplicables");
  await page.getByRole("button", { name: "Guardar revisión" }).click();

  await expect(page).toHaveURL(new RegExp(`${urlFicha.split("/").pop()}$`), { timeout: 20_000 });
  await expect(page.getByText("Agrego normas aplicables")).toBeVisible();

  // --- Revisión 3: corregir ANSI -> ASME (hallazgo 3 de §6) ---
  await page.goto(`${urlFicha}/editar`);
  const valor = page.getByPlaceholder("Valor", { exact: true }).first();
  await expect(valor).toHaveValue("ANSI B18.16.6");
  await valor.fill("ASME B18.16.6");
  await page.getByLabel("Comentario de la revisión").fill("Corrijo ANSI por ASME");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`${urlFicha.split("/").pop()}$`), { timeout: 20_000 });

  // El historial tiene las tres revisiones, con autor y fecha.
  await expect(page.getByText("Ficha creada")).toBeVisible();
  await expect(page.getByText("Agrego normas aplicables")).toBeVisible();
  await expect(page.getByText("Corrijo ANSI por ASME")).toBeVisible();

  // --- El diff reconstruye exactamente qué cambió ---
  await page.getByRole("link", { name: "Comparar revisiones" }).click();
  await expect(page).toHaveURL(/\/revisiones/, { timeout: 20_000 });

  await expect(page.getByText("Modificado", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "ANSI B18.16.6" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "ASME B18.16.6" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "filas[0].value" })).toBeVisible();
});

test("una revisión sin comentario no se puede guardar", async ({ page }) => {
  await entrar(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Tuerca de prueba M3" }).first().click();
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });

  await page.getByRole("link", { name: "Editar" }).click();
  await page.getByRole("button", { name: /Etiquetas cortas/ }).click();

  // Hay cambios pero no comentario: el botón queda habilitado y la acción rechaza.
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page.getByText(/Escribí un comentario/)).toBeVisible({ timeout: 20_000 });
});

test("los estados sólo avanzan por transiciones válidas", async ({ page }) => {
  await entrar(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Tuerca de prueba M3" }).first().click();

  // Desde borrador sólo se puede pasar a en revisión.
  await expect(page.getByRole("button", { name: "→ En revisión" })).toBeVisible();
  await expect(page.getByRole("button", { name: "→ Publicada" })).toHaveCount(0);

  await page.getByRole("button", { name: "→ En revisión" }).click();
  await expect(page.getByRole("button", { name: "→ Aprobada" })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "→ Aprobada" }).click();
  // Aprobada ya no lleva la advertencia de marca de agua.
  await expect(page.getByText(/marca de agua BORRADOR/)).toHaveCount(0, { timeout: 20_000 });
});
