import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";

/**
 * Lanza Chromium para el render del PDF.
 *
 * En Vercel se usa @sparticuz/chromium, que trae el binario comprimido para
 * la función serverless. Fuera de Vercel se usa un Chromium del sistema:
 * @sparticuz/chromium sólo corre en el runtime de AWS Lambda y falla en
 * cualquier otro lado, así que no sirve ni para desarrollo ni para las
 * pruebas de este repo.
 *
 * §9 marca como riesgo que el bundle de Chromium exceda el límite de la
 * función. Si eso pasa, el reemplazo es esta única función: apuntarla a un
 * runner self-hosted o a un servicio de browser gestionado, con
 * puppeteer.connect en vez de launch.
 */

const EN_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

/** Rutas donde suele estar Chromium fuera de serverless. */
const CANDIDATOS_LOCALES = [
  process.env.CHROMIUM_PATH,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter((v): v is string => Boolean(v));

async function ejecutableLocal(): Promise<string> {
  const { access } = await import("node:fs/promises");
  for (const ruta of CANDIDATOS_LOCALES) {
    try {
      await access(ruta);
      return ruta;
    } catch {
      // Probar el siguiente.
    }
  }
  throw new Error(
    "No encontramos Chromium. Instalalo o definí CHROMIUM_PATH con la ruta al binario.",
  );
}

export async function abrirNavegador(): Promise<Browser> {
  if (EN_SERVERLESS) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath: await ejecutableLocal(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
}
