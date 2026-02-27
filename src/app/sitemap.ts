import type { MetadataRoute } from "next";
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
  "/empreses",
  "/organismes",
  "/legal",
] as const;

// Search engines commonly cap each sitemap file at 50,000 URLs.
// We keep a conservative 40,000 limit to leave headroom for growth and avoid edge-case overflows.
const PERSONS_PER_SITEMAP = 40000;
const MIN_ENTITY_SITEMAPS = 1;

function getChunkCount(total: number): number {
  return Math.max(MIN_ENTITY_SITEMAPS, Math.ceil(total / PERSONS_PER_SITEMAP));
}

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  const [totalCompanies, totalOrgans] = await Promise.all([fetchCompaniesCount(), fetchOrgansCount()]);
  // Keep at least one chunk per entity type even when counts fail temporarily.
  const companySitemapCount = getChunkCount(totalCompanies);
  const organSitemapCount = getChunkCount(totalOrgans);
  const totalSitemaps = 1 + companySitemapCount + organSitemapCount; // id 0 is static routes.
  return Array.from({ length: totalSitemaps }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: number | string;
}): Promise<MetadataRoute.Sitemap> {
  const sitemapId = Number(id);
  if (!Number.isFinite(sitemapId) || sitemapId < 0) return [];
  const now = new Date();

  if (sitemapId === 0) {
    return STATIC_ROUTES.map((route) => ({
      url: `${SITE_URL}${route}`,
      lastModified: now,
      changeFrequency: route === "" ? "daily" : "weekly",
      priority: route === "" ? 1 : 0.7,
    }));
  }

  const totalCompanies = await fetchCompaniesCount();
  const companySitemapCount = getChunkCount(totalCompanies);

  const companyStart = 1;
  const organStart = companyStart + companySitemapCount;

  if (sitemapId >= companyStart && sitemapId < organStart) {
    const offset = (sitemapId - companyStart) * PERSONS_PER_SITEMAP;
    const companyIds = await fetchCompanyIdsPage(offset, PERSONS_PER_SITEMAP);
    return companyIds.map((companyId) => ({
      url: `${SITE_URL}/empreses/${encodeURIComponent(companyId)}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
  }

  const offset = (sitemapId - organStart) * PERSONS_PER_SITEMAP;
  const organNames = await fetchOrganNamesPage(offset, PERSONS_PER_SITEMAP);
  return organNames.map((organName) => ({
    url: `${SITE_URL}/organismes/${encodeURIComponent(organName)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}
