import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // On Render (persistent server), no file tracing or standalone needed.
  // Full filesystem is available at runtime.
  eslint: {
    // Allow builds to succeed even with ESLint warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow builds even with type warnings (they pass locally)
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
