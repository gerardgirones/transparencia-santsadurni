import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPlenarySummary } from "@/lib/plenary";
import { loadData } from "@/lib/data-result";
import { formatDate } from "@/lib/utils";
import { safeHttpUrl } from "@/lib/review-rules";

export const metadata = {title:"Resum d’un ple municipal"};
export const maxDuration = 60;

export default async function PlenaryPage({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  if (!id || id.length > 120) notFound();
  const result = await loadData("resum d’una acta",() => fetchPlenarySummary(id));
  if (!result.unavailable && !result.data) notFound();
  const data = result.data;
  const original = safeHttpUrl(data?.minute.enllacActa);
  return <div className="mx-auto max-w-4xl px-4 py-8">
    <Link href="/plens" className="text-sm text-indigo-700 hover:underline">← Tots els plens</Link>
    <h1 className="mt-4 text-3xl font-bold text-gray-900">{data ? `Ple del ${formatDate(data.minute.dataAcord)}` : "Resum del ple"}</h1>
    {data && <p className="mt-2 text-gray-500">Sessió {data.minute.tipus?.toLowerCase() || "municipal"} · Ajuntament de Sant Sadurní d’Anoia</p>}
    <p className="my-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">Aquest resum recull títols i extractes del document, amb les votacions que s’han pogut identificar. Pot ometre punts, detalls o matisos; comprova sempre l’acta original.</p>
    {original && <a href={original} target="_blank" rel="noopener noreferrer" className="mb-6 inline-flex min-h-11 items-center rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white">Obrir l’acta oficial completa</a>}
    {!data?.summary?.points.length ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{result.unavailable || data?.unavailable ? "No s’ha pogut llegir aquest document ara mateix. Pots consultar l’acta original i tornar-ho a provar més tard." : "No s’han pogut identificar els punts de l’ordre del dia amb prou fiabilitat. El document pot estar escanejat o tenir un format diferent. Consulta l’acta original."}</p> : <>
      <p className="mb-5 text-sm text-gray-600">{data.summary.points.length} {data.summary.points.length === 1 ? "punt identificat" : "punts identificats"} en un document de {data.summary.pages} {data.summary.pages === 1 ? "pàgina" : "pàgines"}. Els números de DNI i NIE identificables s’ometen dels extractes.</p>
      <div className="space-y-5">{data.summary.points.map(point => <article key={point.number} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Punt {point.number} · pàgina {point.page}</p>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">{point.title}</h2>
        <div className="mt-3 space-y-1 text-sm text-gray-700"><p><span className="font-medium">Votació: </span>{point.outcome || "No identificada automàticament"}</p>{point.votes && <p>{point.votes}</p>}</div>
        {point.excerpt && <div className="mt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Extracte del text de l’acta</p><blockquote className="border-l-2 border-indigo-200 pl-4 text-sm leading-relaxed text-gray-700">{point.excerpt}</blockquote></div>}
        {original && <div className="mt-4 flex flex-wrap gap-4 text-sm"><a href={`${original}#page=${point.page}`} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">Veure el punt a l’acta · pàg. {point.page}</a>{point.excerptPage && point.excerptPage !== point.page && <a href={`${original}#page=${point.excerptPage}`} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">Veure l’extracte · pàg. {point.excerptPage}</a>}</div>}
      </article>)}</div>
    </>}
  </div>;
}
