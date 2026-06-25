import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FORCOM — Tecnología que entiende su negocio",
  description:
    "Soluciones de punto de venta, hardware y tecnología retail para supermercados, restaurantes, farmacias, logística y más. Terminales POS, impresoras térmicas, lectores de código de barras y accesorios de grado empresarial.",
  keywords: [
    "POS",
    "punto de venta",
    "terminal POS",
    "impresora térmica",
    "lector de código de barras",
    "tecnología retail",
    "hardware comercial",
    "FORCOM",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${barlowCondensed.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="noise-overlay min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
