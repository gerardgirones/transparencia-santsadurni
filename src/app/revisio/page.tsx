import type { Metadata } from "next";
import Link from "next/link";
import { fetchReviewReport } from "@/lib/review";
import { formatDate, formatCurrencyFull, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {title:"Revisió ciutadana",description:"Comprovacions de qualitat i patrons per revisar en els contractes de l’Ajuntament i les concessions municipals de la BDNS."};
const PAGE_SIZE = 20;

export default async function ReviewPage({searchParams}:{searchParams:Promise<{section?:string;kind?:string;year?:string;page?:string}>}) {
  const params = await searchParams;
  const report = await fetchReviewReport();
  const section = ["contractes","subvencions"].includes(params.section ?? "") ? params.section! : "";
  const kind = ["qualitat","revisio"].includes(params.kind ?? "") ? params.kind! : "";
  const years = [...new Set(report.findings.flatMap(row => row.evidence.map(item => item.date?.slice(0,4)).filter((year): year is string => Boolean(year))))].sort().reverse();
  const year = years.includes(params.year ?? "") ? params.year! : "";
  const filtered = report.findings.filter(row => (!section || row.section === section) && (!kind || row.kind === kind) && (!year || row.evidence.some(item => item.date?.startsWith(year))));
  const pages = Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const page = Math.min(pages,Math.max(1,Number.parseInt(params.page ?? "1",10) || 1));
  const pageLink = (number:number) => `/revisio?${new URLSearchParams({section,kind,year,page:String(number)})}`;
  const selectClass = "mt-1 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm";
  return <div className="mx-auto max-w-6xl px-4 py-8">
    <h1 className="text-3xl font-bold text-gray-900">Revisió ciutadana</h1>
    <p className="mt-3 max-w-3xl text-gray-600">Comprovacions dels registres publicats de l’Ajuntament de Sant Sadurní d’Anoia i les seves concessions de subvencions. Cada avís explica què s’ha detectat i què cal comprovar.</p>
    <div className="my-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Un avís ajuda a prioritzar una revisió. No acredita una irregularitat, un pagament duplicat ni una mala praxi. L’absència d’avisos tampoc certifica que un expedient sigui correcte.</div>
    <div className="my-6 grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-sm font-semibold text-gray-600">Registres de contractació consultats</h2><p className="mt-2 text-3xl font-bold text-gray-900">{report.contracts.total === null ? "No disponible" : formatNumber(report.contracts.total)}</p><p className="mt-2 text-sm text-gray-500">Només l’Ajuntament; inclou registres incomplets i fases de publicació.</p>{report.contracts.latest && <p className="mt-1 text-xs text-gray-500">Darrera data d’adjudicació publicada: {formatDate(report.contracts.latest)}</p>}</section>
      <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="text-sm font-semibold text-gray-600">Concessions BDNS consultades</h2><p className="mt-2 text-3xl font-bold text-gray-900">{report.grants.total === null ? "No disponible" : formatNumber(report.grants.total)}</p><p className="mt-2 text-sm text-gray-500">Concessions de l’òrgan municipal 413. Les convocatòries són una informació diferent.</p>{report.grants.latest && <p className="mt-1 text-xs text-gray-500">Darrera data de concessió publicada: {formatDate(report.grants.latest)}</p>}</section>
    </div>
    {(report.contracts.unavailable || report.grants.unavailable) && <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Revisió parcial: no s’ha pogut carregar el catàleg complet de {report.contracts.unavailable ? "contractes" : ""}{report.contracts.unavailable && report.grants.unavailable ? " i " : ""}{report.grants.unavailable ? "concessions" : ""}. No s’han generat avisos ni totals a partir d’una descàrrega incompleta.</p>}
    <form action="/revisio" className="mb-6 grid items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4">
      <label className="text-sm font-medium text-gray-700">Dades<select aria-label="Dades" name="section" defaultValue={section} className={selectClass}><option value="">Totes</option><option value="contractes">Contractes</option><option value="subvencions">Subvencions</option></select></label>
      <label className="text-sm font-medium text-gray-700">Tipus d’avís<select aria-label="Tipus d’avís" name="kind" defaultValue={kind} className={selectClass}><option value="">Tots</option><option value="qualitat">Qualitat de dades</option><option value="revisio">Patrons per revisar</option></select></label>
      <label className="text-sm font-medium text-gray-700">Any dels avisos<select aria-label="Any dels avisos" name="year" defaultValue={year} className={selectClass}><option value="">Tots</option>{years.map(value => <option key={value}>{value}</option>)}</select></label>
      <button className="min-h-11 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white">Filtra avisos</button>
    </form>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm"><p className="text-gray-600">{formatNumber(filtered.length)} {filtered.length === 1 ? "avís" : "avisos"} · un mateix registre pot tenir diversos avisos</p><Link href="/revisio/metodologia" className="font-medium text-indigo-700 underline">Com es fa aquesta revisió?</Link></div>
    {!filtered.length && <p className="rounded-xl border border-gray-200 p-6 text-gray-600">No hi ha avisos per a les dades disponibles i els filtres seleccionats. Això no és una certificació dels expedients.</p>}
    <div className="space-y-4">{filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(finding => <article key={finding.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">{finding.section === "contractes" ? "Contractes" : "Subvencions"}</span><span className={`rounded-full px-3 py-1 ${finding.kind === "qualitat" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-900"}`}>{finding.kind === "qualitat" ? "Qualitat de dades" : "Patró per revisar"}</span></div>
      <h2 className="mt-3 text-lg font-semibold text-gray-900">{finding.title}</h2><p className="mt-2 text-sm text-gray-700">{finding.reason}</p><p className="mt-2 text-sm text-gray-500">{finding.limitation}</p>
      <details className="mt-4 rounded-lg border border-gray-100"><summary className="cursor-pointer px-4 py-3 text-sm font-medium text-indigo-700">Veure {finding.evidence.length === 1 ? "el registre" : `els ${finding.evidence.length} registres`} i les fonts</summary><ul className="max-h-96 space-y-3 overflow-y-auto border-t border-gray-100 p-4">{finding.evidence.map(item => <li key={item.id} className="rounded-lg bg-gray-50 p-3 text-sm"><p className="font-medium text-gray-900">{item.title}</p><p className="mt-1 text-gray-600">{item.beneficiary} · {item.date ? formatDate(item.date) : "Data no disponible"} · {item.amount === null ? "Import no interpretable" : formatCurrencyFull(item.amount)}{finding.section === "contractes" ? " sense IVA" : " concedits"}</p><p className="mt-2 flex flex-wrap gap-4"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">{finding.section === "contractes" ? "Registre a la font oficial" : "Convocatòria o cercador BDNS"}</a>{item.publicationUrl && <a href={item.publicationUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">{finding.section === "contractes" ? "Publicació de l’expedient" : "Bases reguladores"}</a>}</p><p className="mt-1 break-all text-xs text-gray-500">Identificador del registre: {item.id}</p></li>)}</ul></details>
    </article>)}</div>
    {pages > 1 && <nav aria-label="Paginació dels avisos" className="mt-6 flex items-center justify-between gap-3 text-sm">{page > 1 ? <Link href={pageLink(page-1)} className="rounded-lg border px-4 py-3">← Anterior</Link> : <span />}<span>Pàgina {page} de {pages}</span>{page < pages ? <Link href={pageLink(page+1)} className="rounded-lg border px-4 py-3">Següent →</Link> : <span />}</nav>}
    <p className="mt-8 text-xs text-gray-500">Consulta: {new Date(report.checkedAt).toLocaleString("ca-ES",{timeZone:"Europe/Berlin"})} · Regles {report.version} · Les fonts es poden conservar en memòria cau fins a 6 hores. Només s’analitzen les dades publicades, sense accés a factures, justificacions o pagaments interns.</p>
  </div>;
}
