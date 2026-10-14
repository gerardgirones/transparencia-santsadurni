import Link from "next/link";
import { BDNS_PORTAL_URL, MUNICIPAL_SCOPE_ORGAN } from "@/config/constants";
import { fetchSubsidyCalls, resolveSubsidyCallFilters, type SubsidyCallFilters } from "@/lib/bdns";
import { loadData } from "@/lib/data-result";
import { formatCurrencyFull, formatDate, formatNumber } from "@/lib/utils";

export default async function SubsidyCallsExplorer({ filters }: { filters: SubsidyCallFilters }) {
  const selected = resolveSubsidyCallFilters(filters);
  const result = await loadData("convocatòries BDNS", () => fetchSubsidyCalls({ ...selected, year: String(selected.year) }));
  const listing = result.data;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2016 + 1 }, (_, index) => currentYear - index);
  const pageUrl = (page: number) => `/subvencions?${new URLSearchParams({
    view: "convocatories", year: String(selected.year), search: selected.search, page: String(page),
  })}`;

  return (
    <section aria-labelledby="calls-heading">
      <h2 id="calls-heading" className="mb-2 text-xl font-semibold text-gray-900">Convocatòries registrades el {selected.year}</h2>
      <p className="mb-5 text-sm text-gray-600">
        Convocatòries de l’{MUNICIPAL_SCOPE_ORGAN} publicades a la BDNS. Els imports són pressupostos previstos,
        no imports concedits. La data és la de registre a la BDNS, i no indica que el termini de sol·licitud estigui obert.
      </p>

      <form action="/subvencions" className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <input type="hidden" name="view" value="convocatories" />
        <label className="text-sm text-gray-700">
          Any de registre
          <select name="year" defaultValue={String(selected.year)} className="mt-1 block rounded-md border border-gray-300 bg-white px-3 py-2">
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="min-w-48 flex-1 text-sm text-gray-700">
          Cerca al títol
          <input name="search" defaultValue={selected.search} maxLength={200} placeholder="Ex. cultura, esport, Noia…" className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2" />
        </label>
        <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">Aplicar filtres</button>
      </form>

      {listing ? (
        <>
          <p className="mb-4 text-sm text-gray-600">{formatNumber(listing.total)} {listing.total === 1 ? "convocatòria trobada" : "convocatòries trobades"} · Font: BDNS · Actualització de la consulta cada sis hores.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {listing.data.map((call) => (
              <article key={call.code} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs text-gray-500">Registre: {formatDate(call.registeredAt)} · BDNS {call.code}</p>
                <h3 className="text-base font-semibold text-gray-900"><a href={call.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{call.title}</a></h3>
                {call.procedure && <p className="mt-2 text-xs text-gray-600">{call.procedure}</p>}
                <p className="mt-3 text-sm text-gray-700">Pressupost de la convocatòria: <span className="font-mono font-medium">{call.budget !== null ? formatCurrencyFull(call.budget) : "No disponible"}</span></p>
                {call.detailUnavailable && <p className="mt-1 text-xs text-amber-800">No s’ha pogut carregar el detall; consulta la fitxa oficial.</p>}
                <a href={call.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-indigo-700 underline">Veure fitxa, documents i terminis a la BDNS</a>
              </article>
            ))}
          </div>
          {listing.data.length === 0 && <p className="rounded-lg border border-gray-200 p-5 text-sm text-gray-600">No hi ha convocatòries publicades per a aquesta consulta.</p>}
          {(listing.page > 1 || listing.page * listing.pageSize < listing.total) && (
            <nav aria-label="Paginació de convocatòries" className="mt-5 flex items-center justify-between gap-3 text-sm">
              <span>Pàgina {listing.page} de {Math.max(1, Math.ceil(listing.total / listing.pageSize))}</span>
              <div className="flex gap-4">
                {listing.page > 1 && <Link href={pageUrl(listing.page - 1)} className="underline">Anterior</Link>}
                {listing.page * listing.pageSize < listing.total && <Link href={pageUrl(listing.page + 1)} className="underline">Següent</Link>}
              </div>
            </nav>
          )}
        </>
      ) : (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No s’han pogut carregar les convocatòries de la BDNS. Torna-ho a provar més tard o consulta el portal oficial.
        </div>
      )}
      <p className="mt-5 text-sm text-gray-600"><a href={`${BDNS_PORTAL_URL}/convocatorias`} target="_blank" rel="noopener noreferrer" className="underline">Obrir el cercador oficial de convocatòries</a></p>
    </section>
  );
}
