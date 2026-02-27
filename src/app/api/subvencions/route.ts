import { NextRequest, NextResponse } from "next/server";
import {
  fetchSubsidiesExplorer,
  fetchSubsidiesRanking,
  type SubsidyExplorerItem,
} from "@/lib/transparency";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
  DEFAULT_PAGE_SIZE,
} from "@/config/constants";

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toSubsidiesCsv(rows: SubsidyExplorerItem[]): string {
  const header = ["data_concessio", "any", "titol", "beneficiari", "import", "bases_reguladores"];
  const lines = rows.map((row) =>
    [
      row.dataConcessio,
      row.anyConcessio,
      row.titol,
      row.beneficiari,
      row.import,
      row.basesReguladores,
    ]
      .map(csvEscape)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format");

  const filters = {
    year: searchParams.get("year") || undefined,
    search: searchParams.get("search") || undefined,
    beneficiari: searchParams.get("beneficiari") || undefined,
    amountMin: searchParams.get("amountMin") || undefined,
    amountMax: searchParams.get("amountMax") || undefined,
    page: parseInt(searchParams.get("page") || "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10),
  };

  const [list, ranking] = await Promise.all([
    fetchSubsidiesExplorer(filters),
    fetchSubsidiesRanking({ year: filters.year, search: filters.search }, 10),
  ]);

  if (format === "csv") {
    const csv = toSubsidiesCsv(list.data);
    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"subvencions-${timestamp}.csv\"`,
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    });
  }

  return NextResponse.json(
    {
      data: list.data,
      total: list.total,
      ranking,
    },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
