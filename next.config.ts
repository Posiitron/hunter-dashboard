import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build static files into ./out for nginx-only hosting.
  output: "export",
  // Required when using next/image with static export. Safe even when not used.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
