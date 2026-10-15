import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  distDir: process.env.NEXT_TEST_BUILD === "1" ? ".next-test" : ".next",
  typescript: { tsconfigPath: process.env.NEXT_TEST_BUILD === "1" ? "tsconfig.e2e.json" : "tsconfig.json" },
  async rewrites() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/sitemap-feed",
      },
    ];
  },
};

export default nextConfig;
