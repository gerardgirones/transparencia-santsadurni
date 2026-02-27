"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatCurrencyFull, formatDate, formatNumber } from "@/lib/utils";
import type { SubsidyExplorerItem, SubsidyExplorerRankingRow } from "@/lib/transparency";

const EMPTY_FILTERS = {
  year: "",
  search: "",
  beneficiari: "",
  amountMin: "",
  amountMax: "",
};

interface Props {
  initialFilters?: typeof EMPTY_FILTERS;
  initialPage?: number;
  initialData?: SubsidyExplorerItem[];
  initialTotal?: number;
  initialRanking?: SubsidyExplorerRankingRow[];
  initialYearOptions?: string[];
}

export default function SubvencionsExplorer({
  initialFilters = EMPTY_FILTERS,
  initialPage = 1,
  initialData = [],
  initialTotal = 0,
  initialRanking = [],
  initialYearOptions = [],
}: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [ranking, setRanking] = useState(initialRanking);
  const [loading, setLoading] = useState(false);

  const yearOptions = initialYearOptions;

  const debounceRef = useRef<NodeJS.Timeout>(null);
  const abortRef = useRef<AbortController>(null);

  const buildQueryString = useCallback((f: typeof EMPTY_FILTERS, p: number) => {
    const params = new URLSearchParams();
    if (f.year) params.set("year", f.year);
    if (f.search) params.set("search", f.search);
    if (f.beneficiari) params.set("beneficiari", f.beneficiari);
    if (f.amountMin) params.set("amountMin", f.amountMin);
    if (f.amountMax) params.set("amountMax", f.amountMax);
    if (p > 1) params.set("page", String(p));
    return params.toString();
  }, []);

  const updateUrl = useCallback(
    (f: typeof EMPTY_FILTERS, p: number) => {
      const qs = buildQueryString(f, p);
      const url = qs ? `/subvencions?${qs}` : "/subvencions";
      window.history.replaceState(null, "", url);
    },
    [buildQueryString]
  );

  const fetchData = useCallback(async (f: typeof EMPTY_FILTERS, p: number) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.year) params.set("year", f.year);
      if (f.search) params.set("search", f.search);
      if (f.beneficiari) params.set("beneficiari", f.beneficiari);
      if (f.amountMin) params.set("amountMin", f.amountMin);
      if (f.amountMax) params.set("amountMax", f.amountMax);
      params.set("page", String(p));

      const res = await fetch(`/api/subvencions?${params.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Failed to fetch subsidies: ${res.status}`);
      const json = await res.json();
      setData(json.data || []);
      setTotal(json.total || 0);
      setRanking(json.ranking || []);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Subsidies fetch error:", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleFilterChange = useCallback(
    (key: keyof typeof EMPTY_FILTERS, value: string) => {
      const nextFilters = { ...filters, [key]: value };
      setFilters(nextFilters);
      setPage(1);
      updateUrl(nextFilters, 1);

      if (key === "search" || key === "beneficiari" || key === "amountMin" || key === "amountMax") {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchData(nextFilters, 1), 400);
      } else {
        fetchData(nextFilters, 1);
      }
    },
    [fetchData, filters, updateUrl]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      updateUrl(filters, nextPage);
      fetchData(filters, nextPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [fetchData, filters, updateUrl]
  );

  const handleReset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    updateUrl(EMPTY_FILTERS, 1);
    fetchData(EMPTY_FILTERS, 1);
  }, [fetchData, updateUrl]);

  const exportParams = new URLSearchParams(buildQueryString(filters, page));
  exportParams.set("format", "csv");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <aside>
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Filtres</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Any</label>
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange("year", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">Tots</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Text</label>
              <input value={filters.search} onChange={(e) => handleFilterChange("search", e.target.value)} placeholder="Titol o paraula" className="w-full rounded-md border border-gray-300 px-2 py-1.5" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Beneficiari</label>
              <input value={filters.beneficiari} onChange={(e) => handleFilterChange("beneficiari", e.target.value)} placeholder="Nom entitat" className="w-full rounded-md border border-gray-300 px-2 py-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Import min.</label>
                <input value={filters.amountMin} onChange={(e) => handleFilterChange("amountMin", e.target.value)} placeholder="0" className="w-full rounded-md border border-gray-300 px-2 py-1.5" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Import max.</label>
                <input value={filters.amountMax} onChange={(e) => handleFilterChange("amountMax", e.target.value)} placeholder="50000" className="w-full rounded-md border border-gray-300 px-2 py-1.5" />
              </div>
            </div>
            <button onClick={handleReset} className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100">
              Netejar filtres
            </button>
          </div>
        </div>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">{loading ? "Carregant..." : `${formatNumber(total)} subvencions trobades`}</p>
          <a href={`/api/subvencions?${exportParams.toString()}`} className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Exporta CSV (vista actual)
          </a>
        </div>

        <div className="mb-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Ranquing beneficiaris</p>
          <div className="space-y-1">
            {ranking.map((row, idx) => (
              <div key={`${row.beneficiari}-${idx}`} className="flex items-center justify-between border-b border-gray-100 py-1.5 last:border-b-0">
                <p className="truncate pr-3 text-sm text-gray-800">{idx + 1}. {row.beneficiari}</p>
                <p className="shrink-0 text-xs text-gray-600">{formatCurrencyFull(row.totalAmount)} · {formatNumber(row.count)}</p>
              </div>
            ))}
            {ranking.length === 0 ? <p className="text-xs text-gray-500">Sense dades per al filtre actual.</p> : null}
          </div>
        </div>

        <div className={`overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm ${loading ? "opacity-50" : ""}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Titol</th>
                <th className="px-3 py-2">Beneficiari</th>
                <th className="px-3 py-2 text-right">Import</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={`${row.titol}-${row.dataConcessio}-${idx}`} className="border-b border-gray-100 align-top last:border-b-0">
                  <td className="px-3 py-2 text-xs text-gray-600">{formatDate(row.dataConcessio)}</td>
                  <td className="px-3 py-2 text-gray-800">
                    <p>{row.titol || "Sense titol"}</p>
                    {row.basesReguladores ? (
                      <a href={row.basesReguladores} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 underline">
                        Base reguladora
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{row.beneficiari || "Sense beneficiari"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-900">{formatCurrencyFull(row.import)}</td>
                </tr>
              ))}
              {data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">No s&apos;han trobat subvencions amb aquests filtres.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalItems={total}
          pageSize={DEFAULT_PAGE_SIZE}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
