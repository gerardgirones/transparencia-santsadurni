import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Comunitat",
  description: "Espai de comunitat del portal amb xat obert entre visitants.",
};

export default function ComunitatPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900">Comunitat (xat)</h1>
      <p className="mt-2 text-sm text-gray-600">
        Aquesta pàgina centralitza el xat públic perquè la gent que entra al web pugui conversar entre si.
      </p>

      <section className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/70 p-5">
        <h2 className="text-lg font-semibold text-emerald-900">Canal de xat</h2>
        <p className="mt-2 text-sm text-emerald-900/90">
          Xat en directe i gratuït perquè la gent que entra al web pugui conversar entre si.
        </p>
        <div className="mt-3 overflow-hidden rounded-md border border-emerald-200 bg-white">
          <iframe
            src="https://tlk.io/transparencia-santsadurni"
            title="Xat públic de transparència Sant Sadurní"
            className="h-[460px] w-full"
          />
        </div>
        <p className="mt-2 text-xs text-emerald-900/80">
          Si prefereixes contacte directe amb el mantenidor, utilitza la pàgina de{" "}
          <Link href="/contacte" className="underline hover:text-emerald-900">
            contacte
          </Link>
          .
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Normes bàsiques</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Respecte entre participants i debat centrat en dades verificables.</li>
          <li>No compartir dades personals de tercers ni informació sensible.</li>
          <li>Les propostes han d&apos;incloure font o context per facilitar-ne la validació.</li>
        </ul>
      </section>
    </div>
  );
}
