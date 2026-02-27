import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/config/constants";

export const metadata: Metadata = {
  title: "Contacte",
  description:
    "Contacta amb el responsable del portal de transparència de Sant Sadurní d'Anoia.",
};

interface Props {
  searchParams: Promise<{ enviat?: string }>;
}

export default async function ContactePage({ searchParams }: Props) {
  const params = await searchParams;
  const sent = params.enviat === "1";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900">Contacte</h1>
      <p className="mt-2 text-sm text-gray-600">
        Si vols reportar errors, enviar suggeriments o compartir informació, fes-ho per aquest formulari.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        També tens disponibles els espais de{" "}
        <Link href="/comunitat" className="underline hover:text-gray-700">
          comunitat
        </Link>{" "}
        i{" "}
        <Link href="/donacions" className="underline hover:text-gray-700">
          donacions
        </Link>
        .
      </p>

      {sent ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Missatge enviat correctament. Gràcies!
        </div>
      ) : null}

      <form
        action="https://formsubmit.co/ggllopart1@gmail.com"
        method="POST"
        className="mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
      >
        <input type="hidden" name="_subject" value="Nou missatge des de transparenciasantsadurni.cat" />
        <input type="hidden" name="_captcha" value="true" />
        <input type="hidden" name="_template" value="table" />
        <input type="hidden" name="_next" value={`${SITE_URL}/contacte?enviat=1`} />

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
          <input
            name="nom"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="El teu nom"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Correu electrònic</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="tu@exemple.com"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Missatge</label>
          <textarea
            name="missatge"
            required
            rows={6}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Escriu el teu missatge..."
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Enviar missatge
        </button>
      </form>
    </div>
  );
}
