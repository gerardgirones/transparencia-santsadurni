import Link from "next/link";
export default function CaseNotFound() {
  return <div className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl font-bold text-gray-900">Avís no disponible</h1><p className="mt-4 text-gray-600">Aquest identificador no apareix a la revisió actual. Les dades o els criteris poden haver canviat; això no acredita que l’expedient estigui resolt.</p><Link href="/revisio" className="mt-5 inline-block text-indigo-700 underline">Torna a la revisió ciutadana</Link></div>;
}
