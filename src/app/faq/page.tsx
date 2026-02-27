import type { Metadata } from "next";
import { SITE_URL } from "@/config/constants";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Preguntes freqüents sobre les dades de contractació pública i transparència de Sant Sadurní d'Anoia.",
  alternates: {
    canonical: "/faq",
  },
};

const faqItems = [
  {
    question: "D'on surten les dades que es mostren al portal?",
    answer:
      "Les dades provenen de fonts públiques oficials (PSCP, portals de transparència i dades obertes) i es processen per facilitar-ne la consulta ciutadana.",
  },
  {
    question: "Aquest web és oficial de l'Ajuntament?",
    answer:
      "No. És un projecte independent de transparència ciutadana i visualització de dades públiques.",
  },
  {
    question: "Cada quan s'actualitzen les dades?",
    answer:
      "El portal es revalida periòdicament i mostra dades recents segons la disponibilitat de les fonts oficials.",
  },
  {
    question: "Per què alguns imports poden diferir de la font original?",
    answer:
      "Algunes fonts publiquen formats diferents (amb/sense IVA, camps buits o valors múltiples). El portal aplica normalitzacions per fer comparables els resultats.",
  },
  {
    question: "Com puc reportar una errada o proposar una millora?",
    answer:
      "Pots utilitzar la pàgina de contacte o obrir una incidència al repositori del projecte.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      <h1 className="text-3xl font-bold text-gray-900">Preguntes freqüents (FAQ)</h1>
      <p className="mt-2 text-sm text-gray-600">
        Respostes ràpides sobre com funciona {" "}
        <span className="font-medium">transparenciasantsadurni.cat</span> i com interpretar les dades.
      </p>

      <div className="mt-6 space-y-4">
        {faqItems.map((item) => (
          <section key={item.question} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">{item.question}</h2>
            <p className="mt-2 text-sm text-gray-700">{item.answer}</p>
          </section>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        URL canònica: {SITE_URL}/faq
      </p>
    </div>
  );
}
