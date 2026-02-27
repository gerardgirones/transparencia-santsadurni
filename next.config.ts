import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/sitemap/0.xml",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
