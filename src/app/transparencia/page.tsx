import type { Metadata } from "next";
import Link from "next/link";
import {
  OFFICIAL_SOURCES,
  SITE_NAME,
  SITE_URL,
  MUNICIPAL_SCOPE_ORGAN,
  MUNICIPAL_SCOPE_EXECUTION,
} from "@/config/constants";
import {
  fetchCcapCompensationsForOfficials,
  fetchAgreements,
  fetchBudgetLines,
  fetchOfficialsWithSalaries,
  getExternalSalaryChecks,
  getPublishedSalaryYears,
  fetchPlenaryMinutes,
  fetchSubsidies,
  fetchTransparencyContracts,
  fetchTransparencySummary,
} from "@/lib/transparency";
import {
  fetchMinorBandSummary,
  fetchMinorShareYearly,
  fetchTopCompaniesInMinorRiskBand,
} from "@/lib/api";
import { formatCompactNumber, formatCurrencyFull, formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Portal de transparencia ciutadana",
  description:
    "Portal ciutadà de Sant Sadurni d'Anoia amb contractes, retribucions publiques, subvencions, convenis i pressupost municipal.",
  alternates: { canonical: "/transparencia" },
  openGraph: {
    title: "Portal de transparencia ciutadana | Sant Sadurni d'Anoia",
    description:
      "Consulta dades publiques municipals de Sant Sadurni d'Anoia amb tracabilitat a les fonts oficials.",
    url: `${SITE_URL}/transparencia`,
    siteName: SITE_NAME,
  },
};

const SOURCE_ITEMS = [
  { label: "Retribucions i carrecs", href: OFFICIAL_SOURCES.officialsAndSalaries },
  { label: "Drets economics carrecs electes", href: OFFICIAL_SOURCES.economicRights },
  { label: "Pressupost", href: OFFICIAL_SOURCES.budget },
  { label: "Execucio pressupostaria", href: OFFICIAL_SOURCES.budgetExecution },
  { label: "Contractacio publica (PSCP)", href: OFFICIAL_SOURCES.pscpProfile },
  { label: "Subvencions atorgades", href: OFFICIAL_SOURCES.subsidiesGranted },
  { label: "Convocatories", href: OFFICIAL_SOURCES.subsidiesCalls },
  { label: "Convenis", href: OFFICIAL_SOURCES.cooperationAgreements },
  { label: "Actes de ple", href: OFFICIAL_SOURCES.plenaryMinutes },
  { label: "Decrets i resolucions", href: OFFICIAL_SOURCES.decrees },
];

const MAX_ASSISTENCIA_REGIDOR_2023_2027 = 7920;
const MAX_ASSISTENCIA_TINENT_2023_2027 = 18960;
const CCAP_SOURCE_URL =
  "https://seu-e.cat/ca/web/ccaltpenedes/govern-obert-i-transparencia/informacio-institucional-i-organitzativa/organitzacio-politica-i-retribucions/retribucions-i-indemnitzacions-dels/les-consellers/es-i-dels-grups-politics-234";
const CCAP_VERIFIED_OFFICIALS = [
  ["pedro", "campos", "osuna"],
  ["marta", "castellvi", "chacon"],
  ["ton", "amat", "ibanez"],
  ["anton", "amat", "ibanez"],
];

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRoleForDisplay(role: string): string {
  const normalized = role.toLowerCase();
  if (normalized.includes("alcald")) return "Alcalde/ssa";
  if (normalized.includes("tinent")) return "Tinent d'alcaldia / regidor/a";
  if (normalized.includes("regidor")) return role;
  return "Regidor/a";
}

function isVerifiedCcapOfficial(normalizedName: string): boolean {
  const tokens = normalizedName.split(" ").filter(Boolean);
  return CCAP_VERIFIED_OFFICIALS.some((requiredTokens) =>
    requiredTokens.every((token) => tokens.includes(token))
  );
}

function estimateMaxAttendanceByRole(displayRole: string): number {
  const role = displayRole.toLowerCase();
  if (role.includes("tinent")) return MAX_ASSISTENCIA_TINENT_2023_2027;
  return MAX_ASSISTENCIA_REGIDOR_2023_2027;
}

interface Props {
  searchParams?: Promise<Record<string, string | undefined>>;
}

export default async function TransparenciaPage({ searchParams }: Props) {
  if (searchParams) await searchParams;
  const salaryYears = getPublishedSalaryYears();
  const externalSalaryChecks = getExternalSalaryChecks();

  const [
    summary,
    officials,
    subsidies,
    agreements,
    contracts,
    budgetLines,
    plenaryMinutes,
    minorBandSummary,
    minorShareYearly,
    topMinorRiskCompanies,
  ] =
    await Promise.all([
      fetchTransparencySummary(),
      fetchOfficialsWithSalaries(18),
      fetchSubsidies(12),
      fetchAgreements(12),
      fetchTransparencyContracts(12),
      fetchBudgetLines(12),
      fetchPlenaryMinutes(12),
      fetchMinorBandSummary(),
      fetchMinorShareYearly(),
      fetchTopCompaniesInMinorRiskBand(6),
    ]);

  const minorRiskShare =
    minorBandSummary.total_minor_under_15k > 0
      ? (minorBandSummary.risk_band_14900_15000 / minorBandSummary.total_minor_under_15k) * 100
      : 0;

  const yearlyMinorMap = new Map(minorShareYearly.map((row) => [Number(row.year), row]));
  const completeMinorYears = Array.from({ length: 8 }, (_, idx) => 2018 + idx).map((year) => {
    const row = yearlyMinorMap.get(year);
    return {
      year,
      minor: row?.minor_contracts || 0,
      total: row?.total_contracts || 0,
    };
  });

  const ccapSupplements = await fetchCcapCompensationsForOfficials(officials.map((o) => o.nom));

  const officialRows = officials.map((official) => {
    const normalizedName = normalizeName(official.nom);
    const ccapSupplement = isVerifiedCcapOfficial(normalizedName)
      ? ccapSupplements[normalizedName] || 0
      : 0;
    const displayRole = normalizeRoleForDisplay(official.carrec || "");
    const hasFixedSalary = Boolean(official.retribucioAnualBruta && official.retribucioAnualBruta > 0);
    const attendanceMaxEstimate = estimateMaxAttendanceByRole(displayRole);
    const municipalBase = hasFixedSalary ? official.retribucioAnualBruta || 0 : attendanceMaxEstimate;
    const totalSalary = municipalBase + ccapSupplement;
    const notes = [
      hasFixedSalary
        ? "Base municipal: dedicacio fixa publicada"
        : displayRole.toLowerCase().includes("tinent")
          ? "Base municipal: assistencia maxima estimada (Ple+Portaveus+Comissions+Junta)"
          : "Base municipal: assistencia maxima estimada (Ple+Portaveus+Comissions)",
      ccapSupplement > 0 ? "Inclou import del Consell Comarcal" : "Sense import extern verificat",
    ];

    return {
      ...official,
      displayRole,
      ccapSupplement,
      municipalBase,
      totalSalary,
      notes,
      hasFixedSalary,
    };
  }).sort((a, b) => b.totalSalary - a.totalSalary);

  const recentContracts = [...contracts].sort((a, b) => {
    const aTs = Date.parse(a.dataPublicacio || "") || 0;
    const bTs = Date.parse(b.dataPublicacio || "") || 0;
    if (aTs !== bTs) return bTs - aTs;
    return (b.codiExpedient || "").localeCompare(a.codiExpedient || "");
  });


  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Portal de transparencia ciutadana</h1>
        <p className="mt-2 text-sm text-gray-600">
          Dades oficials de <span className="font-medium text-gray-900">{MUNICIPAL_SCOPE_ORGAN}</span> amb cobertura de
          contractes executats a <span className="font-medium text-gray-900">{MUNICIPAL_SCOPE_EXECUTION}</span>.
        </p>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Contractes</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{formatNumber(summary.contractsTotal)}</p>
          <p className="mt-1 text-xs text-gray-500">{formatCompactNumber(summary.contractsAmount)} acumulats</p>
        </article>
        <article className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Subvencions</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{formatNumber(summary.subsidiesTotal)}</p>
          <p className="mt-1 text-xs text-gray-500">{formatCompactNumber(summary.subsidiesAmount)} concedits</p>
        </article>
        <article className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Convenis</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{formatNumber(summary.agreementsTotal)}</p>
          <p className="mt-1 text-xs text-gray-500">{formatCompactNumber(summary.agreementsAmount)} previstos</p>
        </article>
        <article className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pressupost</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {summary.currentBudgetYear ? String(summary.currentBudgetYear) : "N/A"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {summary.currentBudgetAmount ? formatCompactNumber(summary.currentBudgetAmount) : "Sense dada agregada"}
          </p>
        </article>
      </section>

      <section className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Lectura responsable de les dades</p>
        <p className="mt-1">
          Aquest portal mostra dades publiques i documents oficials. Per rigor juridic, parlem de baixa tracabilitat
          o manca de detall quan la documentacio no permet una auditoria fina.
        </p>
      </section>

      <section className="mb-10 rounded-lg border border-rose-200 bg-rose-50/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-rose-900">Alertes ciutadanes de risc</h2>
          <Link href="/analisi" className="text-xs text-rose-800 underline hover:text-rose-900">
            Veure analisi completa
          </Link>
        </div>
        <p className="mb-3 text-xs text-rose-900">
          Analitzem la franja 14.900-15.000 EUR (sense IVA) perque es la mes propera al limit legal del contracte menor
          de serveis/subministraments (15.000 EUR). Aquesta alerta es un indicador de risc, no una prova d&apos;irregularitat.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-md border border-rose-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-rose-700">Concentracio prop del llindar</p>
            <p className="mt-1 text-xl font-semibold text-rose-900">{minorRiskShare.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-rose-800">Contractes menors entre 14.900 i 15.000 EUR sobre el total de menors &lt;15.000.</p>
          </article>
          <article className="rounded-md border border-rose-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-rose-700">Volum en banda de risc</p>
            <p className="mt-1 text-xl font-semibold text-rose-900">{formatNumber(minorBandSummary.risk_band_14900_15000)}</p>
            <p className="mt-1 text-xs text-rose-800">{formatCurrencyFull(minorBandSummary.risk_band_14900_15000_amount)} en adjudicacions.</p>
          </article>
          <article className="rounded-md border border-rose-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-rose-700">Total contractes menors</p>
            <p className="mt-1 text-xl font-semibold text-rose-900">{formatNumber(minorBandSummary.total_minor_under_15k)}</p>
            <p className="mt-1 text-xs text-rose-800">Base de comparacio del municipi en l&apos;ambit actual.</p>
          </article>
        </div>
        <div className="mt-4 rounded-md border border-rose-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">Empreses amb mes contractes en banda de risc</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {topMinorRiskCompanies.map((company, idx) => (
              <article key={`${company.identificacio_adjudicatari}-${idx}`} className="rounded border border-gray-100 p-2">
                <p className="text-sm font-medium text-gray-900">{company.denominacio_adjudicatari || "Empresa"}</p>
                <p className="text-xs text-gray-600">{company.identificacio_adjudicatari || "Sense NIF"}</p>
                <p className="mt-1 text-xs text-gray-700">
                  {formatNumber(company.num_contracts)} contractes · {formatCurrencyFull(company.total)} (sense IVA)
                </p>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-md border border-rose-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
            Contractes menors per any (2018-2025)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-2">Any</th>
                  <th className="py-2 pr-2 text-right">Menors</th>
                  <th className="py-2 text-right">Total contractes</th>
                </tr>
              </thead>
              <tbody>
                {completeMinorYears.map((row) => (
                  <tr key={row.year} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 pr-2 text-gray-800">{row.year}</td>
                    <td className="py-2 pr-2 text-right font-mono text-gray-900">{formatNumber(row.minor)}</td>
                    <td className="py-2 text-right font-mono text-gray-900">{formatNumber(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Carrecs i retribucions</h2>
          <p className="mt-1 text-xs text-gray-500">
            Salari total estimat: base municipal (fixa publicada o assistencia maxima quan no hi ha fixa) + import verificat del Consell Comarcal quan aplica.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-2">Nom</th>
                  <th className="py-2 pr-2">Carrec</th>
                  <th className="py-2 text-right">Base i complements</th>
                  <th className="py-2 text-right">Salari total</th>
                  <th className="py-2 pl-4 text-right">Notes i evidencia</th>
                </tr>
              </thead>
              <tbody>
                {officialRows.map((o, idx) => (
                  <tr key={o.id} className={`border-b border-gray-100 align-top last:border-b-0 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                    <td className="py-2 pr-2">
                      <a href={o.fitxaUrl} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">
                        {o.nom}
                      </a>
                    </td>
                    <td className="py-2 pr-2 text-gray-700">{o.displayRole}</td>
                    <td className="py-2 pl-2 text-right text-xs whitespace-nowrap">
                      <div className="font-mono text-gray-900">{formatCurrencyFull(o.municipalBase)}</div>
                      {o.ccapSupplement > 0 ? (
                        <div className="font-mono text-emerald-700">+ {formatCurrencyFull(o.ccapSupplement)} <span className="font-sans text-[10px] uppercase tracking-wide">Consell</span></div>
                      ) : null}
                    </td>
                    <td className="py-2 pl-2 text-right font-mono text-xs text-gray-900 whitespace-nowrap">
                      {formatCurrencyFull(o.totalSalary)}
                    </td>
                    <td className="py-2 pl-4 text-right text-xs">
                      <div className="text-gray-600">{o.notes[0]}</div>
                      <div className="text-gray-600">{o.notes[1]}</div>
                      {o.documentRetribucioUrl ? (
                        <a href={o.documentRetribucioUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">
                          Document municipal
                        </a>
                      ) : null}
                      {o.ccapSupplement > 0 ? (
                        <div>
                          <a href={CCAP_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">
                            Font Consell Comarcal
                          </a>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Subvencions recents</h2>
          <div className="mt-3 space-y-3">
            {subsidies.map((s, idx) => (
              <article key={`${s.titol}-${idx}`} className="rounded-md border border-gray-100 p-3">
                <p className="text-xs text-gray-500">{formatDate(s.dataConcessio)}</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{s.titol || "Sense titol"}</p>
                <p className="mt-1 text-xs text-gray-600">{s.beneficiari || "Beneficiari no informat"}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-gray-900">{formatCurrencyFull(s.import)}</span>
                  {s.basesReguladores ? (
                    <a href={s.basesReguladores} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 underline">
                      Base reguladora
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-10 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <h2 className="text-lg font-semibold text-blue-900">Salaris publicats per any (evidencia oficial)</h2>
        <p className="mt-1 text-xs text-blue-900">
          Aquesta taula mostra només imports i canvis localitzats en acords/decrets/BOP publicats. No inclou estimacions.
        </p>
        <div className="mt-3 overflow-x-auto rounded-md border border-blue-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2">Any</th>
                <th className="px-3 py-2">Estat</th>
                <th className="px-3 py-2">Retribucio fixa</th>
                <th className="px-3 py-2">Assistencies</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Fonts</th>
              </tr>
            </thead>
            <tbody>
              {salaryYears.map((row) => (
                <tr key={row.year} className="border-b border-gray-100 align-top last:border-b-0">
                  <td className="px-3 py-2 font-medium text-gray-900">{row.year}</td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        row.status === "publicat"
                          ? "bg-emerald-100 text-emerald-800"
                          : row.status === "cobert"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-800">{row.fixedPublished}</td>
                  <td className="px-3 py-2 text-xs text-gray-800">{row.attendancePublished}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{row.notes}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.sources.map((source, idx) => (
                      <a key={`${source.url}-${idx}`} href={source.url} target="_blank" rel="noopener noreferrer" className="mr-2 inline-block text-indigo-700 underline">
                        {source.label}
                      </a>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10 rounded-lg border border-teal-200 bg-teal-50/50 p-4">
        <h2 className="text-lg font-semibold text-teal-900">Comprovacio d&apos;altres salaris publics</h2>
        <p className="mt-1 text-xs text-teal-900">
          Revisio de fonts oficials sobre possibles cobraments a Diputacio de Barcelona i Consell Comarcal de l&apos;Alt Penedes.
        </p>
        <div className="mt-3 space-y-3">
          {externalSalaryChecks.map((row) => (
            <article key={row.organism} className="rounded-md border border-teal-100 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{row.organism}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    row.status === "verificable" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {row.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-700">{row.finding}</p>
              <p className="mt-1 text-xs text-gray-600">{row.notes}</p>
              <div className="mt-1 text-xs">
                {row.sources.map((source, idx) => (
                  <a key={`${source.url}-${idx}`} href={source.url} target="_blank" rel="noopener noreferrer" className="mr-2 inline-block text-indigo-700 underline">
                    {source.label}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Convenis amb impacte economic</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Conveni</th>
                  <th className="py-2 text-right">Aportacio</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((a, idx) => (
                  <tr key={`${a.titol}-${idx}`} className="border-b border-gray-100 align-top last:border-b-0">
                    <td className="py-2 pr-2 text-xs text-gray-600">{formatDate(a.dataSignatura)}</td>
                    <td className="py-2 pr-2 text-gray-800">
                      {a.pdfConveni ? (
                        <a href={a.pdfConveni} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {a.titol}
                        </a>
                      ) : (
                        a.titol
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-xs text-gray-900">{formatCurrencyFull(a.totalAportacions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Pressupost per programes (ultim exercici)</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-2">Concepte</th>
                  <th className="py-2 text-right">Import</th>
                </tr>
              </thead>
              <tbody>
                {budgetLines.map((line, idx) => (
                  <tr key={`${line.descripcio}-${idx}`} className="border-b border-gray-100 align-top last:border-b-0">
                    <td className="py-2 pr-2 text-gray-800">{line.descripcio}</td>
                    <td className="py-2 text-right font-mono text-xs text-gray-900">{formatCurrencyFull(line.import)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Contractes recents (PSCP)</h2>
          <div className="mt-3 space-y-3">
            {recentContracts.map((c, idx) => (
              <article key={`${c.codiExpedient}-${idx}`} className="rounded-md border border-gray-100 p-3">
                <p className="text-xs text-gray-500">{formatDate(c.dataPublicacio)} - {c.procediment || "Procediment no informat"}</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{c.denominacio || c.codiExpedient || "Contracte"}</p>
                <p className="mt-1 text-xs text-gray-600">{c.adjudicatari || "Sense adjudicatari publicat"}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-gray-900">{formatCurrencyFull(c.importAmbIva)}</span>
                  {c.enllacPublicacio ? (
                    <a href={c.enllacPublicacio} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 underline">
                      Expedient
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Actes de ple</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Tipus</th>
                  <th className="py-2">Acta</th>
                </tr>
              </thead>
              <tbody>
                {plenaryMinutes.map((m) => (
                  <tr key={m.codiActa} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 pr-2 text-xs text-gray-700">{formatDate(m.dataAcord)}</td>
                    <td className="py-2 pr-2 text-xs text-gray-700">{m.tipus || "-"}</td>
                    <td className="py-2 text-xs">
                      {m.enllacActa ? (
                        <a href={m.enllacActa} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">
                          Veure PDF
                        </a>
                      ) : (
                        "Sense enllac"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Fonts oficials</h2>
          <Link href="/about" className="text-xs text-gray-600 underline hover:text-gray-900">
            Metodologia i avis legal
          </Link>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCE_ITEMS.map((source) => (
            <li key={source.href}>
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
