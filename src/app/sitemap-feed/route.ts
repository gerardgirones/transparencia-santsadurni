import { SITE_URL } from "@/config/constants";
import {
  fetchCompaniesCount,
  fetchCompanyIdsPage,
  fetchOrgansCount,
  fetchOrganNamesPage,
} from "@/lib/api";

const STATIC_ROUTES = [
  "",
  "/about",
  "/analisi",
  "/contractes",
  "/subvencions",
  "/transparencia",
  "/comunitat",
  "/donacions",
  "/contacte",
  "/faq",
  "/empreses",
  "/organismes",
  "/legal",
] as const;

const PAGE_SIZE = 5000;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function fetchAllCompanyIds(total: number): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const page = await fetchCompanyIdsPage(offset, PAGE_SIZE);
    if (page.length === 0) break;
    ids.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return ids;
}

async function fetchAllOrganNames(total: number): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const page = await fetchOrganNamesPage(offset, PAGE_SIZE);
    if (page.length === 0) break;
    names.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return names;
}

export async function GET() {
  const now = new Date().toISOString();
  const staticUrls = STATIC_ROUTES.map((route) => `${SITE_URL}${route}`);

  const [companyCount, organCount] = await Promise.all([fetchCompaniesCount(), fetchOrgansCount()]);
  const [companyIds, organNames] = await Promise.all([
    fetchAllCompanyIds(companyCount),
    fetchAllOrganNames(organCount),
  ]);

  const dynamicUrls = [
    ...companyIds.map((id) => `${SITE_URL}/empreses/${encodeURIComponent(id)}`),
    ...organNames.map((name) => `${SITE_URL}/organismes/${encodeURIComponent(name)}`),
  ];

  const allUrls = [...staticUrls, ...dynamicUrls];

  const urlEntries = allUrls
    .map((url) => `<url><loc>${escapeXml(url)}</loc><lastmod>${now}</lastmod></url>`)
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
