import type { ReviewContract } from "@/lib/api";
import type { SubsidyGrant } from "@/lib/bdns";
import { canonicalizeNif, foldText } from "@/lib/search-query";

export const REVIEW_VERSION = "2026-10-15.1";
export type ReviewKind = "qualitat" | "revisio";
export type ReviewSection = "contractes" | "subvencions";
export interface ReviewEvidence {
  id: string; title: string; date: string | null; amount: number | null;
  beneficiary: string; sourceUrl: string; publicationUrl: string | null;
}
export interface ReviewFinding {
  id: string; rule: string; kind: ReviewKind; section: ReviewSection;
  title: string; reason: string; limitation: string; evidence: ReviewEvidence[];
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const fold = (value: unknown) => foldText(text(value)).replace(/\s+/g, " ");
function missing(value: unknown): boolean {
  return !text(value) || ["-","N/A","NULL","S/D","PENDENT","SENSE ADJUDICAR"].includes(fold(value));
}
export function reviewAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^-?\d+(\.\d+)?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function reviewDate(value: unknown): string | null {
  const date = text(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
export function safeHttpUrl(value: unknown): string | null {
  try { const url = new URL(text(value)); return ["http:","https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function publication(row: ReviewContract): string | null {
  return safeHttpUrl(typeof row.enllac_publicacio === "object" ? row.enllac_publicacio?.url : row.enllac_publicacio);
}
function evidence(row: ReviewContract): ReviewEvidence {
  const url = new URL("https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json");
  url.searchParams.set("$where", `:id='${row.source_row_id.replace(/'/g,"''")}'`);
  return {id:row.source_row_id,title:row.denominacio || row.codi_expedient || "Registre sense títol",
    date:reviewDate(row.data_adjudicacio_contracte) || reviewDate(row.data_publicacio_anunci),
    amount:reviewAmount(row.import_adjudicacio_sense),beneficiary:row.denominacio_adjudicatari || "No informat",
    sourceUrl:url.href,publicationUrl:publication(row)};
}
function awarded(row: ReviewContract): boolean {
  return /ADJUDIC|FORMALITZ|FORMALIZ|^EXECUCIO$|^PUBLICACIO AGREGADA DE CONTRACTES$/.test(fold(row.fase_publicacio)) && !/ANUL|DESERT|DESIST|NO ADJUDIC/.test(fold(row.resultat));
}
function threshold(row: ReviewContract): number | null {
  if (fold(row.procediment) !== "CONTRACTE MENOR" || !awarded(row)) return null;
  const date = reviewDate(row.data_adjudicacio_contracte);
  if (!date || date < "2018-03-09" || text(row.import_adjudicacio_sense).includes("||") || text(row.identificacio_adjudicatari).includes("||")) return null;
  const type = fold(row.tipus_contracte);
  return type === "OBRES" ? 40000 : ["SERVEIS","SUBMINISTRAMENTS"].includes(type) ? 15000 : null;
}

export function reviewContracts(rows: ReviewContract[], today = new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin"}).format(new Date())): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  function add(rule: string, kind: ReviewKind, title: string, reason: string, limitation: string, affected: ReviewContract[]) {
    findings.push({id:`contractes:${rule}:${affected[0].source_row_id}`,rule,kind,section:"contractes",title,reason,limitation,evidence:affected.map(evidence)});
  }
  const duplicateGroups = new Map<string, ReviewContract[]>();
  const recurrence = new Map<string, ReviewContract[]>();
  for (const row of rows) {
    if (!awarded(row)) continue;
    const gaps = [missing(row.codi_expedient) ? "codi d’expedient" : null,
      missing(row.denominacio_adjudicatari) ? "nom de l’adjudicatari" : null,
      !publication(row) ? "enllaç de publicació" : null,
      !reviewDate(row.data_adjudicacio_contracte) ? "data d’adjudicació vàlida" : null].filter(Boolean);
    if (gaps.length) add("camps-incomplets","qualitat","Adjudicació amb dades incompletes",
      `No consta a les dades: ${gaps.join(", ")}.`,"El document original pot contenir aquesta informació; l’avís descriu el registre publicat.",[row]);
    const amount = reviewAmount(row.import_adjudicacio_sense);
    if (amount === null || amount <= 0) add("import-no-interpretable","qualitat","Import pendent de comprovació",
      text(row.import_adjudicacio_sense).includes("||") ? "El registre combina diversos imports i no es pot llegir com una única adjudicació." : "L’import sense IVA no és positiu o no es pot interpretar.",
      "Pot ser un lot, una correcció o una operació sense contraprestació. No s’inclou en els patrons d’imports.",[row]);
    const date = reviewDate(row.data_adjudicacio_contracte);
    if (date && date > today) add("data-futura","qualitat","Data d’adjudicació posterior a la consulta",
      `La data publicada és ${date}; la revisió és de ${today}.`,"Cal comprovar si és una previsió, una correcció o un error de càrrega.",[row]);
    const limit = threshold(row);
    if (limit && amount !== null && amount >= limit * 0.99 && amount < limit) add("proximitat-llindar","revisio","Import proper al llindar de referència",
      `L’adjudicació és dins de l’últim 1% de ${limit.toLocaleString("ca-ES")} € sense IVA per a aquest tipus de contracte menor.`,
      "Es compara l’import adjudicat, no el valor estimat legal. La proximitat no acredita fraccionament ni cap infracció.",[row]);
    if (!missing(row.codi_expedient) && amount !== null && date) {
      const key = JSON.stringify([fold(row.nom_organ),fold(row.codi_expedient),text(row.numero_lot),fold(row.identificacio_adjudicatari),fold(row.denominacio_adjudicatari),amount,date,fold(row.fase_publicacio),publication(row)]);
      const group = duplicateGroups.get(key) ?? []; group.push(row); duplicateGroups.set(key,group);
    }
    const supplier = canonicalizeNif(text(row.identificacio_adjudicatari));
    const cpv = text(row.codi_cpv).match(/^(\d{8})(?:-\d)?$/)?.[1];
    if (limit && amount !== null && amount > 0 && amount < limit && date && date <= today && supplier && cpv && !missing(row.codi_expedient)) {
      const key = JSON.stringify([fold(row.nom_organ),supplier,cpv,fold(row.tipus_contracte),date.slice(0,4)]);
      const group = recurrence.get(key) ?? []; group.push(row); recurrence.set(key,group);
    }
  }
  for (const group of duplicateGroups.values()) if (group.length > 1) add("coincidencia-registres","qualitat","Registres coincidents d’una adjudicació",
    `${group.length} registres comparteixen expedient, lot, adjudicatari, import, data, fase i enllaç.`,
    "Poden ser republicacions. L’avís no elimina registres ni afirma que hi hagi pagaments duplicats.",group);
  for (const group of recurrence.values()) {
    // Keep one publication per lot: repeated publication phases must not inflate a pattern.
    const unique = new Map<string, ReviewContract>();
    const conflicting = new Set<string>();
    for (const row of group) {
      const key = JSON.stringify([fold(row.codi_expedient),text(row.numero_lot)]);
      const previous = unique.get(key);
      if (previous && (reviewAmount(previous.import_adjudicacio_sense) !== reviewAmount(row.import_adjudicacio_sense) || reviewDate(previous.data_adjudicacio_contracte) !== reviewDate(row.data_adjudicacio_contracte))) conflicting.add(key);
      if (!previous || text(row.data_publicacio_anunci) > text(previous.data_publicacio_anunci)) unique.set(key,row);
    }
    const sorted = [...unique.entries()].filter(([key]) => !conflicting.has(key)).map(([,row]) => row).sort((a,b) => text(a.data_adjudicacio_contracte).localeCompare(text(b.data_adjudicacio_contracte)));
    for (let start = 0; start < sorted.length;) {
      const from = Date.parse(`${reviewDate(sorted[start].data_adjudicacio_contracte)}T00:00:00Z`);
      let end = start + 1;
      while (end < sorted.length && Date.parse(`${reviewDate(sorted[end].data_adjudicacio_contracte)}T00:00:00Z`) - from <= 29 * 86400000) end++;
      const window = sorted.slice(start,end);
      const distinct = new Set(window.map(row => fold(row.codi_expedient))).size;
      const total = window.reduce((sum,row) => sum + (reviewAmount(row.import_adjudicacio_sense) ?? 0),0);
      const limit = threshold(window[0])!;
      if (distinct >= 3 && total >= limit) {
        add("reiteracio-menors","revisio","Diversos expedients menors similars en 30 dies",
          `${distinct} expedients del mateix adjudicatari i codi CPV sumen ${total.toLocaleString("ca-ES",{maximumFractionDigits:2})} € sense IVA en un període de 30 dies del mateix any.`,
          "Compartir proveïdor i CPV no prova una unitat funcional: poden ser necessitats independents. Cal llegir els expedients i els informes justificatius.",window);
        start = end;
      } else start++;
    }
  }
  return findings;
}

export function reviewGrants(rows: SubsidyGrant[], today = new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin"}).format(new Date())): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const duplicates = new Map<string, SubsidyGrant[]>();
  const toEvidence = (row: SubsidyGrant): ReviewEvidence => ({id:row.id,title:row.title || "Concessió sense títol",
    date:reviewDate(row.date),amount:row.amount,beneficiary:row.beneficiary || "No informat",
    sourceUrl:safeHttpUrl(row.callUrl) || "https://www.subvenciones.gob.es/bdnstrans/GE/es/concesiones",
    publicationUrl:safeHttpUrl(row.basesUrl)});
  for (const row of rows) {
    const reasons = [missing(row.title) ? "títol no informat" : null,missing(row.beneficiary) ? "beneficiari no informat" : null,
      !safeHttpUrl(row.basesUrl) && !safeHttpUrl(row.callUrl) ? "sense enllaç a bases ni convocatòria" : null,
      !reviewDate(row.date) ? "data no vàlida" : row.date > today ? "data posterior a la consulta" : null,
      row.amount <= 0 ? "import no positiu" : null].filter(Boolean);
    if (reasons.length) findings.push({id:`subvencions:camps:${row.id}`,rule:"dades-concessio",kind:"qualitat",section:"subvencions",
      title:"Concessió amb dades per comprovar",reason:reasons.join("; ")+".",limitation:"Descriu la informació publicada a la BDNS. Cal consultar la resolució i les bases abans de treure conclusions.",evidence:[toEvidence(row)]});
    if (row.callUrl && !missing(row.beneficiary) && reviewDate(row.date) && row.amount > 0) {
      const key = JSON.stringify([row.callUrl,fold(row.beneficiary),row.date,row.amount]);
      const group = duplicates.get(key) ?? []; group.push(row); duplicates.set(key,group);
    }
  }
  for (const group of duplicates.values()) if (group.length > 1) findings.push({
    id:`subvencions:coincidencia:${group[0].id}`,rule:"coincidencia-concessions",kind:"revisio",section:"subvencions",
    title:"Concessions coincidents dins d’una convocatòria",reason:`${group.length} identificadors de concessió coincideixen en convocatòria, beneficiari, data i import.`,
    limitation:"Poden ser concessions diferenciades o correccions. Això no prova un doble cobrament ni un pagament efectuat.",evidence:group.map(toEvidence),
  });
  return findings;
}
