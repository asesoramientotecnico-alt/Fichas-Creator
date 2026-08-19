import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El bundle de Chromium no debe pasar por webpack.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],

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
