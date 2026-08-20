import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * M4 — criterio de aceptación: la ficha de referencia sale en la cantidad
 * exacta de páginas A4 de su plantilla, sin página en blanco y con las
 * tipografías correctas.
 *
 * Hay dos fichas de referencia. La plantilla V26 (válvula esférica) es la
 * fuente de verdad visual y sale en 3 hojas; la de la tuerca autofrenante
 * sigue siendo el fixture del revisor con IA (§6) y sale en 2.
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

test("la plantilla V26 sale en exactamente 3 páginas A4 sin página en blanco", async ({ request }) => {
  const r = await request.get("/api/vista-previa/pdf");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/pdf");

  const info = inspeccionar(await r.body());

  expect(info.paginas).toBe(3);
  for (const [ancho, alto] of info.tamanos) {
    expect(Math.abs(ancho - 210)).toBeLessThan(1);
    expect(Math.abs(alto - 297)).toBeLessThan(1);
  }
  // Ninguna hoja vacía: una página en blanco daría casi cero caracteres.
  for (const n of info.caracteres) expect(n).toBeGreaterThan(100);
});

test("la ficha de la tuerca sigue saliendo en exactamente 2 páginas A4", async ({ request }) => {
  const info = inspeccionar(await (await request.get("/api/vista-previa/pdf?ficha=tuerca")).body());

  expect(info.paginas).toBe(2);
  for (const [ancho, alto] of info.tamanos) {
    expect(Math.abs(ancho - 210)).toBeLessThan(1);
    expect(Math.abs(alto - 297)).toBeLessThan(1);
  }
  for (const n of info.caracteres) expect(n).toBeGreaterThan(100);
});

test("los cuatro tipos de bloque nuevos llegan al PDF", async ({ request }) => {
  const dir = mkdtempSync(join(tmpdir(), "v26-"));
  const archivo = join(dir, "f.pdf");
  writeFileSync(archivo, await (await request.get("/api/vista-previa/pdf")).body());

  const py = `
import pymupdf, json
doc = pymupdf.open(${JSON.stringify(archivo)})
texto = chr(10).join(p.get_text() for p in doc)
print(json.dumps(texto))
`;
  const texto: string = JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" }));

  // lista-componentes: banda de encabezado y el ítem 17 del despiece.
  expect(texto).toContain("Perno de unión");
  // tabla-ancha: una fila de cotas y su nota de símbolos.
  expect(texto).toContain("351682");
  expect(texto).toContain("paso de esfera");
  // codigos: un código de repuesto y su nota.
  expect(texto).toContain("350846");
  expect(texto).toContain("Cada kit incluye");
  // tabla-kv vertical y el sufijo del rótulo de imagen.
  expect(texto).toContain("EMPAQUETADURA");
  // El título de cada hoja interior sale del bloque que la abre.
  expect(texto).toContain("Despiece y componentes");
  expect(texto).toContain("Tabla de cotas y códigos");
});

test("las tipografías van embebidas, incluida la bold italic de las cotas", async ({ request }) => {
  // Con la ficha de la tuerca: es la que tiene croquis, y sus símbolos de cota
  // son el único uso de Roboto bold italic.
  const r = await request.get("/api/vista-previa/pdf?ficha=tuerca");
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
  // La lista pagina de 25: se busca en vez de asumir que está en la primera
  // página.
  await page.goto("/?q=Tuerca+de+prueba+M3");
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

test("el paginado abre hojas de más en vez de recortar", async ({ request }) => {
  // La plantilla entra en tres hojas. Duplicando su contenido, el paginado
  // tiene que abrir más hojas — antes se recortaba en silencio.
  const conteos: number[] = [];
  for (const repetir of [1, 2, 3]) {
    const r = await request.get(`/api/vista-previa/pdf?repetir=${repetir}`);
    expect(r.status()).toBe(200);
    const info = inspeccionar(await r.body());
    conteos.push(info.paginas);

    // Ninguna hoja en blanco, y todas A4, en cualquier cantidad.
    for (const n of info.caracteres) expect(n).toBeGreaterThan(80);
    for (const [ancho, alto] of info.tamanos) {
      expect(Math.abs(ancho - 210)).toBeLessThan(1);
      expect(Math.abs(alto - 297)).toBeLessThan(1);
    }
  }

  expect(conteos[0]).toBe(3);
  // Más contenido, más hojas: monótono y estrictamente creciente.
  expect(conteos[1]).toBeGreaterThan(conteos[0]);
  expect(conteos[2]).toBeGreaterThan(conteos[1]);
});

test("la pantalla pagina igual que el PDF", async ({ page, request }) => {
  // Si midieran distinto, la vista previa mentiría sobre el PDF.
  await page.goto("/vista-previa");
  await page.waitForSelector(".hoja:not([data-medir-hoja])");
  await page.evaluate(() => document.fonts.ready);
  const enPantalla = await page.locator(".hoja:not([data-medir-hoja])").count();

  const enPdf = inspeccionar(await (await request.get("/api/vista-previa/pdf")).body()).paginas;

  expect(enPantalla).toBe(enPdf);
});

test("cada hoja lleva su numeración correcta", async ({ request }) => {
  const r = await request.get("/api/vista-previa/pdf?repetir=2");
  const dir = mkdtempSync(join(tmpdir(), "pag-"));
  const archivo = join(dir, "f.pdf");
  writeFileSync(archivo, await r.body());

  const py = `
import pymupdf, json
doc = pymupdf.open(${JSON.stringify(archivo)})
print(json.dumps([f"{i+1} / {len(doc)}" in p.get_text() for i, p in enumerate(doc)]))
`;
  const pies: boolean[] = JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" }));
  expect(pies.length).toBeGreaterThan(2);
  for (const ok of pies) expect(ok).toBe(true);
});
