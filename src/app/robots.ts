import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";
import { fetchCompaniesCount, fetchOrgansCount } from "@/lib/api";

// Must match sitemap chunk size: we keep 40,000 URLs per file as a safe buffer under the 50,000 sitemap limit.
const ENTITIES_PER_SITEMAP = 40000;
const MIN_ENTITY_SITEMAPS = 1;

function getChunkCount(total: number): number {
  return Math.max(MIN_ENTITY_SITEMAPS, Math.ceil(total / ENTITIES_PER_SITEMAP));
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [totalCompanies, totalOrgans] = await Promise.all([fetchCompaniesCount(), fetchOrgansCount()]);
  const totalSitemaps = 1 + getChunkCount(totalCompanies) + getChunkCount(totalOrgans);
  const sitemapUrls = Array.from({ length: totalSitemaps }, (_, id) => `${SITE_URL}/sitemap/${id}.xml`);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: sitemapUrls,
    host: SITE_URL,
  };
}
