import ar from "@/content/ar.json";
import en from "@/content/en.json";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * Copy comes from the live AIODYX dictionary rather than being invented here,
 * so the story pages and the marketing site can't drift apart.
 *
 * Both dictionaries are imported statically rather than fetched per locale.
 * They are the same ~46KB of JSON each and the language toggle is expected to
 * feel instant — a dynamic import would put a network round trip and a
 * suspense boundary in the middle of a button press, and the scroll story
 * would unmount and remeasure on the far side of it.
 */
const DICTIONARIES: Record<Locale, unknown> = { en, ar };

function lookup(dict: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      dict,
    );
}

/**
 * Look a key up in `locale`, falling back to English before the caller's own
 * fallback.
 *
 * The English fallback is deliberate. A half-translated dictionary should
 * degrade to a bilingual page, which is legible, rather than to holes in the
 * layout — a missing headline collapses the beat it belongs to and takes the
 * scene's measured scroll range with it.
 */
export function t(locale: Locale, path: string, fallback = ""): string {
  const value = lookup(DICTIONARIES[locale], path);
  if (typeof value === "string" && value) return value;

  if (locale !== DEFAULT_LOCALE) {
    const base = lookup(DICTIONARIES[DEFAULT_LOCALE], path);
    if (typeof base === "string" && base) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[content] "${path}" missing for "${locale}"`);
      }
      return base;
    }
  }

  if (process.env.NODE_ENV !== "production" && !fallback) {
    console.warn(`[content] missing key "${path}"`);
  }
  return fallback;
}

/** Collects `prefix.key` for each key, dropping any that are missing. */
export const tList = (
  locale: Locale,
  prefix: string,
  keys: string[],
): string[] => keys.map((k) => t(locale, `${prefix}.${k}`, "")).filter(Boolean);
