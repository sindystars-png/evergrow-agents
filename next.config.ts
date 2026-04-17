import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // On Render (persistent server), no file tracing needed — full filesystem available.
  // output: "standalone" builds a self-contained server for production deployment.
  output: "standalone",
};

export default nextConfig;
