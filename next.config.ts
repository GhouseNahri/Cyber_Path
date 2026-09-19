import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the server bundle lean; images are ours only (no remote loader yet).
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
