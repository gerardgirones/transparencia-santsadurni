"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Contract } from "@/lib/types";
import ContractsTable from "@/components/tables/ContractsTable";
import Pagination from "@/components/ui/Pagination";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import { formatNumber } from "@/lib/utils";

const EMPTY_CONTRACTS: Contract[] = [];

interface Props {
  organName: string;
  initialContracts?: Contract[];
  totalContracts?: number;
}

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "awardee-asc" | "awardee-desc";

export default function OrganContractsExplorer({
  organName,
  initialContracts = EMPTY_CONTRACTS,
  totalContracts = 0,
}: Props) {
  const [contracts, setContracts] = useState(initialContracts);
  const [total, setTotal] = useState(totalContracts);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [companyFilter, setCompanyFilter] = useState("");
  const [procedimentFilter, setProcedimentFilter] = useState("");
  const [isRiskOnly, setIsRiskOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const fetchData = useCallback(
    async (p: number, s: SortKey, search: string, proc: string, risk: boolean) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({ nom_organ: organName, page: String(p), sort: s });
        if (search.trim()) params.set("search", search.trim());
        if (proc) params.set("procediment", proc);
        if (risk) {
          params.set("amountMin", "14500");
          params.set("amountMax", "14999.99");
          params.set("procediment", "Contracte menor");
        }
        const res = await fetch(`/api/contractes?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const json = await res.json();
        setContracts(json.data);
        setTotal(json.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching organ contracts:", err);
      } finally {
        setLoading(false);
      }
    },
    [organName]
  );

  useEffect(() => {
    if (initialContracts.length === 0) {
      fetchData(1, "date-desc", "", "", false);
    }
  }, [fetchData, initialContracts.length, organName]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      fetchData(p, sort, companyFilter, procedimentFilter, isRiskOnly);
    },
    [fetchData, sort, companyFilter, procedimentFilter, isRiskOnly]
  );

  const handleSortChange = useCallback(
    (newSort: SortKey) => {
      setSort(newSort);
      setPage(1);
      fetchData(1, newSort, companyFilter, procedimentFilter, isRiskOnly);
    },
    [fetchData, companyFilter, procedimentFilter, isRiskOnly]
  );

  const handleCompanyChange = useCallback(
    (value: string) => {
      setCompanyFilter(value);
      setPage(1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchData(1, sort, value, procedimentFilter, isRiskOnly), 400);
    },
    [fetchData, sort, procedimentFilter, isRiskOnly]
  );

  const handleProcedimentChange = (value: string) => {
    setProcedimentFilter(value);
    setPage(1);
    fetchData(1, sort, companyFilter, value, isRiskOnly);
  };

  const handleRiskToggle = () => {
    const nextRisk = !isRiskOnly;
    setIsRiskOnly(nextRisk);
    setPage(1);
    fetchData(1, sort, companyFilter, procedimentFilter, nextRisk);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Contractes ({formatNumber(total)})</h2>
      </div>
      <div
        className={`bg-white rounded-lg border border-gray-100 shadow-sm ${loading ? "opacity-50" : ""
          }`}
      >
        <div className="border-b border-gray-100 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={companyFilter}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  placeholder="Filtrar per empresa..."
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 sm:max-w-xs"
                />
                <select
                  value={procedimentFilter}
                  onChange={(e) => handleProcedimentChange(e.target.value)}
                  title="Filtrar per procediment"
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-400"
                >
                  <option value="">Tots els procediments</option>
                  <option value="Contracte menor">Contracte menor</option>
                  <option value="Obert">Obert</option>
                  <option value="Obert simplificat">Obert simplificat</option>
                  <option value="Negociat sense publicitat">Negociat sense publicitat</option>
                  <option value="Basat en acord marc">Basat en acord marc</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="organ-contracts-sort" className="text-xs text-gray-500">
                  Ordenar per
                </label>
                <select
                  id="organ-contracts-sort"
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value as SortKey)}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700"
                >
                  <option value="date-desc">Data (mes recents)</option>
                  <option value="date-asc">Data (mes antigues)</option>
                  <option value="amount-desc">Import (mes alt)</option>
                  <option value="amount-asc">Import (mes baix)</option>
                  <option value="awardee-asc">Adjudicatari (A-Z)</option>
                  <option value="awardee-desc">Adjudicatari (Z-A)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRiskToggle}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${isRiskOnly
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isRiskOnly ? "bg-red-500" : "bg-gray-300"}`} />
                Risc de fraccionament (&gt;14.5k€)
              </button>
              {isRiskOnly && (
                <span className="text-[11px] text-red-500 animate-pulse italic">
                  Mostrant contractes al límit legal
                </span>
              )}
            </div>
          </div>
        </div>

        <ContractsTable contracts={contracts} />
      </div>
      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={DEFAULT_PAGE_SIZE}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
