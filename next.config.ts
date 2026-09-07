import path from "node:path";
import type { NextConfig } from "next";

/**
 * GitHub Pages build, switched on by an env var the workflow sets.
 *
 * Kept off by default so `next dev` and `next build` behave exactly as they
 * did: a `basePath` baked in unconditionally would move local dev to
 * localhost:3000/Aiodyx-semo-03 and make every hand-typed URL wrong.
 *
 * Pages serves this repo from a subdirectory, hence `basePath`. `trailingSlash`
 * makes the export write `en/index.html` rather than `en.html` — Pages resolves
 * a bare `/en` only if the directory has an index. And `images.unoptimized` is
 * required by `output: export`: the optimiser is a server, and there isn't one.
 */
const pages = process.env.GITHUB_PAGES === "true";
const repo = "/Aiodyx-semo-03";

const nextConfig: NextConfig = {
  // Pin the workspace root, or Turbopack walks up and finds the stray
  // package-lock.json in C:\Users\salah.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  ...(pages
    ? {
        output: "export" as const,
        basePath: repo,
        assetPrefix: repo,
        trailingSlash: true,
        images: { unoptimized: true },
        // Read by `lib/asset.ts` for the handful of public paths written by
        // hand, which Next does not rewrite. One source of truth with
        // `basePath` above, so the two cannot drift apart.
        env: { NEXT_PUBLIC_BASE_PATH: repo },
      }
    : {}),
};

export default nextConfig;
