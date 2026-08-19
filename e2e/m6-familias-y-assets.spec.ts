import { test, expect } from "@playwright/test";

/**
 * M6 — familias, plantillas, librería de assets y bloque chart.
 *
 * La subida de assets necesita las políticas de storage.objects que trae
 * supabase/migrations/0004_storage_assets.sql. Si no están aplicadas, esa
 * prueba lo dice en vez de fallar sin explicación.
 */

const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// El SKU es único en la base y el estado de módulo no sobrevive entre tests,
// así que el sufijo se calcula en cada llamada.
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

/** Ficha con contenido real, para poder guardarla como plantilla. */
async function fichaConContenido(page: import("@playwright/test").Page) {
  const marca = sufijo();
  const sku = `M6-${marca}`;

  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill(`Producto M6 ${marca}`);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });

  await page.goto("/fichas/nueva");
  await page.getByLabel("Producto").selectOption({ label: `${sku} — Producto M6 ${marca}` });
  await page.getByRole("button", { name: "Crear ficha" }).click();
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const fichaId = page.url().split("/").pop()!;

  await page.goto(`/fichas/${fichaId}/editar`);
  await page.getByRole("button", { name: /Tabla etiqueta/ }).click();
  await page.getByLabel("Etiqueta de la sección").fill("Normas aplicables");
  await page.getByPlaceholder("Etiqueta", { exact: true }).first().fill("Métrico · M");
  await page.getByPlaceholder("Valor", { exact: true }).first().fill("DIN 985");
  await page.getByLabel("Comentario de la revisión").fill("Carga inicial");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`${fichaId}$`), { timeout: 20_000 });

  return { fichaId, sku };
}

test("guardar como plantilla conserva la estructura y descarta los datos", async ({ page }) => {
  await entrar(page);
  const { fichaId } = await fichaConContenido(page);

  await page.goto(`/fichas/${fichaId}`);
  await page.getByRole("button", { name: "Guardar como plantilla de familia" }).click();
  const nombreFamilia = `Familia M6 ${sufijo()}`;
  await page.getByLabel("Nombre de la familia").fill(nombreFamilia);
  await page.getByRole("button", { name: "Guardar plantilla" }).click();

  await expect(page).toHaveURL(/\/familias\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: nombreFamilia })).toBeVisible();

  // La etiqueta de sección es estructura y sobrevive.
  await expect(page.getByRole("cell", { name: "Normas aplicables" })).toBeVisible();

  // El valor es dato y no.
  const familias = await rest(
    `familia?nombre=eq.${encodeURIComponent(nombreFamilia)}&select=plantilla_bloques`,
  );
  const json = JSON.stringify(familias[0].plantilla_bloques);
  expect(json).toContain("Normas aplicables");
  expect(json).toContain("Métrico · M");
  expect(json).not.toContain("DIN 985");
});

test("una ficha desde plantilla nace con los bloques, con ids nuevos y sin datos", async ({ page }) => {
  await entrar(page);
  const { fichaId } = await fichaConContenido(page);

  // Plantilla desde la primera ficha.
  await page.goto(`/fichas/${fichaId}`);
  await page.getByRole("button", { name: "Guardar como plantilla de familia" }).click();
  const nombreFamilia = `Familia inst ${sufijo()}`;
  await page.getByLabel("Nombre de la familia").fill(nombreFamilia);
  await page.getByRole("button", { name: "Guardar plantilla" }).click();
  await expect(page).toHaveURL(/\/familias\/[0-9a-f-]{36}$/, { timeout: 20_000 });

  // Producto nuevo para la segunda ficha.
  const marca2 = sufijo();
  const sku = `M6-inst-${marca2}`;
  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill(`Instanciada ${marca2}`);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });

  await page.goto("/fichas/nueva");
  await page.getByLabel("Producto").selectOption({ label: `${sku} — Instanciada ${marca2}` });
  await page.getByLabel("Familia (plantilla)").selectOption({ label: nombreFamilia });
  await page.getByRole("button", { name: "Crear desde plantilla" }).click();

  // Va derecho al editor: la ficha ya tiene su forma y falta el contenido.
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}\/editar$/, { timeout: 20_000 });
  const nuevaId = page.url().split("/")[4];

  // El bloque está, con su etiqueta, y el valor vacío.
  await expect(page.getByLabel("Etiqueta de la sección")).toHaveValue("Normas aplicables");
  await expect(page.getByPlaceholder("Valor", { exact: true }).first()).toHaveValue("");

  // Los ids no se comparten entre las dos fichas.
  const [a, b] = await Promise.all([
    rest(`ficha_revision?ficha_id=eq.${fichaId}&select=bloques&order=n.desc&limit=1`),
    rest(`ficha_revision?ficha_id=eq.${nuevaId}&select=bloques&order=n.desc&limit=1`),
  ]);
  const idsA = (a[0].bloques as { id: string }[]).map((x) => x.id);
  const idsB = (b[0].bloques as { id: string }[]).map((x) => x.id);
  expect(idsB.length).toBe(idsA.length);
  expect(idsB.filter((x) => idsA.includes(x))).toHaveLength(0);
});

test("el bloque chart sale en el PDF con su tabla de datos", async ({ request }) => {
  const r = await request.get("/api/vista-previa/pdf?chart=1");
  expect(r.status()).toBe(200);
  const bytes = await r.body();

  // El texto del SVG y de la tabla es extraíble: el color no es el único canal.
  const texto = bytes.toString("latin1");
  expect(texto.length).toBeGreaterThan(1000);

  // Verificación real del contenido con PyMuPDF.
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "chart-"));
  const archivo = join(dir, "f.pdf");
  writeFileSync(archivo, bytes);

  const py = `
import pymupdf, json
doc = pymupdf.open(${JSON.stringify(archivo)})
t = "".join(p.get_text() for p in doc)
print(json.dumps({
  "etiqueta": "PAR DE APRIETE ORIENTATIVO" in t,
  "leyenda": "A2-70 (304)" in t and "A4-80 (316)" in t,
  "ejes": "DIÁMETRO NOMINAL (MM)" in t and "PAR (N·M)" in t,
  "tabla": "224" in t and "168" in t,
}))
`;
  const info = JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" }));
  expect(info.etiqueta).toBe(true);
  expect(info.leyenda).toBe(true);
  expect(info.ejes).toBe(true);
  expect(info.tabla).toBe(true);
});

test("la librería de assets acepta una subida", async ({ page }) => {
  await entrar(page);
  const { fichaId } = await fichaConContenido(page);

  await page.goto(`/fichas/${fichaId}`);
  await page.getByRole("button", { name: "Guardar como plantilla de familia" }).click();
  await page.getByLabel("Nombre de la familia").fill(`Familia assets ${sufijo()}`);
  await page.getByRole("button", { name: "Guardar plantilla" }).click();
  await expect(page).toHaveURL(/\/familias\/[0-9a-f-]{36}$/, { timeout: 20_000 });

  // PNG mínimo válido de 1x1.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Archivo").setInputFiles({
    name: "croquis-prueba.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByLabel("Descripción (texto alternativo)").fill("Croquis de prueba");
  await page.getByRole("button", { name: "Subir a la librería" }).click();

  const errorRls = page.getByText(/row-level security|Unauthorized/i);
  const subido = page.getByText("Croquis de prueba");

  await expect(errorRls.or(subido).first()).toBeVisible({ timeout: 20_000 });

  if (await errorRls.isVisible()) {
    throw new Error(
      "Falta aplicar supabase/migrations/0004_storage_assets.sql: sin sus políticas, " +
        "storage.objects rechaza la subida de un usuario autenticado.",
    );
  }
  await expect(subido).toBeVisible();
});
