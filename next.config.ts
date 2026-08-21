import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El bundle de Chromium no debe pasar por webpack. mupdf tampoco: es WASM,
  // y si webpack lo procesa el .wasm no queda junto al módulo que lo carga.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "mupdf"],

  // El generador de PDF lee estos archivos del disco en tiempo de ejecución
  // (ver src/lib/pdf/recursos.ts). Sin declararlos, el file tracing de Next
  // no los copia al bundle serverless y el PDF sale sin estilos ni fuentes.
  //
  // El binario de Chromium es el caso extremo: `serverExternalPackages` evita
  // que webpack lo relocalice, pero el tracing tampoco lo copia porque los
  // `.br` de `bin/` no los importa nadie — @sparticuz/chromium los lee del
  // disco al arrancar. Sin esta línea, en Vercel el PDF falla con
  // «The input directory "/var/task/node_modules/@sparticuz/chromium/bin"
  // does not exist».
  outputFileTracingIncludes: {
    "/api/fichas/[id]/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./src/app/design-system.css",
      "./src/components/ficha/ficha.css",
      "./public/fonts/**",
      "./public/fonts-estaticas/**",
      "./public/ficha/**",
    ],
    "/api/vista-previa/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./src/app/design-system.css",
      "./src/components/ficha/ficha.css",
      "./public/fonts/**",
      "./public/fonts-estaticas/**",
      "./public/ficha/**",
    ],
  },
};

export default nextConfig;
