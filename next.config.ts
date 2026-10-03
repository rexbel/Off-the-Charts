import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (deploy/cloudflare runs it in a Container).
  output: "standalone",
  // Migrations and precomputed output are read from disk at runtime; make sure
  // serverless bundles (e.g. Vercel) and the standalone output include them for every route.
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*", "./src/lib/data/generated/**/*"],
  },
};

export default nextConfig;
