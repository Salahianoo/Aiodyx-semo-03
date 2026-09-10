import path from "node:path";
import type { NextConfig } from "next";

/**
 * Two static builds, and a plain server build when neither is asked for.
 *
 * `GITHUB_PAGES=true` — the review deployment. Pages serves this repo from a
 * subdirectory, so the whole site is prefixed with `basePath`.
 *
 * `STATIC_EXPORT=true` — the same export with no prefix, for a host that serves
 * the site at the root of a domain. This is the one to upload to aiodyx.com:
 * the Pages build hard-codes `/Aiodyx-semo-03` into every asset URL, so
 * uploading *that* to a domain root leaves every script and stylesheet a 404
 * and the page comes up blank.
 *
 * Both are off by default, so `next dev` and a plain `next build` behave as
 * they always did — a `basePath` baked in unconditionally would move local dev
 * to localhost:3000/Aiodyx-semo-03 and make every hand-typed URL wrong.
 *
 * `trailingSlash` makes the export write `en/index.html` rather than `en.html`:
 * a static host resolves a bare `/en` only if the directory has an index. And
 * `images.unoptimized` is required by `output: export` — the optimiser is a
 * server, and there isn't one.
 */
const pages = process.env.GITHUB_PAGES === "true";
const rootExport = process.env.STATIC_EXPORT === "true";
const repo = "/Aiodyx-semo-03";
/** Empty at a domain root. Read by `lib/asset.ts` for the handful of public
 *  paths written by hand, which Next does not rewrite itself — one source of
 *  truth with `basePath` below, so the two cannot drift apart. */
const base = pages ? repo : "";

const nextConfig: NextConfig = {
  // Pin the workspace root, or Turbopack walks up and finds the stray
  // package-lock.json in C:\Users\salah.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  ...(pages || rootExport
    ? {
        output: "export" as const,
        ...(base ? { basePath: base, assetPrefix: base } : {}),
        trailingSlash: true,
        images: { unoptimized: true },
        env: { NEXT_PUBLIC_BASE_PATH: base },
      }
    : {}),
};

export default nextConfig;
