import { test, expect } from "@playwright/test";

/**
 * El editor de tres paneles: la hoja como lienzo, con selección, reordenado
 * arrastrando y ancho por la grilla.
 *
 * Lo que se verifica es que el lienzo y el modelo no se separen: lo que se hace
 * arrastrando tiene que quedar en los bloques que se guardan, y el ancho sólo
 * puede caer en una de las cuatro fracciones de §4.
 */

const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;

let contador = 0;
const sufijo = () => `${Date.now().toString(36)}-${++contador}`;

async function entrar(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/^(?!.*\/login).*$/, { timeout: 20_000 });
}

/** Una ficha vacía, lista para editar. Devuelve su id. */
async function fichaVacia(page: import("@playwright/test").Page) {
  const marca = sufijo();
  const sku = `TAL-${marca}`;

  await page.goto("/productos/nuevo");
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Nombre (castellano)").fill(`Producto taller ${marca}`);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/productos$/, { timeout: 20_000 });

  await page.goto("/fichas/nueva");
  await page.getByLabel("Producto").selectOption({ label: `${sku} — Producto taller ${marca}` });
  await page.getByRole("button", { name: "Crear ficha" }).click();
  await expect(page).toHaveURL(/\/fichas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  return page.url().split("/").pop()!;
}

/**
 * Agrega tres bloques con rótulo distinguible y devuelve sus rótulos.
 *
 * Los pasa a ancho completo a propósito: "Párrafos" nace de media hoja y dos
 * bloques de media hoja se reparten en las dos columnas independientes de la
 * zona, así que el orden del DOM deja de ser el orden de lectura. Estas pruebas
 * son sobre el ORDEN de los bloques, no sobre el reparto en columnas —que tiene
 * su propia prueba más abajo—, y a ancho completo el DOM lo refleja derecho.
 */
async function conTresBloques(page: import("@playwright/test").Page) {
  const rotulos = ["Uno", "Dos", "Tres"];
  for (const r of rotulos) {
    await page.locator(".paleta").getByRole("button", { name: /Agregar Párrafos/ }).click();
    await page.getByLabel("Etiqueta de la sección").fill(r);
    await page.locator(".ancho-opcion", { hasText: "Completo" }).click();
  }
  await expect(page.locator(".orden-item")).toHaveCount(3);
  return rotulos;
}

test("el lienzo muestra la hoja real y hacer clic en un bloque abre sus campos", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);

  // Sin bloques, el inspector invita a elegir uno.
  await expect(page.getByText("Hacé clic en un bloque de la hoja")).toBeVisible();

  await page.locator(".paleta").getByRole("button", { name: /Agregar Tabla etiqueta/ }).click();
  await page.getByPlaceholder("Etiqueta", { exact: true }).first().fill("Datos técnicos");

  // El bloque aparece en la hoja, no sólo en el formulario.
  const enLaHoja = page.locator(".lienzo .bloque[data-bloque-id]");
  await expect(enLaHoja).toHaveCount(1, { timeout: 20_000 });
  await expect(enLaHoja.first()).toContainText("Datos técnicos");

  // Agregar otro y volver al primero haciendo clic en la hoja.
  await page.locator(".paleta").getByRole("button", { name: /Agregar Párrafos/ }).click();
  await page.getByLabel("Etiqueta de la sección").fill("Descripción");
  await expect(page.locator(".orden-item")).toHaveCount(2);

  await page.locator(".lienzo .bloque[data-bloque-id]").first().click();
  // El inspector siguió la selección: muestra el tipo del bloque de la hoja.
  await expect(page.locator(".inspector-cabecera")).toContainText("Tabla etiqueta");
  await expect(page.locator(".marco-seleccion")).toHaveCount(1);
});

test("reordenar arrastrando en la lista cambia el orden que se guarda", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);
  await conTresBloques(page);

  const orden = async () =>
    (await page.locator(".orden-item .orden-nombre").allTextContents()).map((t) =>
      t.replace(/^Párrafos · /, ""),
    );

  expect(await orden()).toEqual(["Uno", "Dos", "Tres"]);

  // El tercero al primer lugar: antes eran dos clics de "subir" y ahora es un
  // arrastre a la zona de arriba de todo.
  await page.locator(".orden-item").nth(2).dragTo(page.locator(".orden-hueco").first());
  await expect
    .poll(orden, { timeout: 10_000 })
    .toEqual(["Tres", "Uno", "Dos"]);

  await page.getByLabel("Comentario de la revisión").fill("Reordeno arrastrando");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`${fichaId}$`), { timeout: 25_000 });

  // El orden del lienzo es el que quedó guardado.
  const etiquetas = await page
    .locator(".hoja:not([data-medir-hoja]) .bloque-etiqueta")
    .allTextContents();
  expect(etiquetas.slice(0, 3)).toEqual(["Tres", "Uno", "Dos"]);
});

test("el ancho sólo cae en una de las cuatro fracciones de la grilla", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);

  await page.locator(".paleta").getByRole("button", { name: /Agregar Párrafos/ }).click();
  const bloque = page.locator(".lienzo .bloque[data-bloque-id]").first();
  await expect(bloque).toHaveCount(1, { timeout: 20_000 });

  // Cada opción del inspector se refleja en el data-ancho de la hoja, que es lo
  // que el CSS traduce a pistas de la grilla.
  for (const [nombre, valor] of [
    ["Un tercio", "un-tercio"],
    ["Dos tercios", "dos-tercios"],
    ["Media hoja", "medio"],
    ["Completo", "completo"],
  ] as const) {
    await page.locator(".ancho-opcion", { hasText: nombre }).click();
    await expect(bloque).toHaveAttribute("data-ancho", valor, { timeout: 10_000 });
  }
});

test("arrastrar un tipo de la paleta al lienzo lo inserta en ese lugar", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);
  await conTresBloques(page);

  // Se suelta sobre el segundo bloque de la hoja: el nuevo cae ANTES de él.
  const segundo = page.locator(".lienzo .bloque[data-bloque-id]").nth(1);
  await page.locator(".tipo-opcion", { hasText: "Aplicaciones típicas" }).dragTo(segundo);

  await expect(page.locator(".orden-item")).toHaveCount(4, { timeout: 10_000 });
  const nombres = await page.locator(".orden-item .orden-nombre").allTextContents();
  expect(nombres[1]).toContain("Etiquetas cortas");
});

test("los avisos de §4 aparecen antes de guardar y llevan al bloque", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);

  // §4: en tabla-ancha la nota define los símbolos de las columnas, así que es
  // obligatoria. Nace vacía, así que el aviso tiene que estar.
  await page.locator(".paleta").getByRole("button", { name: /Agregar Tabla de cotas/ }).click();
  const aviso = page.getByRole("button", { name: /no tiene la nota que define/ });
  await expect(aviso).toBeVisible({ timeout: 10_000 });

  // Al llenarla, el aviso se va.
  await page.getByLabel("Nota que define los símbolos").fill("Ød paso de esfera");
  await expect(aviso).toHaveCount(0, { timeout: 10_000 });
});

test("el zoom del lienzo no cambia los bloques", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);
  await page.locator(".paleta").getByRole("button", { name: /Agregar Párrafos/ }).click();
  await expect(page.locator(".lienzo .bloque[data-bloque-id]")).toHaveCount(1, {
    timeout: 20_000,
  });

  await page.locator(".zoom-opcion", { hasText: "50%" }).click();
  await expect(page.locator(".zoom-opcion[data-activo='true']")).toContainText("50%");
  // El zoom es de presentación: la cantidad de bloques y la selección no se
  // tocan, y el marco sigue cayendo sobre el bloque.
  await expect(page.locator(".lienzo .bloque[data-bloque-id]")).toHaveCount(1);
  await expect(page.locator(".orden-item")).toHaveCount(1);
});

test("los símbolos de cota se colocan arrastrando y llegan a la hoja y al PDF", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);

  // Un croquis con su leyenda y su imagen. La imagen puede no estar —el
  // producto de prueba no tiene familia— y los símbolos se colocan igual: caen
  // sobre la caja del bloque.
  await page
    .locator(".paleta")
    .getByRole("button", { name: /Agregar Croquis/ })
    .click();
  await page.getByPlaceholder("d").first().fill("Ød");
  await page.getByPlaceholder("diámetro nominal").first().fill("Paso de esfera");

  // Dos símbolos sobre la imagen. Nacen en el centro.
  const agregar = page.getByRole("button", { name: "Agregar marca sobre la imagen" });
  await agregar.click();
  await page.getByLabel("Símbolo 1").fill("Ød");
  await agregar.click();
  await page.getByLabel("Símbolo 2").fill("L");

  // En la hoja se dibujan los dos, con la apariencia que fija el CSS.
  const marcas = page.locator(".lienzo .marca-cota");
  await expect(marcas).toHaveCount(2, { timeout: 20_000 });
  await expect(marcas.first()).toHaveText("Ød");

  // Arrastrar la primera la mueve, y la posición se refleja en el inspector.
  const antes = await page.locator(".marca-posicion").first().textContent();
  const caja = page.locator(".lienzo .lienzo-cotas").first();
  const r = (await caja.boundingBox())!;
  const origen = (await marcas.first().boundingBox())!;
  await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.75, { steps: 8 });
  await page.mouse.up();

  // El porcentaje que muestra el inspector es el del punto donde se soltó.
  await expect
    .poll(async () => page.locator(".marca-posicion").first().textContent(), {
      timeout: 10_000,
    })
    .not.toBe(antes);

  await page.getByLabel("Comentario de la revisión").fill("Coloco los símbolos de cota");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`${fichaId}$`), { timeout: 25_000 });

  // La ficha guardada los muestra: es el mismo componente que el PDF (§3).
  await expect(page.locator(".hoja:not([data-medir-hoja]) .marca-cota")).toHaveCount(2, {
    timeout: 20_000,
  });

  // Y salen en el PDF, con su símbolo como texto seleccionable.
  const pdf = await page.request.get(`/api/fichas/${fichaId}/pdf`, { timeout: 90_000 });
  expect(pdf.ok()).toBe(true);
  const bytes = await pdf.body();
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
});

test("un símbolo sin texto no se dibuja en la hoja", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);

  await page
    .locator(".paleta")
    .getByRole("button", { name: /Agregar Croquis/ })
    .click();
  await page.getByRole("button", { name: "Agregar marca sobre la imagen" }).click();

  // Nace vacío: no hay nada que mostrar, así que no se dibuja. Un cuadrito
  // vacío sobre el dibujo sería basura en la ficha que ve el cliente.
  await expect(page.locator(".lienzo .marca-cota")).toHaveCount(0);
  await page.getByLabel("Símbolo 1").fill("A");
  await expect(page.locator(".lienzo .marca-cota")).toHaveCount(1, { timeout: 20_000 });
});

test("las imágenes que el filtro descarta se pueden rescatar a la librería", async ({ page }) => {
  test.setTimeout(180_000);
  await entrar(page);

  // El producto necesita familia: la librería es por familia (§7). Se reusa la
  // ficha del disco, cuyo PDF trae ocho imágenes que el filtro descarta —los
  // pictogramas de seguridad entre ellas.
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);

  await page.locator("#pdf-origen").setInputFiles(
    "referencia/Ficha Tecnica - Disco de corte SG Steelox.pdf",
  );
  await expect(page.getByRole("button", { name: "Cargar desde PDF" })).toBeVisible({
    timeout: 150_000,
  });

  // El filtro descarta ocho imágenes en esa ficha, y cada una dice por qué.
  const tarjetas = page.locator(".descartada");
  await expect(tarjetas.first()).toBeVisible({ timeout: 20_000 });
  const cuantas = await tarjetas.count();
  expect(cuantas).toBeGreaterThan(3);
  await expect(tarjetas.first()).toContainText(/hoja 1/);

  // Sin familia asignada no se puede guardar en ninguna librería, y lo dice en
  // vez de fallar en silencio.
  await tarjetas.first().getByRole("button", { name: "Agregar a la librería" }).click();
  await expect(page.locator("p.error")).toContainText(/familia asignada/, { timeout: 20_000 });
});

test("dos bloques de media hoja se reparten en columnas independientes", async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page);
  const fichaId = await fichaVacia(page);
  await page.goto(`/fichas/${fichaId}/editar`);

  // "Párrafos" nace de media hoja, que es el ancho que entra al flujo de dos
  // columnas: el tercero va debajo del más corto y no abre una fila nueva.
  for (const r of ["Uno", "Dos", "Tres"]) {
    await page.locator(".paleta").getByRole("button", { name: /Agregar Párrafos/ }).click();
    await page.getByLabel("Etiqueta de la sección").fill(r);
  }
  await expect(page.locator(".orden-item")).toHaveCount(3);

  const zona = page.locator(".lienzo .zona-columnas");
  await expect(zona).toHaveCount(1, { timeout: 20_000 });

  const columnas = zona.locator(".columna");
  await expect(columnas).toHaveCount(2);
  // Con los tres del mismo alto, el primero y el tercero quedan a la izquierda
  // y el segundo solo a la derecha. Es el reparto de columnas independientes:
  // el tercero no espera a que la derecha se llene.
  await expect(columnas.nth(0).locator(".bloque-etiqueta")).toHaveText(["Uno", "Tres"]);
  await expect(columnas.nth(1).locator(".bloque-etiqueta")).toHaveText(["Dos"]);
});
