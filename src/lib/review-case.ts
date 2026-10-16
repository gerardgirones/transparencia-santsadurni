import { cache } from "react";
import { REVALIDATE_SECONDS, BDNS_API_URL } from "@/config/constants";
import { buildReviewReport, fetchReviewSources } from "@/lib/review";
import { safeHttpUrl } from "@/lib/review-rules";
import { bdnsCallCode, comparePscpPublication, documentKey, pscpPublicationSource, unavailablePublication, reviewCaseId, reviewQuestions, DOCUMENT_REVIEW_VERSION } from "@/lib/review-document";

// Bounded reads, no redirects, and fixed official endpoints. Publication
// responses may contain many other contracts; they never reach the client.
export async function readReviewJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url,{redirect:"error",signal,next:{revalidate:REVALIDATE_SECONDS}});
  const max = 5 * 1024 * 1024;
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > max) throw new Error("Publication unavailable or too large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > max) throw new Error("Publication exceeds limit");
      chunks.push(part.value);
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const readPublication = cache(readReviewJson);

async function callContext(callUrl: string | null, signal: AbortSignal) {
  const code = bdnsCallCode(callUrl);
  if (!code) return {status:"no-compatible" as const,sourceUrl:null,title:null,budget:null,procedure:null,basesUrl:null,message:"No hi ha un codi de convocatòria BDNS verificable en aquest registre."};
  const url = new URL(`${BDNS_API_URL}/convocatorias`);
  url.searchParams.set("vpd","GE");url.searchParams.set("numConv",code);
  try {
    const data = await readPublication(url.href,signal) as {codigoBDNS?:unknown;organo?:{nivel2?:string;nivel3?:string};descripcionLeng?:string;descripcion?:string;presupuestoTotal?:number;tipoConvocatoria?:string;urlBasesReguladoras?:string};
    if (String(data.codigoBDNS) !== code || documentKey(data.organo?.nivel2) !== documentKey("SANT SADURNÍ D'ANOIA") || documentKey(data.organo?.nivel3) !== documentKey("AYUNTAMIENTO DE SANT SADURNÍ D'ANOIA")) throw new Error("Call identity mismatch");
    return {status:"context" as const,sourceUrl:url.href,title:typeof data.descripcionLeng === "string" ? data.descripcionLeng : typeof data.descripcion === "string" ? data.descripcion : null,
      budget:typeof data.presupuestoTotal === "number" && Number.isFinite(data.presupuestoTotal) && data.presupuestoTotal >= 0 ? data.presupuestoTotal : null,
      procedure:typeof data.tipoConvocatoria === "string" ? data.tipoConvocatoria : null,basesUrl:safeHttpUrl(data.urlBasesReguladoras),
      message:"S’ha consultat la convocatòria municipal. Aquest context no contrasta la resolució de cada concessió ni acredita el cobrament."};
  } catch { return {status:"no-disponible" as const,sourceUrl:url.href,title:null,budget:null,procedure:null,basesUrl:null,message:"No s’ha pogut verificar el detall de la convocatòria. La concessió continua pendent de contrast amb la seva resolució."}; }
}

export const fetchReviewCase = cache(async (id: string) => {
  const canonicalId = reviewCaseId(id);
  if (canonicalId === null) return null;
  const sources = await fetchReviewSources();
  const report = buildReviewReport(sources);
  const finding = report.findings.find(item => item.id === canonicalId);
  if (!finding) return {status:report.contracts.unavailable || report.grants.unavailable ? "unavailable" as const : "missing" as const};
  const signal = AbortSignal.timeout(15000);
  const affected = new Set(finding.evidence.map(item=>item.id));
  const rows = finding.section === "contractes" ? sources.contracts.data?.filter(row=>affected.has(row.source_row_id)) ?? [] : [];
  // At most four distinct publications per visit, shared by rows in the case.
  const urls = [...new Set(rows.map(row=>pscpPublicationSource(typeof row.enllac_publicacio === "object" ? row.enllac_publicacio?.url : row.enllac_publicacio)?.url).filter((url):url is string=>Boolean(url)))];
  const publications = new Map(await Promise.all(urls.slice(0,4).map(async url=>{
    try { return [url,await readPublication(url,signal)] as const; } catch { return [url,null] as const; }
  })));
  const documents = rows.map(row=>{
    const source = pscpPublicationSource(typeof row.enllac_publicacio === "object" ? row.enllac_publicacio?.url : row.enllac_publicacio);
    const result = !source ? {...unavailablePublication("Aquest enllaç no correspon a un format admès per al contrast automàtic. Consulta la font original."),status:"no-compatible" as const}
      : !publications.has(source.url) ? unavailablePublication("No consultada: s’ha assolit el límit de quatre publicacions per visita.",source.url)
      : !publications.get(source.url) ? unavailablePublication("La publicació no s’ha pogut llegir en un format compatible. Consulta l’original; això no acredita una manca de publicació.",source.url)
      : comparePscpPublication(row,publications.get(source.url),source);
    return {id:row.source_row_id,expedient:row.codi_expedient || "No informat",...result};
  });
  const grantRows = finding.section === "subvencions" ? sources.grants.data?.filter(row=>affected.has(row.id)) ?? [] : [];
  const callUrls = [...new Set(grantRows.map(row=>row.callUrl))];
  const calls = await Promise.all(callUrls.slice(0,4).map(url=>callContext(url,signal)));
  const expedients = new Set(rows.map(row=>documentKey(row.codi_expedient)).filter(Boolean));
  const timeline = (sources.contracts.data ?? []).filter(row=>expedients.has(documentKey(row.codi_expedient))).map(row=>({
    id:row.source_row_id,expedient:row.codi_expedient || "No informat",lot:row.numero_lot || null,phase:row.fase_publicacio || "Fase no informada",date:row.data_publicacio_anunci || null,
    url:safeHttpUrl(typeof row.enllac_publicacio === "object" ? row.enllac_publicacio?.url : row.enllac_publicacio),
  })).sort((a,b)=>(a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
  return {status:"found" as const,finding,documents,calls,omittedCalls:Math.max(0,callUrls.length-4),timeline,checkedAt:new Date().toISOString(),rulesVersion:report.version,documentVersion:DOCUMENT_REVIEW_VERSION,questions:reviewQuestions(finding.rule,finding.section)};
});
