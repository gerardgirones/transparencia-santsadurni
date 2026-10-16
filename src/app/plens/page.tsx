import type { Metadata } from "next";
import Link from "next/link";
import { fetchPlenaryCatalog } from "@/lib/transparency";
import { loadData } from "@/lib/data-result";
import { formatDate, formatNumber } from "@/lib/utils";
import { OFFICIAL_SOURCES } from "@/config/constants";

export const metadata: Metadata = {title:"Resums dels plens",description:"Punts tractats i extractes de les actes del Ple de Sant Sadurní d’Anoia, amb referències al document oficial."};
const PAGE_SIZE = 18;

export default async function PlensPage({searchParams}:{searchParams:Promise<{year?:string;page?:string}>}) {
  const params = await searchParams;
  const result = await loadData("catàleg d’actes de ple",fetchPlenaryCatalog);
  const catalog = result.data ?? [];
  const years = [...new Set(catalog.map(row => row.dataAcord.slice(0,4)))].filter(year => /^\d{4}$/.test(year)).sort().reverse();
  const year = years.includes(params.year ?? "") ? params.year! : "";
  const filtered = catalog.filter(row => !year || row.dataAcord.startsWith(year));
  const totalPages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const page = Math.min(totalPages,Math.max(1,Number.parseInt(params.page || "1",10) || 1));
  const rows = filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const pageLink = (number:number) => `/plens?${new URLSearchParams({...year ? {year} : {},page:String(number)})}`;
  return <div className="mx-auto max-w-6xl px-4 py-8">
    <h1 className="text-3xl font-bold text-gray-900">Resums dels plens</h1>
    <p className="mt-3 max-w-3xl text-gray-600">Consulta els temes tractats, les votacions que consten a l’acta i extractes dels acords. Cada punt enllaça amb la pàgina del document original.</p>
    <p className="mt-3 text-sm text-gray-500">Els resums s’extreuen automàticament del text i poden ometre matisos. No substitueixen l’acta ni el vídeo de la sessió.</p>
    <div className="my-6 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <form action="/plens" className="flex items-end gap-3">
        <label className="text-sm font-medium text-gray-700">Any de la sessió<select aria-label="Any de la sessió" name="year" defaultValue={year} className="mt-1 block min-h-11 rounded-lg border border-gray-300 bg-white px-3"><option value="">Tots els anys</option>{years.map(value => <option key={value}>{value}</option>)}</select></label>
        <button className="min-h-11 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white">Filtra</button>
      </form>
      <p className="text-sm text-gray-600">{result.unavailable ? "Catàleg no disponible" : `${formatNumber(filtered.length)} actes publicades`}</p>
    </div>
    {result.unavailable ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">No s’ha pogut consultar el catàleg. Torna-ho a provar o consulta la <a href={OFFICIAL_SOURCES.plenaryMinutes} className="underline">font oficial</a>.</p> : <>
      {catalog[0] && <p className="mb-5 text-sm text-gray-500">Data de sessió més recent al catàleg: {formatDate(catalog[0].dataAcord)}. Pot haver-hi sessions posteriors pendents de publicació en aquesta font.</p>}
      {!rows.length && <p className="py-8 text-gray-600">No hi ha actes publicades per a aquesta selecció.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row,index) => <article key={row.codiActa || `${row.dataAcord}-${index}`} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Ple municipal · {row.tipus || "Tipus no informat"}</p>
        <h2 className="mt-2 text-xl font-semibold text-gray-900">{formatDate(row.dataAcord)}</h2>
        <p className="mt-2 flex-1 text-sm text-gray-500">Acta oficial de l’Ajuntament de Sant Sadurní d’Anoia.</p>
        {row.codiActa && <Link prefetch={false} href={`/plens/${encodeURIComponent(row.codiActa)}`} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-700 px-3 text-sm font-semibold text-white hover:bg-indigo-800">Llegir resum</Link>}
      </article>)}</div>
      {totalPages > 1 && <nav aria-label="Paginació dels plens" className="mt-6 flex items-center justify-between gap-3 text-sm">
        {page > 1 ? <Link href={pageLink(page-1)} className="rounded-lg border px-4 py-3">← Anterior</Link> : <span />}
        <span>Pàgina {page} de {totalPages}</span>
        {page < totalPages ? <Link href={pageLink(page+1)} className="rounded-lg border px-4 py-3">Següent →</Link> : <span />}
      </nav>}
    </>}
    <a href={OFFICIAL_SOURCES.plenaryMinutes} target="_blank" rel="noopener noreferrer" className="mt-8 inline-block text-sm text-indigo-700 underline">Consultar totes les actes a la seu electrònica</a>
  </div>;
}
