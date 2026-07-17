import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel deployment optimization — standalone output for serverless
  output: "standalone",

  // ISR configuration
  // Token detail pages use revalidate=60 for fresh data
  // Static params discovered at request time

  // Allow images from external domains if needed
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Server-side caching headers
  // Vercel CDN respects these for edge caching
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            // API responses are cached at CDN edge for 2s, revalidate asynchronously
            value: "public, s-maxage=2, stale-while-revalidate=10",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
