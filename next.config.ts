import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root, or Turbopack walks up and finds the stray
  // package-lock.json in C:\Users\salah.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
