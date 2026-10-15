import type { Metadata } from "next";
import ContractExplorer from "./ContractExplorer";
import SharePageButton from "@/components/ui/SharePageButton";
import { fetchContracts, fetchContractsCount } from "@/lib/api";
import { CONTRACT_SORT_OPTIONS, isContractSortKey } from "@/lib/contract-sort";

export const metadata: Metadata = {
  title: "Explorador de contractes",
  description:
    "Explora els contractes públics de l'ambit municipal de Sant Sadurní d'Anoia amb filtres per any, tipus, procediment i import.",
};

interface Props {
  searchParams: Promise<{
    year?: string;
    tipus_contracte?: string;
    procediment?: string;
    amountMin?: string;
    amountMax?: string;
    nom_organ?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ContractesPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialFilters = {
    year: params.year || "",
    tipus_contracte: params.tipus_contracte || "",
    procediment: params.procediment || "",
    amountMin: params.amountMin || "",
    amountMax: params.amountMax || "",
    nom_organ: params.nom_organ || "",
    search: params.search || "",
    dateFrom: params.date_from || "",
    dateTo: params.date_to || "",
  };
  const initialSort = isContractSortKey(params.sort) ? params.sort : "date-desc";
  const sortOptions = CONTRACT_SORT_OPTIONS[initialSort];
  const initialPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const queryFilters = {
    year: initialFilters.year || undefined,
    tipus_contracte: initialFilters.tipus_contracte || undefined,
    procediment: initialFilters.procediment || undefined,
    amountMin: initialFilters.amountMin || undefined,
    amountMax: initialFilters.amountMax || undefined,
    nom_organ: initialFilters.nom_organ || undefined,
    search: initialFilters.search || undefined,
    dateFrom: initialFilters.dateFrom || undefined,
    dateTo: initialFilters.dateTo || undefined,
  };

  const [initialContracts, initialTotal] = await Promise.all([
    fetchContracts({ ...queryFilters, page: initialPage, orderBy: sortOptions.orderBy, orderDir: sortOptions.orderDir }),
    fetchContractsCount(queryFilters),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">
          Explorador de contractes
        </h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-8">
        Cerca i filtra els contractes del municipi publicats a la plataforma de
        contractació pública. Inclou les adjudicacions de l&apos;Ajuntament i els
        contractes d&apos;altres organismes que indiquen Sant Sadurní com a lloc d&apos;execució.
      </p>
      <ContractExplorer
        initialFilters={initialFilters}
        initialSort={initialSort}
        initialPage={initialPage}
        initialContracts={initialContracts}
        initialTotal={initialTotal}
      />
    </div>
  );
}
