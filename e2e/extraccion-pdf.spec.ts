import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

/**
 * Carga de una ficha desde un PDF (§4bis).
 *
 * Lo que se verifica no es sólo que transcriba: es que NO guarde. La
 * extracción deja un borrador en el editor y la revisión la crea la persona
 * al apretar guardar, así que `ficha_revision` sigue teniendo únicamente
 * cambios que alguien aprobó (§1 requisito 2).
 */

const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** La ficha de referencia del disco: un PDF real, de una hoja. */
const PDF = "referencia/Ficha Tecnica - Disco de corte SG Steelox.pdf";
/** El mismo PDF, en memoria, para los tests que pegan derecho al endpoint. */
const PDF_BYTES = readFileSync(PDF);

let contador = 0;
const sufijo = () => `${Date.now().toString(36)}-${++contador}`;

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

/** Producto y ficha vacía, creados desde la interfaz. */
async function fichaVacia(page: import("@playwright/test").Page) {
  const marca = sufijo();
  const sku = `PDF-${marca}`;
  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill(`Producto PDF ${marca}`);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });

  await page.goto("/fichas/nueva");
  await page.getByLabel("Producto").selectOption({ label: `${sku} — Producto PDF ${marca}` });
  await page.getByRole("button", { name: "Crear ficha" }).click();
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  return page.url().split("/").pop()!;
}

test("un PDF se transcribe a bloques y queda como borrador sin guardar", async ({ page }) => {
  test.setTimeout(150_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);

  const antes = await rest(`ficha_revision?ficha_id=eq.${fichaId}&select=n`);
  expect(antes.length).toBe(1);

  await page.goto(`/fichas/${fichaId}/editar`);
  await expect(page.locator(".orden-item")).toHaveCount(0);

  await page.locator("#pdf-origen").setInputFiles(PDF);
  // El botón vuelve a su texto normal cuando termina la transcripción.
  await expect(page.getByRole("button", { name: "Cargar desde PDF" })).toBeVisible({
    timeout: 120_000,
  });

  // Transcribió varios bloques, con el header primero (§4).
  const bloques = await page.locator(".orden-item").count();
  expect(bloques).toBeGreaterThan(3);
  // Las mayúsculas del rótulo son de CSS, así que se compara sin distinguir caso.
  await expect(page.locator(".orden-item").first()).toContainText(/cabecera/i);

  // Y NO guardó: sigue habiendo una sola revisión.
  const durante = await rest(`ficha_revision?ficha_id=eq.${fichaId}&select=n`);
  expect(durante.length).toBe(1);

  // El comentario viene precargado con el archivo, para que quede el rastro.
  await expect(page.getByLabel("Comentario de la revisión")).toHaveValue(/\.pdf$/);

  // Recién cuando la persona guarda, se crea la revisión.
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`${fichaId}$`), { timeout: 25_000 });

  const despues = await rest(`ficha_revision?ficha_id=eq.${fichaId}&select=n,bloques`);
  expect(despues.length).toBe(2);
  expect(despues.find((r: { n: number }) => r.n === 2).bloques.length).toBe(bloques);

  // Y la ficha renderiza con ese contenido. Se mira el primer título: cuántos
  // bloques emite el modelo varía entre corridas, y alguna vez transcribe dos
  // cabeceras — que la app avisa antes de guardar, pero no impide.
  await page.waitForSelector(".hoja:not([data-medir-hoja])", { timeout: 20_000 });
  await expect(page.locator(".hoja:not([data-medir-hoja]) h1").first()).toContainText(
    /STEELOX/i,
  );
});

test("el contenido que no entra en un bloque se informa, no se descarta en silencio", async ({ page }) => {
  test.setTimeout(150_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);

  await page.goto(`/fichas/${fichaId}/editar`);
  await page.locator("#pdf-origen").setInputFiles(PDF);
  await expect(page.getByRole("button", { name: "Cargar desde PDF" })).toBeVisible({
    timeout: 120_000,
  });

  // El PDF del disco trae pictogramas de seguridad sin texto: el modelo no
  // los puede transcribir y tiene que decirlo en vez de inventarlos.
  await expect(page.getByText("No se transcribió:")).toBeVisible();
  expect(await page.locator(".aviso ul li").count()).toBeGreaterThan(0);
});

test("las imágenes del PDF se adjuntan a los bloques que las usan", async ({ page }) => {
  test.setTimeout(180_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);

  const r = await page.request.post(`/api/fichas/${fichaId}/extraer`, {
    multipart: { pdf: { name: "disco.pdf", mimeType: "application/pdf", buffer: PDF_BYTES } },
    timeout: 120_000,
  });
  expect(r.ok()).toBe(true);
  const datos = await r.json();

  // El PDF del disco trae tres imágenes de contenido; la foto de producto es
  // la que el modelo tiene que reconocer como la del header.
  expect(datos.imagenesUsadas).toBeGreaterThan(0);
  const header = datos.bloques.find((b: { tipo: string }) => b.tipo === "header");
  expect(header.fotoAssetId).toBeTruthy();

  // El asset quedó registrado, con el hash del contenido en la ruta.
  const assets = await rest(`asset?id=eq.${header.fotoAssetId}&select=storage_path,tipo`);
  expect(assets.length).toBe(1);
  expect(assets[0].tipo).toBe("foto");
  expect(assets[0].storage_path).toMatch(/\/pdf-[0-9a-f]{12}\.(png|jpg)$/);

  // Cuántas imágenes asigna el modelo depende de su criterio, así que no se
  // fija acá; que las no asignadas se informen se prueba en las unitarias.
  expect(datos.imagenesUsadas).toBeLessThanOrEqual(3);
});

test("cargar dos veces el mismo PDF no duplica la imagen en la librería", async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page);

  // Dos fichas distintas, el mismo PDF: es el caso de §7 — el croquis se sube
  // una vez y las fichas de la familia lo reusan. Sin deduplicar, la librería
  // junta una copia por ficha y queda inservible.
  const idsAsset: string[] = [];
  for (let i = 0; i < 2; i++) {
    const fichaId = await fichaVacia(page);
    const r = await page.request.post(`/api/fichas/${fichaId}/extraer`, {
      multipart: { pdf: { name: "disco.pdf", mimeType: "application/pdf", buffer: PDF_BYTES } },
      timeout: 120_000,
    });
    expect(r.ok()).toBe(true);
    const datos = await r.json();
    const header = datos.bloques.find((b: { tipo: string }) => b.tipo === "header");
    idsAsset.push(header.fotoAssetId);
  }

  expect(idsAsset[0]).toBe(idsAsset[1]);
});

test("un archivo que no es PDF se rechaza con un mensaje claro", async ({ page }) => {
  await entrar(page);
  const fichaId = await fichaVacia(page);

  const r = await page.request.post(`/api/fichas/${fichaId}/extraer`, {
    multipart: {
      pdf: { name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("no soy un pdf") },
    },
  });
  expect(r.status()).toBe(422);
  expect((await r.json()).error).toContain("no es un PDF");
});

test("extraer exige sesión", async ({ request }) => {
  const r = await request.post("/api/fichas/00000000-0000-0000-0000-000000000000/extraer", {
    multipart: {
      pdf: { name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
    },
    maxRedirects: 0,
  });
  expect(r.status()).toBe(401);
});
