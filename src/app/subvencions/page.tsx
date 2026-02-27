import type { Metadata } from "next";
import SubvencionsExplorer from "./SubvencionsExplorer";
import {
  fetchSubsidiesAvailableYears,
  fetchSubsidiesExplorer,
  fetchSubsidiesRanking,
} from "@/lib/transparency";

export const metadata: Metadata = {
  title: "Subvencions",
  description:
    "Explorador de subvencions municipals de Sant Sadurni d'Anoia amb cercador, ranking de beneficiaris i exportacio CSV.",
};

interface Props {
  searchParams: Promise<{
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
  const filters = {
    year: (params.year || "").trim(),
    search: (params.search || "").trim(),
    beneficiari: (params.beneficiari || "").trim(),
    amountMin: (params.amountMin || "").trim(),
    amountMax: (params.amountMax || "").trim(),
  };
  const parsedPage = parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [list, ranking, availableYears] = await Promise.all([
    fetchSubsidiesExplorer({ ...filters, page }),
    fetchSubsidiesRanking({ year: filters.year || undefined, search: filters.search || undefined }, 10),
    fetchSubsidiesAvailableYears(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Subvencions</h1>
      <p className="mb-6 text-gray-600">
        Cercador i ranquing de subvencions municipals amb dades oficials de Sant Sadurni d&apos;Anoia.
      </p>

      <SubvencionsExplorer
        initialFilters={filters}
        initialPage={page}
        initialData={list.data}
        initialTotal={list.total}
        initialRanking={ranking}
        initialYearOptions={availableYears}
      />
    </div>
  );
}
