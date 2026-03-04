import {
  AOC_CKAN_BASE_URL,
  AOC_RESOURCE_IDS,
  DEFAULT_PAGE_SIZE,
  OFFICIAL_SOURCES,
  REVALIDATE_SECONDS,
  SANT_SADURNI_CODI_ENS,
} from "@/config/constants";
import { fetchTotalAmount, fetchTotalContracts } from "@/lib/api";
import * as XLSX from "xlsx";

type CkanRecord = Record<string, unknown>;

interface CachedPdfText {
  text: string;
  expiresAt: number;
}

interface TransparencyRuntimeCache {
  pdfText: Map<string, CachedPdfText>;
}

declare global {
  var __transparencyRuntimeCache: TransparencyRuntimeCache | undefined;
}

function getRuntimeCache(): TransparencyRuntimeCache {
  if (!globalThis.__transparencyRuntimeCache) {
    globalThis.__transparencyRuntimeCache = {
      pdfText: new Map<string, CachedPdfText>(),
    };
  }
  return globalThis.__transparencyRuntimeCache;
}

interface CkanResponse {
  success: boolean;
  result?: {
    records: CkanRecord[];
    total: number;
  };
}

export interface TransparencyContract {
  codiExpedient: string;
  denominacio: string;
  adjudicatari: string;
  importAmbIva: number;
  dataPublicacio: string;
  enllacPublicacio: string;
  procediment: string;
}

export interface TransparencyBudgetLine {
  anyExercici: number;
  descripcio: string;
  import: number;
  tipusPartida: string;
  nivell: number;
}

export interface TransparencySubsidy {
  dataConcessio: string;
  titol: string;
  beneficiari: string;
  import: number;
  basesReguladores: string;
}

export interface SubsidyExplorerItem extends TransparencySubsidy {
  anyConcessio?: number;
}

export interface SubsidyExplorerFilters {
  year?: string;
  search?: string;
  beneficiari?: string;
  amountMin?: string;
  amountMax?: string;
  page?: number;
  pageSize?: number;
}

export interface SubsidyExplorerRankingRow {
  beneficiari: string;
  totalAmount: number;
  count: number;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;|&#039;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToTextLines(html: string): string[] {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = decodeHtmlEntities(noScripts.replace(/<[^>]+>/g, "\n"));
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export interface TransparencyAgreement {
  anySignatura: number;
  titol: string;
  totalAportacions: number;
  dataSignatura: string;
  vigent: string;
  pdfConveni: string;
}

export interface TransparencyPlenaryMinute {
  dataAcord: string;
  tipus: string;
  enllacActa: string;
  codiActa: string;
}

export interface OfficialSalary {
  id: string;
  nom: string;
  carrec: string;
  partit?: string;
  retribucioAnualBruta?: number;
  documentRetribucioUrl?: string;
  fitxaUrl: string;
}

export interface EconomicRightsDocument {
  title: string;
  url: string;
  category: "fixa" | "assistencies" | "altres";
  year?: number;
  detectedAmount?: number;
}

export interface EconomicRightsYearSummary {
  year: number;
  fixaAmount: number;
  assistenciesAmount: number;
  altresAmount: number;
  totalDetectedAmount: number;
  documentsCount: number;
}

export interface EconomicRightsBreakdownRow {
  title: string;
  url: string;
  year?: number;
  fixedAnnualAmount?: number;
  plenaryAttendanceAmount?: number;
  commissionAttendanceAmount?: number;
  boardAttendanceAmount?: number;
  otherCompensationAmount?: number;
  confidence: "alta" | "mitjana" | "baixa";
  evidence: string[];
}

export interface EconomicRightsRoleComparisonRow {
  year: number;
  role: string;
  fixedAmount?: number;
  attendanceAmount?: number;
  totalEstimatedAmount?: number;
  sourceDocs: number;
  confidence: "alta" | "mitjana" | "baixa";
}

export interface EconomicRightsAnnualOverviewRow {
  year: number;
  status: "publicat" | "cobert" | "no_publicat";
  fixedAnnualReference?: number;
  attendancePlePerSession?: number;
  attendanceComissioPerSession?: number;
  attendanceJuntaPerSession?: number;
  budgetRetribucions?: number;
  budgetAssistencies?: number;
  sourceDocs: number;
}

export interface TransparencySummary {
  contractsTotal: number;
  contractsAmount: number;
  subsidiesTotal: number;
  subsidiesAmount: number;
  agreementsTotal: number;
  agreementsAmount: number;
  plenaryMinutesTotal: number;
  currentBudgetYear?: number;
  currentBudgetAmount?: number;
  officialsWithSalary: number;
}

export interface PublishedSalaryYearRow {
  year: number;
  status: "publicat" | "cobert" | "modificacio";
  fixedPublished: string;
  attendancePublished: string;
  notes: string;
  sources: Array<{ label: string; url: string }>;
}

export interface ExternalSalaryCheckRow {
  organism: string;
  status: "verificable" | "no_verificable";
  finding: string;
  notes: string;
  sources: Array<{ label: string; url: string }>;
}

const CCAP_2023_2027_XLSX_URL =
  "https://seu-e.cat/documents/2368752/12338232/2023-2027+Quadre+resum+indemnitzacions+i+retribucions/e24de8ee-340e-46fa-879c-3fff9de21a0d";

function normalizePersonName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNameTokens(value: string): string[] {
  return normalizePersonName(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function getOfficialNameVariants(value: string): string[] {
  const normalized = normalizePersonName(value);
  const variants = new Set<string>([normalized]);

  if (normalized.includes(" ton ") || normalized.startsWith("ton ")) {
    variants.add(normalized.replace(/^ton\s+/, "anton "));
  }
  if (normalized.includes(" anton ") || normalized.startsWith("anton ")) {
    variants.add(normalized.replace(/^anton\s+/, "ton "));
  }

  return Array.from(variants);
}

function toSafeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export type TraceabilityLevel = "alta" | "mitjana" | "baixa";

export interface TraceabilityAlert {
  id: string;
  section: "contractes" | "subvencions" | "convenis" | "carrecs";
  title: string;
  date?: string;
  amount?: number;
  level: TraceabilityLevel;
  reasons: string[];
  sourceUrl?: string;
}

export function getPublishedSalaryYears(): PublishedSalaryYearRow[] {
  return [
    {
      year: 2019,
      status: "publicat",
      fixedPublished: "26.500,00 + 20.850,00 EUR",
      attendancePublished: "Ple 416,67 · Portaveus 170,83 · Comissions 10,00 · Junta 200,00",
      notes: "Acord base mandat 2019-2023.",
      sources: [
        {
          label: "Acord 2019-2023",
          url: "https://seu-e.cat/documents/606350/15696800/R%C3%88GIM+DE+DEDICACIONS%2C+RETRIBUCIONS+I+ASSIGNACIONS+C%C3%80RRECS+ELECTES+2019-2023/e692bc9d-f419-49e8-9944-a0ddcc5b6169",
        },
      ],
    },
    {
      year: 2020,
      status: "cobert",
      fixedPublished: "Segons acord 2019-2023",
      attendancePublished: "Segons acord 2019-2023",
      notes: "Cobert per acord plurianual.",
      sources: [
        {
          label: "Acord 2019-2023",
          url: "https://seu-e.cat/documents/606350/15696800/R%C3%88GIM+DE+DEDICACIONS%2C+RETRIBUCIONS+I+ASSIGNACIONS+C%C3%80RRECS+ELECTES+2019-2023/e692bc9d-f419-49e8-9944-a0ddcc5b6169",
        },
      ],
    },
    {
      year: 2021,
      status: "cobert",
      fixedPublished: "Segons acord 2019-2023",
      attendancePublished: "Segons acord 2019-2023",
      notes: "Cobert per acord plurianual.",
      sources: [
        {
          label: "Acord 2019-2023",
          url: "https://seu-e.cat/documents/606350/15696800/R%C3%88GIM+DE+DEDICACIONS%2C+RETRIBUCIONS+I+ASSIGNACIONS+C%C3%80RRECS+ELECTES+2019-2023/e692bc9d-f419-49e8-9944-a0ddcc5b6169",
        },
      ],
    },
    {
      year: 2022,
      status: "modificacio",
      fixedPublished: "27.030,00 + 21.267,00 EUR",
      attendancePublished: "Ple 425,00 · Portaveus 174,25 · Comissions 10,20 · Junta 204,00",
      notes: "Modificacio puntual de gener 2022.",
      sources: [
        {
          label: "Modificacio 2022",
          url: "https://seu-e.cat/documents/606350/15696800/MODIFICACI%C3%93+DRETS+ECON%C3%92MICS+C%C3%80RRECS+ELECTES.pdf/90ddf137-ace7-4f4b-b245-fe825af1f675",
        },
      ],
    },
    {
      year: 2023,
      status: "modificacio",
      fixedPublished: "36.000,00 · 28.000,00 · 16.860,00 EUR",
      attendancePublished: "Ple 460 · Portaveus 175 · Comissions 25 · Junta 460",
      notes: "Nou acord base 2023-2027 (any de transicio).",
      sources: [
        {
          label: "Acord 2023-2027",
          url: "https://seu-e.cat/documents/606350/15696800/REGIM+DEDICACI%C3%93+I+RETRIBUCIONS+DE+REGIDORS-ES+2023-2027.pdf/8223757f-9dee-46dc-976d-0acdbcaf218c",
        },
      ],
    },
    {
      year: 2024,
      status: "modificacio",
      fixedPublished: "33.000,00 (x2) · 17.281,50 (x4)",
      attendancePublished: "Règim 2023-2027 si no hi ha canvi puntual",
      notes: "Modificacio de maig/juny 2024 publicada a BOP.",
      sources: [
        { label: "BOP 3637108", url: "https://bop.diba.cat/anuncio/3637108" },
        { label: "BOP 3634492", url: "https://bop.diba.cat/anuncio/3634492" },
      ],
    },
    {
      year: 2025,
      status: "modificacio",
      fixedPublished: "Canvi nominal dedicacio 17.281,50 EUR",
      attendancePublished: "Segons regim vigent",
      notes: "Canvi de titularitat per decret/BOP.",
      sources: [{ label: "BOP 3868512", url: "https://bop.diba.cat/anuncio/3868512" }],
    },
    {
      year: 2026,
      status: "modificacio",
      fixedPublished: "Canvi de regim (renuncia dedicacio exclusiva)",
      attendancePublished: "Passa a regim d'assistencies",
      notes: "Modificacio puntual, sense nova taula completa global.",
      sources: [{ label: "BOP 3887094", url: "https://bop.diba.cat/anuncio/3887094" }],
    },
  ];
}

export function getExternalSalaryChecks(): ExternalSalaryCheckRow[] {
  return [
    {
      organism: "Diputacio de Barcelona",
      status: "no_verificable",
      finding: "No s'ha verificat cobrament nominal de carrecs de Sant Sadurni al llistat publicat.",
      notes: "Hi ha llistat nominal i codis retributius, pero sense prova directa detectada per aquests carrecs.",
      sources: [
        { label: "Retribucions electes (DIBA)", url: "https://www.diba.cat/web/ladiputacio/retribucions-electes" },
        { label: "Portal transparencia DIBA", url: "https://transparencia.diba.cat/ca/retribucions-membres-electes" },
      ],
    },
    {
      organism: "Consell Comarcal de l'Alt Penedes",
      status: "verificable",
      finding:
        "Hi ha evidencia que tambe cobren del Consell Comarcal (indemnitzacions/assignacions) alguns carrecs de Sant Sadurni.",
      notes:
        "Coincidencies nominals verificades al document 2023-2027: Pedro Campos (Pedro Campos Osuna) i Marta Castellvi (Marta Castellvi Chacon).",
      sources: [
        {
          label: "Retribucions consellers/es",
          url: "https://seu-e.cat/ca/web/ccaltpenedes/govern-obert-i-transparencia/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions/retribucions-i-indemnitzacions-dels/les-consellers/es-i-dels-grups-politics-234",
        },
      ],
    },
  ];
}

export async function fetchCcapCompensationsForOfficials(
  officialNames: string[]
): Promise<Record<string, number>> {
  try {
    const res = await fetch(CCAP_2023_2027_XLSX_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return {};

    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return {};

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, {
      header: 1,
      raw: true,
      blankrows: false,
    });

    const ccapRows: Array<{ name: string; annualExpected: number }> = [];
    for (const row of rows) {
      const name = typeof row[0] === "string" ? row[0].trim() : "";
      if (!name || name.length < 4) continue;

      const formulaCell = row[7];
      const formula = typeof formulaCell === "string" ? formulaCell : "";
      const c = toSafeNumber(row[2]);
      const d = toSafeNumber(row[3]);
      const e = toSafeNumber(row[4]);
      const f = toSafeNumber(row[5]);
      const g = toSafeNumber(row[6]);

      let annualExpected = 0;
      if (formula.includes("*11") || formula.includes("*12")) {
        const multiplier = formula.includes("*12") ? 12 : 11;
        const monthly = c + d + d + e + f + g;
        annualExpected = monthly * multiplier;
      } else {
        annualExpected = toSafeNumber(row[7]) || toSafeNumber(row[8]);
      }

      if (annualExpected > 0) {
        ccapRows.push({ name, annualExpected });
      }
    }

    const result: Record<string, number> = {};
    for (const officialName of officialNames) {
      const officialKey = normalizePersonName(officialName);
      const variantTokens = getOfficialNameVariants(officialName)
        .map((variant) => getNameTokens(variant))
        .filter((tokens) => tokens.length > 0);
      if (variantTokens.length === 0) continue;

      let bestScore = 0;
      let bestAmount = 0;
      for (const row of ccapRows) {
        const rowTokens = getNameTokens(row.name);
        if (rowTokens.length === 0) continue;
        let score = 0;
        for (const tokens of variantTokens) {
          score = Math.max(score, rowTokens.filter((token) => tokens.includes(token)).length);
        }
        if (score > bestScore || (score === bestScore && row.annualExpected > bestAmount)) {
          bestScore = score;
          bestAmount = row.annualExpected;
        }
      }

      if (bestScore >= 2) {
        result[officialKey] = bestAmount;
      }
    }

    return result;
  } catch {
    return {};
  }
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function resolveTraceabilityLevel(score: number): TraceabilityLevel {
  if (score >= 3) return "alta";
  if (score >= 2) return "mitjana";
  return "baixa";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseYearFromDate(value: string): number | undefined {
  const match = value.match(/\b(20\d{2})\b/);
  if (!match) return undefined;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return undefined;
  return year;
}

function parseDateToTimestamp(value: string): number {
  const raw = (value || "").trim();
  if (!raw) return 0;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(5, 7));
    const d = Number(raw.slice(8, 10));
    return Date.UTC(y, m - 1, d);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("/").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ckanFetch(
  resourceId: string,
  filters: Record<string, string | number>,
  limit = 50,
  offset = 0,
  sort?: string
): Promise<{ records: CkanRecord[]; total: number }> {
  const url = new URL(AOC_CKAN_BASE_URL);
  url.searchParams.set("resource_id", resourceId);
  url.searchParams.set("filters", JSON.stringify(filters));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  if (sort) url.searchParams.set("sort", sort);

  const res = await fetch(url.toString(), {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`CKAN API error (${res.status})`);
  }

  const json = (await res.json()) as CkanResponse;
  if (!json.success || !json.result) return { records: [], total: 0 };
  return {
    records: json.result.records || [],
    total: json.result.total || 0,
  };
}

function parseOfficialList(html: string): { id: string; nom: string; fitxaUrl: string }[] {
  const matches = html.matchAll(/<a[^>]+href="([^"]*\/veureCarrec\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
  const seen = new Set<string>();
  const officials: { id: string; nom: string; fitxaUrl: string }[] = [];

  for (const match of matches) {
    const anchorHtml = String(match[0] || "");
    const titleMatch = anchorHtml.match(/title="([^"]+)"/i);
    const titleText = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : "";
    const isProfileLink = /alts-carrecs-carrecs-item-dades-link/i.test(anchorHtml) || /^Veure fitxa/i.test(titleText);
    if (!isProfileLink) continue;

    const fitxaUrl = match[1].startsWith("http")
      ? match[1]
      : `https://seu-e.cat${match[1].startsWith("/") ? "" : "/"}${match[1]}`;
    const id = match[2];
    const anchorText = decodeHtmlEntities(String(match[3] || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const nom = (titleText.replace(/^Veure fitxa\s+/i, "") || anchorText || `Carrec ${id}`).trim();
    if (seen.has(id)) continue;
    seen.add(id);
    officials.push({ id, nom, fitxaUrl });
  }

  return officials;
}

function parseOfficialDetail(html: string): {
  carrec: string;
  partit?: string;
  retribucioAnualBruta?: number;
  documentRetribucioUrl?: string;
} {
  const lines = htmlToTextLines(html);
  const candidateLines = lines.filter((line) => {
    const folded = normalizeFoldedText(line);
    return (
      folded.includes("alcald") ||
      folded.includes("regidor") ||
      folded.includes("tinent") ||
      folded.includes("portaveu") ||
      folded.includes("carrec")
    );
  });

  // Prioritize by importance to avoid picking generic breadcrumbs or category headers
  let roleLine = "Carrec public";
  if (candidateLines.length > 0) {
    const prioritized = candidateLines.sort((a, b) => {
      const fa = normalizeFoldedText(a);
      const fb = normalizeFoldedText(b);
      const score = (f: string) => {
        if (f.includes("alcald")) return 4;
        if (f.includes("tinent")) return 3;
        if (f.includes("portaveu")) return 2;
        if (f.includes("regidor")) return 1;
        return 0;
      };
      return score(fb) - score(fa);
    });
    // Filter out very short generic plural headers like "Regidors" or "Alts càrrecs"
    roleLine = prioritized.find(l => l.length > 3 && !/^regidors$/i.test(l) && !/alts càrrecs/i.test(l)) || prioritized[0];
  }

  const partyLine = lines.find((line) => {
    const folded = normalizeFoldedText(line);
    return folded.includes("partit") || folded.includes("grup municipal");
  });

  let retribucioAnualBruta: number | undefined;
  for (const line of lines) {
    const folded = normalizeFoldedText(line);
    if (!folded.includes("retribuc") && !folded.includes("sou") && !folded.includes("salari")) continue;
    if (!folded.includes("anual") && !folded.includes("bruta")) continue;
    const amounts = extractAmountsFromLine(line);
    if (amounts.length > 0) {
      retribucioAnualBruta = Math.max(...amounts);
      break;
    }
  }

  if (!retribucioAnualBruta) {
    const salaryMatch = decodeHtmlEntities(html).match(/retribuci[oó][\s\S]{0,90}?anual[\s\S]{0,90}?([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?)/i);
    if (salaryMatch) {
      const parsed = toNumber(salaryMatch[1]);
      if (parsed > 0) retribucioAnualBruta = parsed;
    }
  }

  const documentMatch = html.match(
    /<a[^>]+href="([^"]+)"[^>]*>\s*Document\s+p[úu]blic\s+on\s+es\s+recull\s+retribuci[óo]/i
  );
  const documentHref = documentMatch?.[1];
  const documentRetribucioUrl = documentHref
    ? documentHref.startsWith("http")
      ? documentHref
      : `https://seu-e.cat${documentHref.startsWith("/") ? "" : "/"}${documentHref}`
    : undefined;

  return {
    carrec: roleLine,
    partit: partyLine,
    retribucioAnualBruta,
    documentRetribucioUrl,
  };
}

function classifyEconomicRightsDocument(title: string): "fixa" | "assistencies" | "altres" {
  const normalized = title.toLowerCase();
  if (
    normalized.includes("ple") ||
    normalized.includes("comissi") ||
    normalized.includes("assist") ||
    normalized.includes("junta")
  ) {
    return "assistencies";
  }
  if (
    normalized.includes("retribuc") ||
    normalized.includes("dedicaci") ||
    normalized.includes("sou") ||
    normalized.includes("salari")
  ) {
    return "fixa";
  }
  return "altres";
}

function extractYearFromText(value: string): number | undefined {
  const matches = value.match(/\b(20\d{2})\b/g);
  if (!matches || matches.length === 0) return undefined;
  const years = matches.map((m) => Number(m)).filter((y) => y >= 2000 && y <= new Date().getFullYear() + 1);
  if (years.length === 0) return undefined;
  return Math.max(...years);
}

function extractAmountFromText(value: string): number | undefined {
  const match = value.match(/([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?)\s*€/);
  if (!match) return undefined;
  const parsed = toNumber(match[1]);
  return parsed > 0 ? parsed : undefined;
}

function normalizeFoldedText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractAmountsFromLine(line: string): number[] {
  const matches = line.matchAll(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:€|euros?)/gi);
  const amounts: number[] = [];
  for (const match of matches) {
    const amount = toNumber(match[1]);
    if (amount > 0) amounts.push(amount);
  }
  return amounts;
}

function pickAmountByKeywords(
  lines: string[],
  keywords: string[]
): { amount?: number; evidence?: string } {
  const scored: Array<{ amount: number; evidence: string }> = [];
  for (const line of lines) {
    const folded = normalizeFoldedText(line);
    if (!keywords.some((keyword) => folded.includes(keyword))) continue;
    const amounts = extractAmountsFromLine(line);
    for (const amount of amounts) {
      scored.push({ amount, evidence: line.trim() });
    }
  }
  if (scored.length === 0) return {};
  scored.sort((a, b) => b.amount - a.amount);
  return { amount: scored[0].amount, evidence: scored[0].evidence };
}

function getFirstAmountInWindow(lines: string[], startIndex: number, windowSize = 3): number | undefined {
  const end = Math.min(lines.length, startIndex + windowSize + 1);
  for (let i = startIndex; i < end; i += 1) {
    const amounts = extractAmountsFromLine(lines[i]);
    if (amounts.length > 0) return amounts[0];
  }
  return undefined;
}

function extractCoverageYearsFromText(text: string): number[] {
  const years = new Set<number>();

  for (const match of text.matchAll(/\b(20\d{2})\b/g)) {
    const year = Number(match[1]);
    if (year >= 2000 && year <= new Date().getFullYear() + 3) years.add(year);
  }

  for (const rangeMatch of text.matchAll(/\b(20\d{2})\s*[-–]\s*(20\d{2})\b/g)) {
    const from = Number(rangeMatch[1]);
    const to = Number(rangeMatch[2]);
    if (from > to || to - from > 8) continue;
    for (let year = from; year <= to; year += 1) {
      years.add(year);
    }
  }

  return Array.from(years).sort((a, b) => a - b);
}

function extractBudgetByYear(lines: string[]): Map<number, { retribucions?: number; assistencies?: number }> {
  const map = new Map<number, { retribucions?: number; assistencies?: number }>();
  let currentYear: number | undefined;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const yearMatch = line.match(/^20\d{2}$/);
    if (yearMatch) {
      currentYear = Number(yearMatch[0]);
      if (!map.has(currentYear)) map.set(currentYear, {});
      continue;
    }
    if (!currentYear) continue;

    if (line.includes("100.9120.10000")) {
      const amount = getFirstAmountInWindow(lines, i, 4);
      if (amount) {
        const existing = map.get(currentYear) || {};
        existing.retribucions = amount;
        map.set(currentYear, existing);
      }
    }

    if (line.includes("100.9120.23001")) {
      const amount = getFirstAmountInWindow(lines, i, 4);
      if (amount) {
        const existing = map.get(currentYear) || {};
        existing.assistencies = amount;
        map.set(currentYear, existing);
      }
    }
  }

  return map;
}

function extractAttendanceRates(lines: string[]): {
  ple?: number;
  comissio?: number;
  junta?: number;
} {
  const result: { ple?: number; comissio?: number; junta?: number } = {};
  for (let i = 0; i < lines.length; i += 1) {
    const folded = normalizeFoldedText(lines[i]);
    const amount = getFirstAmountInWindow(lines, i, 2);
    if (!amount) continue;

    if (folded.includes("ple municipal") || (folded.includes("ple") && folded.includes("import per sessio"))) {
      result.ple = Math.max(result.ple || 0, amount);
    }
    if (folded.includes("comissions") || folded.includes("comissio informativa")) {
      result.comissio = Math.max(result.comissio || 0, amount);
    }
    if (folded.includes("junta de govern")) {
      result.junta = Math.max(result.junta || 0, amount);
    }
  }
  return result;
}

function extractFixedAnnualReference(lines: string[]): number | undefined {
  let maxAmount = 0;
  for (const line of lines) {
    const folded = normalizeFoldedText(line);
    if (!folded.includes("retribucio bruta anual") && !folded.includes("retribucio bruta")) continue;
    const amounts = extractAmountsFromLine(line);
    for (const amount of amounts) {
      if (amount > maxAmount) maxAmount = amount;
    }
  }
  return maxAmount > 0 ? maxAmount : undefined;
}

async function fetchPdfText(url: string): Promise<string> {
  try {
    const cache = getRuntimeCache();
    const now = Date.now();
    const cached = cache.pdfText.get(url);
    if (cached && cached.expiresAt > now) return cached.text;

    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return "";
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return "";
    const pdfModule = await import("pdf-parse");
    const parser = new pdfModule.PDFParse({ data: Buffer.from(arrayBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = parsed?.text || "";
    cache.pdfText.set(url, {
      text,
      expiresAt: now + REVALIDATE_SECONDS * 1000,
    });
    return text;
  } catch {
    return "";
  }
}

export async function fetchEconomicRightsDocuments(limit = 20): Promise<EconomicRightsDocument[]> {
  const res = await fetch(OFFICIAL_SOURCES.economicRights, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return [];
  const html = await res.text();

  const links = html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
  const docs: EconomicRightsDocument[] = [];
  const seen = new Set<string>();

  for (const match of links) {
    const hrefRaw = String(match[1] || "").trim();
    const titleRaw = String(match[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!hrefRaw || !titleRaw) continue;
    if (!/\.(pdf)(\?|$)/i.test(hrefRaw) && !titleRaw.toLowerCase().includes("retribuc")) continue;

    const href = hrefRaw.startsWith("http")
      ? hrefRaw
      : `https://seu-e.cat${hrefRaw.startsWith("/") ? "" : "/"}${hrefRaw}`;
    if (seen.has(href)) continue;
    seen.add(href);

    docs.push({
      title: titleRaw,
      url: href,
      category: classifyEconomicRightsDocument(titleRaw),
      year: extractYearFromText(`${titleRaw} ${href}`),
      detectedAmount: extractAmountFromText(titleRaw),
    });
  }

  return docs.slice(0, limit);
}

export function buildEconomicRightsYearSummaries(
  docs: EconomicRightsDocument[]
): EconomicRightsYearSummary[] {
  const map = new Map<number, EconomicRightsYearSummary>();

  for (const doc of docs) {
    if (!doc.year) continue;
    const existing =
      map.get(doc.year) ||
      {
        year: doc.year,
        fixaAmount: 0,
        assistenciesAmount: 0,
        altresAmount: 0,
        totalDetectedAmount: 0,
        documentsCount: 0,
      };

    existing.documentsCount += 1;
    if (typeof doc.detectedAmount === "number" && doc.detectedAmount > 0) {
      existing.totalDetectedAmount += doc.detectedAmount;
      if (doc.category === "fixa") existing.fixaAmount += doc.detectedAmount;
      if (doc.category === "assistencies") existing.assistenciesAmount += doc.detectedAmount;
      if (doc.category === "altres") existing.altresAmount += doc.detectedAmount;
    }

    map.set(doc.year, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.year - a.year);
}

export async function fetchEconomicRightsBreakdown(
  docs: EconomicRightsDocument[],
  limit = 8
): Promise<EconomicRightsBreakdownRow[]> {
  const parseCandidates = docs
    .filter((doc) => doc.category === "fixa" || doc.category === "assistencies")
    .slice(0, limit);

  const rows = await Promise.all(
    parseCandidates.map(async (doc) => {
      const text = await fetchPdfText(doc.url);
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const fixed = pickAmountByKeywords(lines, ["retribuc", "dedicacio", "anual", "salari", "sou", "bruta"]);
      const plenary = pickAmountByKeywords(lines, ["assistencia", "assistencies", "ple", "plens", "sessio plenaria"]);
      const commissions = pickAmountByKeywords(lines, ["comissio", "comissions", "informativa"]);
      const board = pickAmountByKeywords(lines, ["junta de govern", "junta govern"]);
      const other = pickAmountByKeywords(lines, ["indemnitz", "dieta", "desplacament", "quilometr"]);

      const evidence = [fixed.evidence, plenary.evidence, commissions.evidence, board.evidence, other.evidence]
        .filter((line): line is string => Boolean(line))
        .slice(0, 3);

      const detectedFields = [
        fixed.amount,
        plenary.amount,
        commissions.amount,
        board.amount,
        other.amount,
      ].filter((value) => typeof value === "number").length;

      const confidence: "alta" | "mitjana" | "baixa" =
        detectedFields >= 3 ? "alta" : detectedFields >= 1 ? "mitjana" : "baixa";

      return {
        title: doc.title,
        url: doc.url,
        year: doc.year,
        fixedAnnualAmount: fixed.amount,
        plenaryAttendanceAmount: plenary.amount,
        commissionAttendanceAmount: commissions.amount,
        boardAttendanceAmount: board.amount,
        otherCompensationAmount: other.amount,
        confidence,
        evidence,
      } as EconomicRightsBreakdownRow;
    })
  );

  return rows.sort((a, b) => {
    const yearDiff = (b.year || 0) - (a.year || 0);
    if (yearDiff !== 0) return yearDiff;
    return a.title.localeCompare(b.title);
  });
}

function normalizeRole(raw: string): string {
  const folded = normalizeFoldedText(raw);
  if (folded.includes("alcalde")) return "Alcaldia";
  if (folded.includes("tinent")) return "Tinencies d'alcaldia";
  if (folded.includes("regidor")) return "Regidories";
  if (folded.includes("portaveu")) return "Portaveu";
  if (folded.includes("membre corporacio") || folded.includes("corporacio")) return "Membres corporacio";
  return "Altres carrecs";
}

function isAttendanceLine(foldedLine: string): boolean {
  return (
    foldedLine.includes("assistenc") ||
    foldedLine.includes("ple") ||
    foldedLine.includes("comissio") ||
    foldedLine.includes("junta govern") ||
    foldedLine.includes("junta de govern")
  );
}

function isFixedLine(foldedLine: string): boolean {
  return (
    foldedLine.includes("retribuc") ||
    foldedLine.includes("dedicacio") ||
    foldedLine.includes("sou") ||
    foldedLine.includes("salari") ||
    foldedLine.includes("anual")
  );
}

export async function fetchEconomicRightsRoleComparison(
  docs: EconomicRightsDocument[],
  limit = 10
): Promise<EconomicRightsRoleComparisonRow[]> {
  const parseCandidates = docs
    .filter((doc) => doc.category === "fixa" || doc.category === "assistencies")
    .slice(0, limit);

  const roleMap = new Map<
    string,
    {
      year: number;
      role: string;
      fixedAmount?: number;
      attendanceAmount?: number;
      sourceUrls: Set<string>;
      hits: number;
    }
  >();

  for (const doc of parseCandidates) {
    const year = doc.year;
    if (!year) continue;

    const text = await fetchPdfText(doc.url);
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines) {
      const folded = normalizeFoldedText(line);
      if (!folded.includes("alcalde") && !folded.includes("regidor") && !folded.includes("tinent") && !folded.includes("portaveu") && !folded.includes("corporacio")) {
        continue;
      }

      const amounts = extractAmountsFromLine(line);
      if (amounts.length === 0) continue;
      const amount = Math.max(...amounts);
      const role = normalizeRole(line);
      const key = `${year}-${role}`;
      const existing =
        roleMap.get(key) ||
        {
          year,
          role,
          sourceUrls: new Set<string>(),
          hits: 0,
        };

      if (isAttendanceLine(folded)) {
        existing.attendanceAmount = Math.max(existing.attendanceAmount || 0, amount);
      }
      if (isFixedLine(folded)) {
        existing.fixedAmount = Math.max(existing.fixedAmount || 0, amount);
      }
      if (!isAttendanceLine(folded) && !isFixedLine(folded)) {
        existing.fixedAmount = Math.max(existing.fixedAmount || 0, amount);
      }

      existing.sourceUrls.add(doc.url);
      existing.hits += 1;
      roleMap.set(key, existing);
    }
  }

  return Array.from(roleMap.values())
    .map((row) => {
      const totalEstimatedAmount = (row.fixedAmount || 0) + (row.attendanceAmount || 0);
      const confidence: "alta" | "mitjana" | "baixa" =
        row.fixedAmount && row.attendanceAmount ? "alta" : row.hits >= 2 ? "mitjana" : "baixa";
      return {
        year: row.year,
        role: row.role,
        fixedAmount: row.fixedAmount,
        attendanceAmount: row.attendanceAmount,
        totalEstimatedAmount: totalEstimatedAmount > 0 ? totalEstimatedAmount : undefined,
        sourceDocs: row.sourceUrls.size,
        confidence,
      } as EconomicRightsRoleComparisonRow;
    })
    .sort((a, b) => {
      const yearDiff = b.year - a.year;
      if (yearDiff !== 0) return yearDiff;
      return (b.totalEstimatedAmount || 0) - (a.totalEstimatedAmount || 0);
    });
}

export async function fetchEconomicRightsAnnualOverview(
  docs: EconomicRightsDocument[],
  limit = 12
): Promise<EconomicRightsAnnualOverviewRow[]> {
  const parseCandidates = docs
    .filter((doc) => doc.category === "fixa" || doc.category === "assistencies")
    .slice(0, limit);

  const yearMap = new Map<number, EconomicRightsAnnualOverviewRow>();

  for (const doc of parseCandidates) {
    const text = await fetchPdfText(doc.url);
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const coverageYears = new Set<number>([
      ...(doc.year ? [doc.year] : []),
      ...extractCoverageYearsFromText(text),
    ]);
    if (coverageYears.size === 0 && doc.year) coverageYears.add(doc.year);

    const budgetByYear = extractBudgetByYear(lines);
    const attendance = extractAttendanceRates(lines);
    const fixedRef = extractFixedAnnualReference(lines);

    for (const year of coverageYears) {
      const existing =
        yearMap.get(year) ||
        {
          year,
          status: "cobert",
          sourceDocs: 0,
        };

      existing.sourceDocs += 1;
      if (fixedRef && !existing.fixedAnnualReference) {
        existing.fixedAnnualReference = fixedRef;
      }
      if (attendance.ple && !existing.attendancePlePerSession) {
        existing.attendancePlePerSession = attendance.ple;
      }
      if (attendance.comissio && !existing.attendanceComissioPerSession) {
        existing.attendanceComissioPerSession = attendance.comissio;
      }
      if (attendance.junta && !existing.attendanceJuntaPerSession) {
        existing.attendanceJuntaPerSession = attendance.junta;
      }

      const budget = budgetByYear.get(year);
      if (budget?.retribucions) existing.budgetRetribucions = budget.retribucions;
      if (budget?.assistencies) existing.budgetAssistencies = budget.assistencies;

      const hasPublishedData =
        Boolean(existing.fixedAnnualReference) ||
        Boolean(existing.attendancePlePerSession) ||
        Boolean(existing.attendanceComissioPerSession) ||
        Boolean(existing.attendanceJuntaPerSession) ||
        Boolean(existing.budgetRetribucions) ||
        Boolean(existing.budgetAssistencies);
      existing.status = hasPublishedData ? "publicat" : "cobert";

      yearMap.set(year, existing);
    }
  }

  return Array.from(yearMap.values()).sort((a, b) => b.year - a.year);
}

export async function fetchOfficialsWithSalaries(limit = 30): Promise<OfficialSalary[]> {
  const res = await fetch(OFFICIAL_SOURCES.officialsAndSalaries, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const officials = parseOfficialList(html).slice(0, limit);

  const details = await Promise.all(
    officials.map(async (official) => {
      try {
        const detailRes = await fetch(official.fitxaUrl, {
          next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!detailRes.ok) {
          return {
            id: official.id,
            nom: official.nom,
            carrec: "Carrec public",
            fitxaUrl: official.fitxaUrl,
          } as OfficialSalary;
        }
        const detailHtml = await detailRes.text();
        const parsed = parseOfficialDetail(detailHtml);
        let salary = parsed.retribucioAnualBruta;
        if (!salary && parsed.documentRetribucioUrl) {
          const pdfText = await fetchPdfText(parsed.documentRetribucioUrl);
          const pdfLines = pdfText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          salary = extractFixedAnnualReference(pdfLines);
        }
        return {
          id: official.id,
          nom: official.nom,
          fitxaUrl: official.fitxaUrl,
          ...parsed,
          retribucioAnualBruta: salary,
        } as OfficialSalary;
      } catch {
        return {
          id: official.id,
          nom: official.nom,
          carrec: "Carrec public",
          fitxaUrl: official.fitxaUrl,
        } as OfficialSalary;
      }
    })
  );

  return details.sort((a, b) => (b.retribucioAnualBruta || 0) - (a.retribucioAnualBruta || 0));
}

export async function fetchTransparencyContracts(limit = 25): Promise<TransparencyContract[]> {
  const { records } = await ckanFetch(
    AOC_RESOURCE_IDS.contracts,
    { CODI_INE10: Number(SANT_SADURNI_CODI_ENS) },
    limit,
    0,
    "DATA_PUBLICACIO_ANUNCI desc"
  );
  const mapped = records.map((row) => ({
    codiExpedient: toStringValue(row.CODI_EXPEDIENT),
    denominacio: toStringValue(row.DENOMINACIO),
    adjudicatari: toStringValue(row.DENOMINACIO_ADJUDICATARI),
    importAmbIva: toNumber(row.IMPORT_ADJUDICACIO_AMB_IVA),
    dataPublicacio: toStringValue(row.DATA_PUBLICACIO_ANUNCI),
    enllacPublicacio: toStringValue(row.ENLLAC_PUBLICACIO),
    procediment: toStringValue(row.PROCEDIMENT),
  }));

  return mapped.sort((a, b) => {
    const aTs = parseDateToTimestamp(a.dataPublicacio);
    const bTs = parseDateToTimestamp(b.dataPublicacio);
    if (aTs !== bTs) return bTs - aTs;
    return (b.codiExpedient || "").localeCompare(a.codiExpedient || "");
  });
}

export async function fetchBudgetLines(limit = 30): Promise<TransparencyBudgetLine[]> {
  const { records } = await ckanFetch(
    AOC_RESOURCE_IDS.budgetByProgram,
    { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) },
    1000,
    0,
    "ANY_EXERCICI desc"
  );
  const years = records.map((r) => Number(r.ANY_EXERCICI || 0)).filter((y) => y > 0);
  const latestYear = years.length > 0 ? Math.max(...years) : undefined;
  const filtered = records
    .filter((r) => Number(r.ANY_EXERCICI || 0) === latestYear)
    .map((row) => ({
      anyExercici: Number(row.ANY_EXERCICI || 0),
      descripcio: toStringValue(row.DESCRIPCIO),
      import: toNumber(row.IMPORT),
      tipusPartida: toStringValue(row.TIPUS_PARTIDA),
      nivell: Number(row.NIVELL || 0),
    }))
    .filter((r) => r.nivell === 1)
    .sort((a, b) => b.import - a.import)
    .slice(0, limit);
  return filtered;
}

export async function fetchSubsidies(limit = 50): Promise<TransparencySubsidy[]> {
  const { records } = await ckanFetch(
    AOC_RESOURCE_IDS.subsidiesGranted,
    { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) },
    limit,
    0,
    "DATA_DE_CONCESSIO desc"
  );
  return records.map((row) => ({
    dataConcessio: toStringValue(row.DATA_DE_CONCESSIO),
    titol: toStringValue(row.TITOL),
    beneficiari: toStringValue(row.BENEFICIARI),
    import: toNumber(row.IMPORT),
    basesReguladores: toStringValue(row.BASES_REGULADORES),
  }));
}

async function fetchSubsidiesCatalog(limit = 2500): Promise<SubsidyExplorerItem[]> {
  const chunkSize = 1000;
  let offset = 0;
  let allRows: SubsidyExplorerItem[] = [];

  while (offset < limit) {
    const { records, total } = await ckanFetch(
      AOC_RESOURCE_IDS.subsidiesGranted,
      { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) },
      Math.min(chunkSize, limit - offset),
      offset,
      "DATA_DE_CONCESSIO desc"
    );

    const chunk = records.map((row) => {
      const dataConcessio = toStringValue(row.DATA_DE_CONCESSIO);
      return {
        dataConcessio,
        anyConcessio: parseYearFromDate(dataConcessio),
        titol: toStringValue(row.TITOL),
        beneficiari: toStringValue(row.BENEFICIARI),
        import: toNumber(row.IMPORT),
        basesReguladores: toStringValue(row.BASES_REGULADORES),
      } as SubsidyExplorerItem;
    });

    allRows = allRows.concat(chunk);
    offset += chunk.length;
    if (chunk.length === 0 || offset >= total) break;
  }

  return allRows;
}

export async function fetchSubsidiesExplorer(
  filters: SubsidyExplorerFilters = {}
): Promise<{ data: SubsidyExplorerItem[]; total: number }> {
  const {
    year,
    search,
    beneficiari,
    amountMin,
    amountMax,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = filters;
  const minAmount = amountMin ? toNumber(amountMin) : undefined;
  const maxAmount = amountMax ? toNumber(amountMax) : undefined;
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;

  const catalog = await fetchSubsidiesCatalog();
  const searchNorm = (search || "").trim().toLowerCase();
  const beneficiariNorm = (beneficiari || "").trim().toLowerCase();

  const filtered = catalog.filter((row) => {
    if (year && String(row.anyConcessio || "") !== year) return false;
    if (minAmount !== undefined && row.import < minAmount) return false;
    if (maxAmount !== undefined && row.import > maxAmount) return false;
    if (beneficiariNorm && !row.beneficiari.toLowerCase().includes(beneficiariNorm)) return false;
    if (searchNorm) {
      const target = `${row.titol} ${row.beneficiari}`.toLowerCase();
      if (!target.includes(searchNorm)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const yearDiff = (b.anyConcessio || 0) - (a.anyConcessio || 0);
    if (yearDiff !== 0) return yearDiff;
    const amountDiff = b.import - a.import;
    if (amountDiff !== 0) return amountDiff;
    return b.dataConcessio.localeCompare(a.dataConcessio);
  });

  const start = (safePage - 1) * safePageSize;
  const data = filtered.slice(start, start + safePageSize);
  return { data, total: filtered.length };
}

export async function fetchSubsidiesRanking(
  filters: Pick<SubsidyExplorerFilters, "year" | "search"> = {},
  limit = 15
): Promise<SubsidyExplorerRankingRow[]> {
  const catalog = await fetchSubsidiesCatalog();
  const searchNorm = (filters.search || "").trim().toLowerCase();

  const filtered = catalog.filter((row) => {
    if (filters.year && String(row.anyConcessio || "") !== filters.year) return false;
    if (searchNorm) {
      const target = `${row.titol} ${row.beneficiari}`.toLowerCase();
      if (!target.includes(searchNorm)) return false;
    }
    return Boolean(row.beneficiari);
  });

  const agg = new Map<string, { totalAmount: number; count: number }>();
  for (const row of filtered) {
    const key = row.beneficiari;
    const current = agg.get(key) || { totalAmount: 0, count: 0 };
    current.totalAmount += row.import;
    current.count += 1;
    agg.set(key, current);
  }

  return Array.from(agg.entries())
    .map(([beneficiari, values]) => ({
      beneficiari,
      totalAmount: values.totalAmount,
      count: values.count,
    }))
    .sort((a, b) => {
      const amountDiff = b.totalAmount - a.totalAmount;
      if (amountDiff !== 0) return amountDiff;
      return b.count - a.count;
    })
    .slice(0, limit);
}

export async function fetchSubsidiesAvailableYears(): Promise<string[]> {
  const catalog = await fetchSubsidiesCatalog();
  const years = Array.from(
    new Set(
      catalog
        .map((row) => row.anyConcessio)
        .filter((year): year is number => typeof year === "number")
    )
  ).sort((a, b) => b - a);
  return years.map(String);
}

export async function fetchAgreements(limit = 50): Promise<TransparencyAgreement[]> {
  const { records } = await ckanFetch(
    AOC_RESOURCE_IDS.cooperationAgreements,
    { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) },
    limit,
    0,
    "DATA_SIGNATURA desc"
  );
  return records.map((row) => ({
    anySignatura: Number(row.ANY_SIGNATURA || 0),
    titol: toStringValue(row.TITOL_CONVENI),
    totalAportacions: toNumber(row.TOTAL_APORTACIONS_PREVISTES),
    dataSignatura: toStringValue(row.DATA_SIGNATURA),
    vigent: toStringValue(row.VIGENT),
    pdfConveni: toStringValue(row.PDF_CONVENI),
  }));
}

export async function fetchPlenaryMinutes(limit = 30): Promise<TransparencyPlenaryMinute[]> {
  const { records } = await ckanFetch(
    AOC_RESOURCE_IDS.plenaryMinutes,
    { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) },
    limit,
    0,
    "DATA_ACORD desc"
  );
  return records.map((row) => {
    const enllac = toStringValue(row["ENLLAÇ_ACTA"] || row.ENLLA_ACTA);
    return {
      dataAcord: toStringValue(row.DATA_ACORD),
      tipus: toStringValue(row.TIPUS),
      enllacActa: enllac,
      codiActa: toStringValue(row.CODI_ACTA),
    };
  });
}

export async function fetchTransparencySummary(): Promise<TransparencySummary> {
  const [contractsResp, totalContracts, totalContractsAmount, subsidiesResp, agreementsResp, plenaryResp, budgetResp, officials] =
    await Promise.all([
      ckanFetch(AOC_RESOURCE_IDS.contracts, { CODI_INE10: Number(SANT_SADURNI_CODI_ENS) }, 1),
      fetchTotalContracts(),
      fetchTotalAmount(),
      ckanFetch(AOC_RESOURCE_IDS.subsidiesGranted, { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) }, 500),
      ckanFetch(
        AOC_RESOURCE_IDS.cooperationAgreements,
        { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) },
        500
      ),
      ckanFetch(AOC_RESOURCE_IDS.plenaryMinutes, { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) }, 1),
      ckanFetch(AOC_RESOURCE_IDS.budgetByProgram, { CODI_ENS: Number(SANT_SADURNI_CODI_ENS) }, 1000),
      fetchOfficialsWithSalaries(40),
    ]);
  const subsidiesAmount = subsidiesResp.records.reduce((acc, row) => acc + toNumber(row.IMPORT), 0);
  const agreementsAmount = agreementsResp.records.reduce(
    (acc, row) => acc + toNumber(row.TOTAL_APORTACIONS_PREVISTES),
    0
  );

  const budgetLines = budgetResp.records.map((r) => ({
    year: Number(r.ANY_EXERCICI || 0),
    amount: toNumber(r.IMPORT),
    tipus: toStringValue(r.TIPUS_PARTIDA),
    nivell: Number(r.NIVELL || 0),
  }));
  const currentBudgetYear = budgetLines.length > 0 ? Math.max(...budgetLines.map((r) => r.year)) : undefined;
  const currentBudgetAmount = currentBudgetYear
    ? budgetLines
      .filter((r) => r.year === currentBudgetYear && r.tipus === "D" && r.nivell === 1)
      .reduce((acc, r) => acc + r.amount, 0)
    : undefined;

  return {
    contractsTotal: Math.max(contractsResp.total, totalContracts),
    contractsAmount: totalContractsAmount,
    subsidiesTotal: subsidiesResp.total,
    subsidiesAmount,
    agreementsTotal: agreementsResp.total,
    agreementsAmount,
    plenaryMinutesTotal: plenaryResp.total,
    currentBudgetYear,
    currentBudgetAmount,
    officialsWithSalary: officials.filter((o) => (o.retribucioAnualBruta || 0) > 0).length,
  };
}

export function buildTraceabilityAlerts(args: {
  contracts: TransparencyContract[];
  subsidies: TransparencySubsidy[];
  agreements: TransparencyAgreement[];
  officials: OfficialSalary[];
}): TraceabilityAlert[] {
  const { contracts, subsidies, agreements, officials } = args;
  const alerts: TraceabilityAlert[] = [];

  for (const contract of contracts) {
    let score = 0;
    const reasons: string[] = [];
    if (hasValue(contract.codiExpedient)) score += 1;
    else reasons.push("Sense codi d'expedient");
    if (hasValue(contract.enllacPublicacio)) score += 1;
    else reasons.push("Sense enllac a publicacio oficial");
    if (hasValue(contract.adjudicatari)) score += 1;
    else reasons.push("Sense adjudicatari informat");
    if ((contract.importAmbIva || 0) > 0) score += 1;
    else reasons.push("Sense import adjudicat");

    alerts.push({
      id: `contract-${contract.codiExpedient || contract.denominacio}`,
      section: "contractes",
      title: contract.denominacio || contract.codiExpedient || "Contracte",
      date: contract.dataPublicacio,
      amount: contract.importAmbIva,
      level: resolveTraceabilityLevel(score),
      reasons,
      sourceUrl: contract.enllacPublicacio || undefined,
    });
  }

  for (const subsidy of subsidies) {
    let score = 0;
    const reasons: string[] = [];
    if (hasValue(subsidy.titol)) score += 1;
    else reasons.push("Sense titol");
    if (hasValue(subsidy.beneficiari)) score += 1;
    else reasons.push("Sense beneficiari");
    if ((subsidy.import || 0) > 0) score += 1;
    else reasons.push("Sense import");
    if (hasValue(subsidy.basesReguladores)) score += 1;
    else reasons.push("Sense base reguladora");

    alerts.push({
      id: `subsidy-${subsidy.titol}-${subsidy.dataConcessio}`,
      section: "subvencions",
      title: subsidy.titol || "Subvencio",
      date: subsidy.dataConcessio,
      amount: subsidy.import,
      level: resolveTraceabilityLevel(score),
      reasons,
      sourceUrl: subsidy.basesReguladores || undefined,
    });
  }

  for (const agreement of agreements) {
    let score = 0;
    const reasons: string[] = [];
    if (hasValue(agreement.titol)) score += 1;
    else reasons.push("Sense titol de conveni");
    if (hasValue(agreement.pdfConveni)) score += 1;
    else reasons.push("Sense PDF de conveni");
    if (hasValue(agreement.dataSignatura)) score += 1;
    else reasons.push("Sense data de signatura");
    if ((agreement.totalAportacions || 0) > 0) score += 1;
    else reasons.push("Sense aportacio economica informada");

    alerts.push({
      id: `agreement-${agreement.titol}-${agreement.dataSignatura}`,
      section: "convenis",
      title: agreement.titol || "Conveni",
      date: agreement.dataSignatura,
      amount: agreement.totalAportacions,
      level: resolveTraceabilityLevel(score),
      reasons,
      sourceUrl: agreement.pdfConveni || undefined,
    });
  }

  for (const official of officials) {
    let score = 0;
    const reasons: string[] = [];
    if (hasValue(official.nom)) score += 1;
    else reasons.push("Sense nom");
    if (hasValue(official.carrec)) score += 1;
    else reasons.push("Sense carrec");
    if ((official.retribucioAnualBruta || 0) > 0) score += 1;
    else reasons.push("Sense retribucio anual publicada");
    if (hasValue(official.documentRetribucioUrl)) score += 1;
    else reasons.push("Sense document public de retribucio");

    alerts.push({
      id: `official-${official.id}`,
      section: "carrecs",
      title: `${official.nom} - ${official.carrec || "Carrec"}`,
      level: resolveTraceabilityLevel(score),
      reasons,
      sourceUrl: official.fitxaUrl,
    });
  }

  return alerts.sort((a, b) => {
    const priority = { baixa: 0, mitjana: 1, alta: 2 } as const;
    const priorityDiff = priority[a.level] - priority[b.level];
    if (priorityDiff !== 0) return priorityDiff;
    return (b.date || "").localeCompare(a.date || "");
  });
}
