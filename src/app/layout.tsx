import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import GoogleAnalytics from "@/components/GoogleAnalytics";
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
  metadataBase: new URL("https://www.forcom.tech"),
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "Gv2AOjMUawqkDGaBRkUhprJs7cFBHPLvhVOwFyO5r5E",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://www.forcom.tech",
    siteName: "FORCOM",
    title: "FORCOM — Tecnología que entiende su negocio",
    description:
      "Soluciones de punto de venta, hardware y tecnología retail para supermercados, restaurantes, farmacias, logística y más.",
    images: [
      {
        url: "/images/brand/forcom-logo.png",
        width: 1200,
        height: 630,
        alt: "FORCOM",
      },
    ],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FORCOM",
  url: "https://www.forcom.tech",
  logo: "https://www.forcom.tech/images/brand/forcom-logo.png",
  description:
    "Distribuidor de hardware POS y tecnología retail para comercios y empresas en Argentina.",
  areaServed: "AR",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    areaServed: "AR",
    availableLanguage: "Spanish",
  },
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="noise-overlay min-h-full flex flex-col">
        {children}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
