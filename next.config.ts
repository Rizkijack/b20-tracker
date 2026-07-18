import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel deployment optimization
  output: "standalone",

  // Allow images from external domains if needed
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
