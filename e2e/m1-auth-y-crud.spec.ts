import { test, expect } from "@playwright/test";

/**
 * M1 — verificación de punta a punta contra Supabase real.
 * Requiere E2E_EMAIL y E2E_PASSWORD de un usuario ya creado.
 */

const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const SELLO = process.env.E2E_SELLO ?? String(Date.now());

test("sin sesión, la app redirige al login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("login, alta de producto, alta de ficha e historial", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Entró: ya no estamos en /login.
  await expect(page).toHaveURL(/^(?!.*\/login).*$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Fichas" })).toBeVisible();

  // Alta de producto.
  const sku = `E2E-${SELLO}`;
  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill("Tuerca autofrenante E2E");
  await page.getByLabel("Nombre (inglés)").fill("Nylon Insert Lock Nut");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });
  await expect(page.getByText(sku)).toBeVisible();

  // Alta de ficha sobre ese producto.
  await page.goto("/fichas/nueva");
  await page.getByLabel("Producto").selectOption({ label: `${sku} — Tuerca autofrenante E2E` });
  await page.getByLabel("Versión").fill("1.0");
  await page.getByRole("button", { name: "Crear ficha" }).click();

  // Redirige al detalle de la ficha recién creada.
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Tuerca autofrenante E2E" })).toBeVisible();

  // Nace en borrador y avisa que el PDF llevaría marca de agua (§5 inv. 4).
  await expect(page.locator('.estado[data-estado="borrador"]')).toHaveText("Borrador");
  await expect(page.getByText(/marca de agua BORRADOR/)).toBeVisible();

  // El historial arranca en la revisión 1 (§1 requisito 2).
  await expect(page.getByText("Ficha creada")).toBeVisible();
});

test("SKU duplicado se rechaza con un mensaje claro", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^(?!.*\/login).*$/, { timeout: 20_000 });

  const sku = `E2E-${SELLO}`; // el mismo del test anterior
  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill("Duplicado");
  await page.getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText(new RegExp(`Ya existe un producto con el SKU`))).toBeVisible({
    timeout: 20_000,
  });
});
