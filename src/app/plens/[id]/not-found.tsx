import Link from "next/link";
export default function NotFound() {
  return <div className="mx-auto max-w-4xl px-4 py-12"><h1 className="text-3xl font-bold text-gray-900">Acta no trobada</h1><p className="mt-3 text-gray-600">Aquest identificador no consta al catàleg d’actes de l’Ajuntament.</p><Link href="/plens" className="mt-5 inline-block text-indigo-700 underline">Tornar als resums dels plens</Link></div>;
}
