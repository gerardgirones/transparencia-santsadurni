import type { Metadata } from "next";
import Link from "next/link";
import SubvencionsExplorer from "./SubvencionsExplorer";
import SubsidyCallsExplorer from "./SubsidyCallsExplorer";
import SubsidyCoverageNotice from "@/components/ui/SubsidyCoverageNotice";
import {
  fetchSubsidiesAvailableYears,
  fetchSubsidiesExplorer,
  fetchSubsidiesRanking,
  fetchSubsidiesCoverage,
} from "@/lib/transparency";

export const metadata: Metadata = {
  title: "Subvencions",
  description:
    "Convocatòries de la BDNS i concessions de subvencions de Sant Sadurní d'Anoia, amb cercador i fonts oficials.",
};

interface Props {
  searchParams: Promise<{
    view?: string;
    year?: string;
    search?: string;
    beneficiari?: string;
    amountMin?: string;
    amountMax?: string;
    page?: string;
  }>;
}

export default async function SubvencionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const isCallsView = params.view === "convocatories";
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Subvencions</h1>
      <p className="mb-5 text-gray-600">Convocatòries i concessions de subvencions de Sant Sadurní d&apos;Anoia amb fonts oficials.</p>
      <nav aria-label="Tipus d’informació de subvencions" className="mb-6 flex flex-wrap gap-2">
        <Link href="/subvencions?view=convocatories" aria-current={isCallsView ? "page" : undefined} className={`rounded-md border px-4 py-2 text-sm font-medium ${isCallsView ? "border-indigo-700 bg-indigo-700 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
          Convocatòries (BDNS)
        </Link>
        <Link href="/subvencions" aria-current={!isCallsView ? "page" : undefined} className={`rounded-md border px-4 py-2 text-sm font-medium ${!isCallsView ? "border-indigo-700 bg-indigo-700 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
          Concessions publicades
        </Link>
      </nav>
      {isCallsView ? <SubsidyCallsExplorer filters={{ year: params.year, search: params.search, page: Number(params.page) }} /> : <ConcessionsView params={params} />}
    </div>
  );
}

async function ConcessionsView({ params }: { params: Awaited<Props["searchParams"]> }) {
  const filters = {
    year: (params.year || "").trim(),
    search: (params.search || "").trim(),
    beneficiari: (params.beneficiari || "").trim(),
    amountMin: (params.amountMin || "").trim(),
    amountMax: (params.amountMax || "").trim(),
  };
  const parsedPage = parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [list, ranking, availableYears, coverage] = await Promise.all([
    fetchSubsidiesExplorer({ ...filters, page }),
    fetchSubsidiesRanking({ year: filters.year || undefined, search: filters.search || undefined }, 10),
    fetchSubsidiesAvailableYears(),
    fetchSubsidiesCoverage(),
  ]);

  return (
    <section aria-label="Concessions de subvencions publicades">
      <SubsidyCoverageNotice coverage={coverage} />
      <SubvencionsExplorer
        initialFilters={filters}
        initialPage={page}
        initialData={list.data}
        initialTotal={list.total}
        initialRanking={ranking}
        initialYearOptions={availableYears}
      />
    </section>
  );
}
