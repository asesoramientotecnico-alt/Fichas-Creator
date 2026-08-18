import type { Metadata } from "next";
import "./design-system.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fichas Técnicas — FAMIQ",
  description: "Carga y corrección de fichas técnicas de producto.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
