import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  GITHUB_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SOCRATA_DATASET_URL,
} from "@/config/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} - Transparència de Sant Sadurní d'Anoia`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [{ url: "/favicon-v3.png", type: "image/png" }],
    shortcut: [{ url: "/favicon-v3.png", type: "image/png" }],
    apple: [{ url: "/favicon-v3.png", type: "image/png" }],
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ca_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  other: {
    "twitter:domain": "transparenciasantsadurni.cat",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "ca-ES",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Transparència Sant Sadurní",
      url: SITE_URL,
      sameAs: [GITHUB_URL],
    },
    {
      "@type": "Dataset",
      "@id": `${SITE_URL}/#dataset-contractacio`,
      name: "Contractació pública i transparència de Sant Sadurní d'Anoia",
      description:
        "Dataset agregat per a consulta ciutadana de contractes, subvencions, organismes i indicadors de transparència municipal.",
      url: `${SITE_URL}/transparencia`,
      inLanguage: "ca-ES",
      isAccessibleForFree: true,
      creator: { "@id": `${SITE_URL}/#organization` },
      license: "https://creativecommons.org/licenses/by/4.0/",
      isBasedOn: [SOCRATA_DATASET_URL],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ca">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
