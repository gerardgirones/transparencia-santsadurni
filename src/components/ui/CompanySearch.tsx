"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import type { CompanyAggregation, OrganAggregation } from "@/lib/types";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import SearchLoadingIndicator from "@/components/ui/SearchLoadingIndicator";

type SearchMode = "empresa" | "organisme" | "subvencio";
interface SubsidySearchResult {
  dataConcessio: string;
  titol: string;
  beneficiari: string;
  import: number;
  basesReguladores: string;
}
type SearchResult =
  | ({ kind: "empresa" } & CompanyAggregation)
  | ({ kind: "organisme" } & OrganAggregation)
  | ({ kind: "subvencio" } & SubsidySearchResult);

export default function CompanySearch() {
  const minCharsForMode = (): number => 2;
  const modeMeta: Record<SearchMode, { label: string; placeholder: string }> = {
    empresa: {
      label: "Empreses",
      placeholder: "Ex. ACSA, Novartis o A28037224...",
    },
    organisme: {
      label: "Organismes",
      placeholder: "Ex. Ajuntament de Vic, Departament de Salut...",
    },
    subvencio: {
      label: "Subvencions",
      placeholder: "Ex. entitat, cultura, esport...",
    },
  };
  const [mode, setMode] = useState<SearchMode>("empresa");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string, nextMode: SearchMode) => {
    const minChars = minCharsForMode();
    if (q.trim().length < minChars) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const endpoint =
        nextMode === "empresa"
          ? `/api/empreses?search=${encodeURIComponent(q)}&page=1&includeTotal=0`
          : nextMode === "organisme"
            ? `/api/organismes?search=${encodeURIComponent(q)}&page=1&limit=8&includeTotal=0&includeCurrentYear=0`
            : `/api/subvencions?search=${encodeURIComponent(q)}&page=1`;
      const res = await fetch(
        endpoint,
        { signal: abortRef.current.signal }
      );
      const json = await res.json();
      const sliced = (json.data || []).slice(0, 8);
      if (nextMode === "empresa") {
        setResults(sliced.map((row: CompanyAggregation) => ({ kind: "empresa" as const, ...row })));
      } else if (nextMode === "organisme") {
        setResults(sliced.map((row: OrganAggregation) => ({ kind: "organisme" as const, ...row })));
      } else {
        setResults(sliced.map((row: SubsidySearchResult) => ({ kind: "subvencio" as const, ...row })));
      }
      setOpen(true);
    } catch {
      // Ignore aborted requests while the user is still typing.
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const minChars = minCharsForMode();
      if (val.trim().length < minChars) {
        setResults([]);
        setOpen(false);
        setLoading(false);
        return;
      }
      debounceRef.current = setTimeout(() => search(val, mode), 300);
    },
    [mode, search]
  );

  const switchMode = useCallback((nextMode: SearchMode) => {
    setMode(nextMode);
    setResults([]);
    setOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= minCharsForMode()) {
      debounceRef.current = setTimeout(() => search(query, nextMode), 100);
    }
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl lg:mx-auto lg:max-w-[40.5rem]">
      <p className="mb-2 text-sm font-medium text-gray-700">Què vols cercar?</p>
      <div className="mb-2 grid grid-cols-1 gap-2 lg:flex lg:justify-center lg:gap-3">
        {(["empresa", "organisme", "subvencio"] as SearchMode[]).map((searchMode) => (
          <button
            key={searchMode}
            type="button"
            onClick={() => switchMode(searchMode)}
            className={`w-full rounded-xl border px-3 py-2 text-center text-sm font-semibold transition-colors lg:w-52 ${
              mode === searchMode
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
            }`}
          >
            {modeMeta[searchMode].label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-gray-500">
        {mode === "subvencio"
          ? "Subvencions: cerca automàtica amb mínim 2 caràcters."
          : "Cerca automàtica amb mínim 2 caràcters."}
      </p>
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          id="home-search-input"
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={modeMeta[mode].placeholder}
          className={`w-full pl-12 py-3 border border-gray-300 rounded-xl text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:shadow-md transition-shadow bg-white ${
            loading ? "pr-28" : "pr-4"
          }`}
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <SearchLoadingIndicator text="Cercant..." />
          </div>
        )}
      </div>

      {open && loading && query.trim().length >= minCharsForMode() && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
          Cercant resultats...
        </div>
      )}

      {open && !loading && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((result) => {
            if (result.kind === "empresa") {
              return (
                <Link
                  key={`empresa-${result.identificacio_adjudicatari}`}
                  href={`/empreses/${encodeURIComponent(result.identificacio_adjudicatari)}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.denominacio_adjudicatari}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {result.identificacio_adjudicatari}
                    </p>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCompactNumber(result.total)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatNumber(result.num_contracts)} contractes
                    </p>
                  </div>
                </Link>
              );
            }

            if (result.kind === "organisme") {
              return (
                <Link
                  key={`organ-${result.nom_organ}`}
                  href={`/organismes/${encodeURIComponent(result.nom_organ)}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.nom_organ}
                    </p>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCompactNumber(result.total)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatNumber(result.num_contracts)} contractes
                    </p>
                  </div>
                </Link>
              );
            }

            if (result.kind === "subvencio") {
              return (
                <Link
                  key={`subvencio-${result.titol}-${result.dataConcessio}`}
                  href={`/subvencions?search=${encodeURIComponent(result.titol || result.beneficiari || "")}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{result.titol || "Subvencio"}</p>
                    <p className="text-xs text-gray-500 truncate">{result.beneficiari || "Beneficiari no informat"}</p>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className="text-sm font-medium text-gray-900">{formatCompactNumber(result.import)}</p>
                  </div>
                </Link>
              );
            }

            return null;
          })}
          <Link
            href={
              mode === "empresa"
                ? `/empreses?search=${encodeURIComponent(query)}`
                : mode === "organisme"
                  ? `/organismes?search=${encodeURIComponent(query)}`
                  : `/subvencions?search=${encodeURIComponent(query)}`
            }
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-center text-sm text-gray-600 hover:bg-gray-50 bg-gray-50"
          >
            Veure tots els resultats
          </Link>
        </div>
      )}

      {open && query.trim().length >= minCharsForMode() && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
          {mode === "empresa"
            ? "No s'han trobat empreses."
            : mode === "organisme"
              ? "No s'han trobat organismes."
              : "No s'han trobat subvencions."}
        </div>
      )}
    </div>
  );
}
