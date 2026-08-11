import en from "@/content/en.json";

/**
 * Copy comes from the live AIODYX dictionary rather than being invented here,
 * so the story pages and the marketing site can't drift apart.
 */
function lookup(path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      en,
    );
}

export function t(path: string, fallback = ""): string {
  const value = lookup(path);
  if (typeof value === "string") return value;
  if (process.env.NODE_ENV !== "production" && !fallback) {
    console.warn(`[content] missing key "${path}"`);
  }
  return fallback;
}

/** Collects `prefix.key` for each key, dropping any that are missing. */
export const tList = (prefix: string, keys: string[]): string[] =>
  keys.map((k) => t(`${prefix}.${k}`, "")).filter(Boolean);
