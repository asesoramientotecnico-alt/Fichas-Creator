import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El bundle de Chromium no debe pasar por webpack. mupdf tampoco: es WASM,
  // y si webpack lo procesa el .wasm no queda junto al módulo que lo carga.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "mupdf"],

  // El generador de PDF lee estos archivos del disco en tiempo de ejecución
  // (ver src/lib/pdf/recursos.ts). Sin declararlos, el file tracing de Next
  // no los copia al bundle serverless y el PDF sale sin estilos ni fuentes.
  outputFileTracingIncludes: {
    "/api/fichas/[id]/pdf": [
      "./src/app/design-system.css",
      "./src/components/ficha/ficha.css",
      "./public/fonts/**",
      "./public/fonts-estaticas/**",
      "./public/ficha/**",
    ],
    "/api/vista-previa/pdf": [
      "./src/app/design-system.css",
      "./src/components/ficha/ficha.css",
      "./public/fonts/**",
      "./public/fonts-estaticas/**",
      "./public/ficha/**",
    ],
  },
};

export default nextConfig;
