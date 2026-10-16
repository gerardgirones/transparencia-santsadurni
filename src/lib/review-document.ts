import type { ReviewContract } from "@/lib/api";
import { reviewAmount, reviewDate } from "@/lib/review-rules";
import { canonicalizeNif, foldText } from "@/lib/search-query";

export const DOCUMENT_REVIEW_VERSION = "2026-10-16.1";
export type CheckStatus = "coincideix" | "difereix" | "no-comparable";
export interface DocumentCheck {
  label: string; catalog: string | null; publication: string | null; status: CheckStatus;
}
export interface PublicationReview {
  status: "contrastada" | "no-localitzat" | "ambigu" | "no-compatible" | "no-disponible";
  message: string; sourceUrl: string | null; title: string | null;
  publishedAt: string | null; checks: DocumentCheck[];
}

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
export const documentKey = (value: unknown) => foldText(text(value)).replace(/[’‘]/g,"'").replace(/\s+/g," ");
const available = (value: unknown) => !["","-","--","NULL","N/A","S/D"].includes(documentKey(value));
const localized = (value: unknown) => text(record(value).ca) || text(record(value).es);

// Only catalogue-owned URLs are passed to this function. Never fetch a URL
// supplied by a route parameter, redirect, or a document's embedded link.
export function pscpPublicationSource(value: unknown): {expedient: string; url: string} | null {
  try {
    const url = new URL(text(value));
    const match = url.pathname.match(/^\/(?:ca|es|en|oc)\/detall-publicacio\/([a-f0-9-]{36})\/(\d{1,12})\/?$/i);
    if (url.protocol !== "https:" || url.hostname !== "contractaciopublica.cat" || url.port || url.username || url.password || url.search || url.hash || !match) return null;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(match[1])) return null;
    return {expedient:match[1].toLowerCase(),url:`https://contractaciopublica.cat/portal-api/documents-publicacio/json/${match[2]}`};
  } catch { return null; }
}

export function bdnsCallCode(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    const match = url.pathname.match(/^\/bdnstrans\/GE\/es\/convocatoria\/(\d{1,12})$/);
    return url.protocol === "https:" && url.hostname === "www.subvenciones.gob.es" && !url.port && !url.username && !url.password && !url.search && !url.hash ? match?.[1] ?? null : null;
  } catch { return null; }
}

export function pscpLocalDate(value: unknown): string | null {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return reviewDate(raw);
  // Do not guess a timezone for an unzoned timestamp.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !reviewDate(raw)) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid"}).format(date) : null;
}

export function unavailablePublication(message: string, sourceUrl: string | null = null): PublicationReview {
  return {status:"no-disponible",message,sourceUrl,title:null,publishedAt:null,checks:[]};
}

export function comparePscpPublication(row: ReviewContract, input: unknown, source: {expedient: string; url: string}): PublicationReview {
  const data = record(input), organ = record(data.organ), publication = record(data.publicacio);
  const organNif = text(organ.nif), organId = text(organ.organContractacioId);
  const councilIdentity = (organNif === "P0824000D" || organId === "4491728") &&
    (!organNif || organNif === "P0824000D") && (!organId || organId === "4491728");
  if (text(data.idExpedient).toLowerCase() !== source.expedient || text(publication.expedientId).toLowerCase() !== source.expedient ||
    documentKey(organ.nom) !== documentKey("Ajuntament de Sant Sadurní d'Anoia") || !councilIdentity) {
    return unavailablePublication("La resposta no acredita la identitat de la publicació i de l’Ajuntament. No s’han comparat dades.",source.url);
  }
  const basics = record(publication.dadesBasiquesPublicacio);
  const details = record(publication.dadesPublicacio);
  const base = {sourceUrl:source.url,title:localized(basics.denominacio) || null,publishedAt:pscpLocalDate(data.dataPublicacioReal),checks:[]};
  if (basics.publicacioAgregada !== true || !Array.isArray(details.contractesAgregada)) return {
    ...base,status:"no-compatible",message:"El contrast automàtic admet les publicacions agregades en format JSON. Aquest format requereix consultar la publicació original.",
  };
  const candidates = details.contractesAgregada.map(record).filter(item => available(row.codi_expedient) && documentKey(item.expedient) === documentKey(row.codi_expedient) &&
    (available(row.numero_lot) ? text(item.numeroLot) === text(row.numero_lot) : !available(item.numeroLot)));
  if (candidates.length !== 1) return {...base,status:candidates.length > 1 ? "ambigu" : "no-localitzat",message:candidates.length > 1
    ? "Hi ha diverses entrades per al mateix expedient i lot. No se n’ha triat cap automàticament."
    : "No s’ha localitzat una entrada inequívoca per expedient i lot dins d’aquesta publicació. Això no acredita l’absència del contracte."};
  const item = candidates[0];
  const checks: DocumentCheck[] = [];
  function add(label: string, left: string | null, right: string | null, equal = left === right) {
    checks.push({label,catalog:left,publication:right,status:left === null || right === null ? "no-comparable" : equal ? "coincideix" : "difereix"});
  }
  const amount = (value: unknown) => {const n = reviewAmount(value);return n === null ? null : n.toLocaleString("ca-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";};
  function addAmount(label: string, left: unknown, right: unknown) {
    const a = reviewAmount(left), b = reviewAmount(right);
    add(label,amount(left),amount(right),a !== null && b !== null && Math.abs(a-b) < 0.005);
  }
  add("Expedient",text(row.codi_expedient),text(item.expedient),documentKey(row.codi_expedient) === documentKey(item.expedient));
  add("Lot",available(row.numero_lot) ? text(row.numero_lot) : null,available(item.numeroLot) ? text(item.numeroLot) : null);
  addAmount("Adjudicació sense IVA",row.import_adjudicacio_sense,item.importAdjudicacioSenseIva);
  addAmount("Valor estimat sense IVA",row.valor_estimat_contracte,item.vec);
  add("Data d’adjudicació",reviewDate(row.data_adjudicacio_contracte),pscpLocalDate(item.dataAdjudicacio));
  add("Adjudicatari",available(row.denominacio_adjudicatari) ? text(row.denominacio_adjudicatari) : null,available(item.nomAdjudicatari) ? text(item.nomAdjudicatari) : null,documentKey(row.denominacio_adjudicatari) === documentKey(item.nomAdjudicatari));
  const catalogNif = canonicalizeNif(text(row.identificacio_adjudicatari));
  const publicationNif = canonicalizeNif(text(item.nifAdjudicatari));
  add("Identificació fiscal de l’adjudicatari",catalogNif ? "Identificador complet informat" : null,
    publicationNif ? catalogNif ? publicationNif === catalogNif ? "Mateix identificador" : "Identificador diferent" : "Identificador complet informat" : null,
    catalogNif !== null && publicationNif === catalogNif);
  const cpv = text(record(item.codiCpv).codi);
  add("Codi CPV",available(row.codi_cpv) ? text(row.codi_cpv) : null,cpv || null);
  const type = localized(item.tipusContracte);
  add("Tipus de contracte",available(row.tipus_contracte) ? text(row.tipus_contracte) : null,type || null,documentKey(row.tipus_contracte) === documentKey(type));
  return {...base,checks,status:"contrastada",message:"Entrada localitzada per expedient i lot a la publicació oficial. Es comparen els camps disponibles; la coincidència no valida la justificació ni l’execució del contracte."};
}

export function reviewCasePath(id: string): string { return `/revisio/cas/${encodeURIComponent(id)}`; }

// Page navigation may preserve percent escapes in dynamic parameters, while
// route handlers decode them. Normalize once before looking up a known case.
export function reviewCaseId(value: string): string | null {
  if (value.length > 900) return null;
  try { const id = decodeURIComponent(value);return id.length <= 300 ? id : null; }
  catch { return null; }
}

export function reviewQuestions(rule: string, section: string): string[] {
  if (section === "subvencions") return ["Consultar la resolució de concessió i les modificacions associades a cada identificador BDNS.","Comprovar si les coincidències responen a ajuts diferents, correccions o anul·lacions.","Consultar la justificació i, si escau, el reintegrament. Una concessió no acredita un pagament."];
  if (rule === "proximitat-llindar") return ["Consultar l’informe de necessitat, el càlcul del valor estimat i la resolució d’adjudicació.","Comprovar la durada, les eventuals pròrrogues i les prestacions que formen l’objecte del contracte.","Revisar altres expedients relacionats abans de valorar si hi ha una mateixa necessitat funcional."];
  if (rule === "reiteracio-menors") return ["Llegir els objectes, els informes de necessitat i les dates d’execució dels expedients agrupats.","Determinar si són necessitats independents o una prestació que s’havia de planificar conjuntament.","Contrastar les resolucions, els lots i el càlcul del valor estimat de cada expedient."];
  return ["Contrastar el camp assenyalat amb la publicació i la resolució originals.","Comprovar les esmenes i les diferents fases de l’expedient abans de sumar imports o interpretar coincidències.","Si la informació continua sense quedar clara, demanar el document justificatiu o l’aclariment del camp concret."];
}
