import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/constants";
export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
