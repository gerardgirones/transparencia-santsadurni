import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchReviewCase } from "@/lib/review-case";
import { formatDate, formatCurrencyFull } from "@/lib/utils";

export const metadata = {title:"Fitxa de revisió ciutadana",robots:{index:false,follow:true}};
const linkClass = "text-indigo-700 underline underline-offset-2";
const checkLabels = {coincideix:"Coincideix",difereix:"Difereix","no-comparable":"No comparable"};
const statusLabels = {contrastada:"Publicació contrastada","no-localitzat":"Entrada no localitzada",ambigu:"Identificació ambigua","no-compatible":"Consulta manual","no-disponible":"Contrast no disponible"};

export default async function ReviewCasePage({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const data = await fetchReviewCase(id);
  if (!data || data.status === "missing") notFound();
  if (data.status !== "found") return <div className="mx-auto max-w-3xl px-4 py-8"><Link href="/revisio" className={linkClass}>← Revisió ciutadana</Link><h1 className="mt-5 text-3xl font-bold">Fitxa temporalment no disponible</h1><p role="status" className="mt-4 text-gray-600">No s’ha pogut carregar el catàleg necessari per trobar aquest avís. Torna-ho a provar més endavant; això no indica que el cas hagi quedat resolt.</p></div>;
  const {finding} = data;
  return <div className="mx-auto max-w-5xl px-4 py-8">
    <Link href="/revisio" className={`text-sm ${linkClass}`}>← Revisió ciutadana</Link>
    <p className="mt-6 text-sm font-semibold text-indigo-700">Fitxa de contrast · {finding.section === "contractes" ? "Contractes" : "Subvencions"}</p>
    <h1 className="mt-2 text-3xl font-bold text-gray-900">{finding.title}</h1>
    <p className="mt-4 text-gray-700">{finding.reason}</p><p className="mt-2 text-sm text-gray-600">{finding.limitation}</p>
    <p className="my-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Aquest contrast compara el catàleg amb la publicació oficial, que poden compartir origen. Una coincidència confirma què s’hi publica; no valida l’expedient, la justificació ni els pagaments. Una diferència pot ser una esmena o un desfasament entre les fonts.</p>
    <div className="mb-7 flex flex-wrap gap-4 text-sm"><a href={`/api/revisio/${encodeURIComponent(finding.id)}`} download="fitxa-revisio.txt" className="rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white">Descarrega la fitxa</a><Link href="/revisio/metodologia" className={`self-center ${linkClass}`}>Metodologia i límits</Link></div>
    <section aria-labelledby="case-records"><h2 id="case-records" className="text-xl font-bold text-gray-900">Registres que originen l’avís</h2><ul className="mt-4 space-y-3">{finding.evidence.map(item=><li key={item.id} className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="font-semibold text-gray-900">{item.title}</h3><p className="mt-2 text-sm text-gray-600">{item.beneficiary} · {item.date ? formatDate(item.date) : "Data no informada"} · {item.amount === null ? "Import no interpretable" : formatCurrencyFull(item.amount)}{finding.section === "contractes" ? " sense IVA" : " concedits"}</p>
      <p className="mt-3 flex flex-wrap gap-4 text-sm"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>{finding.section === "contractes" ? "Registre del catàleg" : "Convocatòria o cercador BDNS"}</a>{item.publicationUrl && <a href={item.publicationUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>{finding.section === "contractes" ? "Publicació original" : "Bases reguladores publicades"}</a>}</p><p className="mt-2 break-all text-xs text-gray-500">Identificador: {item.id}</p>
    </li>)}</ul></section>
    <section aria-labelledby="case-documents" className="mt-9"><h2 id="case-documents" className="text-xl font-bold text-gray-900">Què s’ha pogut contrastar?</h2><p className="mt-2 text-sm text-gray-600">El contrast s’executa en obrir aquesta fitxa. Els camps absents es mostren com a no comparables i els formats no reconeguts queden pendents de lectura manual.</p>
      <div className="mt-4 space-y-4">{data.documents.map(document=><article key={document.id} className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-words font-semibold text-gray-900">Expedient {document.expedient}</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${document.status === "contrastada" ? "bg-indigo-50 text-indigo-800" : "bg-gray-100 text-gray-700"}`}>{statusLabels[document.status]}</span></div>
        <p className="mt-3 text-sm text-gray-600">{document.message}</p>
        {document.title && <p className="mt-2 text-sm text-gray-500">Publicació: {document.title}{document.publishedAt ? ` · ${formatDate(document.publishedAt)}` : ""}</p>}
        {document.sourceUrl && <a href={document.sourceUrl} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-block text-sm ${linkClass}`}>Dades originals de la publicació PSCP</a>}
        {document.checks.length > 0 && <dl className="mt-4 divide-y divide-gray-100">{document.checks.map(check=><div key={check.label} className="py-3">
          <dt className="flex flex-wrap justify-between gap-2 text-sm font-semibold text-gray-800"><span>{check.label}</span><span className={check.status === "difereix" ? "text-amber-800" : "text-gray-500"}>{checkLabels[check.status]}</span></dt>
          <dd className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><p className="min-w-0 break-words rounded-lg bg-gray-50 p-3"><span className="block text-xs text-gray-500">Catàleg</span>{check.catalog ?? "No informat o no interpretable"}</p><p className="min-w-0 break-words rounded-lg bg-gray-50 p-3"><span className="block text-xs text-gray-500">Publicació PSCP</span>{check.publication ?? "No informat o no interpretable"}</p></dd>
        </div>)}</dl>}
      </article>)}
      {data.calls.map((call,index)=><article key={index} className="rounded-xl border border-gray-200 bg-white p-5"><h3 className="font-semibold text-gray-900">{call.title ?? "Context de la convocatòria BDNS"}</h3><p className="mt-3 text-sm text-gray-600">{call.message}</p>{call.status === "context" && <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">Pressupost de la convocatòria</dt><dd className="mt-1 font-semibold">{call.budget === null ? "No informat" : formatCurrencyFull(call.budget)}</dd></div><div><dt className="text-gray-500">Procediment publicat</dt><dd className="mt-1">{call.procedure ?? "No informat"}</dd></div></dl>}<p className="mt-3 text-xs text-gray-500">El pressupost d’una convocatòria no és un import concedit ni pagat. La resolució de les concessions continua pendent de lectura.</p><p className="mt-3 flex flex-wrap gap-4 text-sm">{call.sourceUrl && <a href={call.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>Detall oficial BDNS</a>}{call.basesUrl && <a href={call.basesUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>Bases indicades a la convocatòria</a>}</p></article>)}
      {data.omittedCalls > 0 && <p className="text-sm text-gray-600">{data.omittedCalls} convocatòries pendents de consulta: s’ha assolit el límit de quatre per visita.</p>}
      </div>
    </section>
    {data.timeline.length > 0 && <section className="mt-9" aria-labelledby="case-timeline"><h2 id="case-timeline" className="text-xl font-bold text-gray-900">Publicacions dels expedients</h2><p className="mt-2 text-sm text-gray-600">Registres del catàleg amb els mateixos codis d’expedient. Poden ser lots, fases o esmenes; no se’n sumen els imports.</p><ul className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-gray-200 p-4">{data.timeline.map(item=><li key={item.id} className="border-l-2 border-indigo-100 pl-3 text-sm"><p className="font-medium text-gray-800">{item.expedient} · {item.phase}</p><p className="mt-1 text-gray-500">{item.date ? formatDate(item.date) : "Data no informada"} · Lot {item.lot ?? "no informat"}</p>{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className={linkClass}>Consulta aquesta publicació</a>}</li>)}</ul></section>}
    <section className="mt-9 rounded-xl bg-gray-50 p-5" aria-labelledby="case-next"><h2 id="case-next" className="text-xl font-bold text-gray-900">Què cal comprovar abans de concloure?</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-gray-700">{data.questions.map(question=><li key={question}>{question}</li>)}</ol><p className="mt-4 text-sm text-gray-600">Si el document necessari no es pot consultar al portal oficial, la fitxa descarregable permet concretar els expedients i els aclariments que es volen demanar a l’Ajuntament.</p></section>
    <p className="mt-8 break-words text-xs text-gray-500">Consulta: {new Date(data.checkedAt).toLocaleString("ca-ES",{timeZone:"Europe/Berlin"})} · Regles {data.rulesVersion} · Contrast {data.documentVersion}. Les fonts poden estar en memòria cau fins a sis hores. No s’han consultat factures, justificacions ni pagaments interns.</p>
  </div>;
}
