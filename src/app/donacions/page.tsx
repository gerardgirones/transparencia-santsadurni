import type { Metadata } from "next";
import Link from "next/link";
import { GITHUB_SPONSORS_URL } from "@/config/constants";

export const metadata: Metadata = {
  title: "Donacions",
  description:
    "Com donar suport al manteniment del portal de transparència de Sant Sadurni d'Anoia.",
};

export default function DonacionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900">Donacions</h1>
      <p className="mt-2 text-sm text-gray-600">
        Aquest projecte es manté de forma independent. Les aportacions voluntàries ajuden a cobrir hosting,
        manteniment i millores de qualitat de dades.
      </p>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-semibold text-amber-900">Donació directa</h2>
        <p className="mt-2 text-sm text-amber-900">
          Pots donar suport al projecte mitjançant GitHub Sponsors. El procés de pagament es fa fora d&apos;aquest web,
          a la plataforma oficial de GitHub.
        </p>
        <a
          href={GITHUB_SPONSORS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          Donar via GitHub Sponsors
        </a>
      </section>

      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">A que es destina el suport</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Cost de desplegament i infraestructura.</li>
          <li>Millora de dades i revisions de qualitat (contractes, subvencions i retribucions).</li>
          <li>Desenvolupament de noves funcionalitats i manteniment continuat.</li>
        </ul>
      </section>

      <p className="mt-4 text-xs text-gray-500">
        Transparència: aquest web no processa pagaments directament. Si tens dubtes, pots escriure des de la pàgina de{" "}
        <Link href="/contacte" className="underline hover:text-gray-700">
          contacte
        </Link>
        .
      </p>
    </div>
  );
}
