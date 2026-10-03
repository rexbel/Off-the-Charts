import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Migrations and precomputed output are read from disk at runtime; make sure
  // serverless bundles (e.g. Vercel) include them for every route.
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*", "./src/lib/data/generated/**/*"],
  },
};

export default nextConfig;
