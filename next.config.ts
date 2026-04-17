import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include ALL skill files in the serverless function bundle
  // This ensures skills (SKILL.md, references, templates) are accessible at runtime
  outputFileTracingIncludes: {
    "/api/tasks/[taskId]/execute": [
      "./src/lib/skills/**/*",
    ],
    "/api/tasks/[taskId]/chat": [
      "./src/lib/skills/**/*",
    ],
    "/api/chat": [
      "./src/lib/skills/**/*",
    ],
    "/api/cron/execute-tasks": [
      "./src/lib/skills/**/*",
    ],
  },
};

export default nextConfig;
