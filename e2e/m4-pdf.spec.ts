import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * M4 — criterio de aceptación: la ficha de referencia sale en exactamente
 * 2 páginas A4, sin página en blanco, con las tipografías correctas.
 */

const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;

interface InfoPdf {
  paginas: number;
  tamanos: [number, number][];
  caracteres: number[];
  fuentes: string[];
  fuentesEmbebidas: number;
  tieneMarcaDeAgua: boolean;
}

/** Inspecciona el PDF con PyMuPDF: es la única forma de comprobar de verdad
 *  el tamaño de página y si las fuentes quedaron embebidas. */
function inspeccionar(bytes: Buffer): InfoPdf {
  const dir = mkdtempSync(join(tmpdir(), "pdf-"));
  const archivo = join(dir, "f.pdf");
  writeFileSync(archivo, bytes);

  const py = `
import pymupdf, json
doc = pymupdf.open(${JSON.stringify(archivo)})
fuentes, embebidas = set(), 0
for p in doc:
    for f in p.get_fonts(full=True):
        fuentes.add(f[3].split("+")[-1])
        if f[1] not in ("", "n/a"): embebidas += 1
print(json.dumps({
  "paginas": len(doc),
  "tamanos": [[round(p.rect.width*25.4/72,1), round(p.rect.height*25.4/72,1)] for p in doc],
  "caracteres": [len(p.get_text().strip()) for p in doc],
  "fuentes": sorted(fuentes),
  "fuentesEmbebidas": embebidas,
  "tieneMarcaDeAgua": any("BORRADOR" in p.get_text() for p in doc),
}))
`;
  return JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" }));
}

test("la ficha de referencia sale en exactamente 2 páginas A4 sin página en blanco", async ({ request }) => {
  const r = await request.get("/api/vista-previa/pdf");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/pdf");

  const info = inspeccionar(await r.body());

  expect(info.paginas).toBe(2);
  for (const [ancho, alto] of info.tamanos) {
    expect(Math.abs(ancho - 210)).toBeLessThan(1);
    expect(Math.abs(alto - 297)).toBeLessThan(1);
  }
  // Ninguna hoja vacía: una página en blanco daría casi cero caracteres.
  for (const n of info.caracteres) expect(n).toBeGreaterThan(100);
});

test("las tipografías van embebidas, incluida la bold italic de las cotas", async ({ request }) => {
  const r = await request.get("/api/vista-previa/pdf");
  const info = inspeccionar(await r.body());

  expect(info.fuentesEmbebidas).toBeGreaterThan(0);
  // Ninguna fuente de sistema: si Chromium hubiera caído a fallback,
  // aparecerían Arial, Helvetica o DejaVu.
  for (const f of info.fuentes) expect(f).toMatch(/^Roboto/);
  // El corte que el @import del design system no traía.
  expect(info.fuentes).toContain("Roboto-BoldItalic");
  expect(info.fuentes).toContain("RobotoCondensed-Bold");
});

test("la marca de agua BORRADOR depende del estado (§5 invariante 4)", async ({ request }) => {
  const borrador = inspeccionar(await (await request.get("/api/vista-previa/pdf?estado=borrador")).body());
  expect(borrador.tieneMarcaDeAgua).toBe(true);

  const enRevision = inspeccionar(await (await request.get("/api/vista-previa/pdf?estado=en_revision")).body());
  expect(enRevision.tieneMarcaDeAgua).toBe(true);

  for (const estado of ["aprobada", "publicada"]) {
    const limpia = inspeccionar(await (await request.get(`/api/vista-previa/pdf?estado=${estado}`)).body());
    expect(limpia.tieneMarcaDeAgua).toBe(false);
  }
});

test("el PDF de una ficha real exige sesión y respeta su estado", async ({ page, request }) => {
  // Sin sesión, el endpoint contesta 401 y no entrega un PDF.
  const anonima = await request.get("/api/fichas/00000000-0000-0000-0000-000000000000/pdf", {
    maxRedirects: 0,
  });
  expect(anonima.status()).toBe(401);
  expect(anonima.headers()["content-type"]).not.toContain("application/pdf");

  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^(?!.*\/login).*$/, { timeout: 20_000 });

  // Una ficha con bloques: la de M3 quedó con contenido.
  await page.goto("/");
  const enlace = page.getByRole("link", { name: /Tuerca de prueba M3/ }).first();
  await enlace.click();
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const fichaId = page.url().split("/").pop()!;

  const conSesion = await page.request.get(`/api/fichas/${fichaId}/pdf`);
  expect(conSesion.status()).toBe(200);

  const info = inspeccionar(await conSesion.body());
  expect(info.paginas).toBeGreaterThanOrEqual(1);
  for (const [ancho, alto] of info.tamanos) {
    expect(Math.abs(ancho - 210)).toBeLessThan(1);
    expect(Math.abs(alto - 297)).toBeLessThan(1);
  }
});
