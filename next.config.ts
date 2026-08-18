import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El bundle de Chromium para el PDF (M4) no debe empaquetarse por webpack.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
