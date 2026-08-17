/**
 * Locales, and the one thing that follows from them: writing direction.
 *
 * Kept free of React and of `next/*` on purpose — `proxy.ts` runs on the edge
 * before any render and imports `isLocale` and `DEFAULT_LOCALE` from here, so
 * anything pulled in alongside them would be dragged into that bundle too.
 */

export const LOCALES = ["en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

export const dirOf = (locale: Locale): "ltr" | "rtl" =>
  locale === "ar" ? "rtl" : "ltr";

export const isRtl = (locale: Locale) => dirOf(locale) === "rtl";

/**
 * How each language names *itself*.
 *
 * A language switch labelled in the language you are trying to leave is no use
 * to the person who needs it: someone who cannot read the English UI cannot
 * find "Arabic" in it. Every option is written in its own script, always.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

/** Two-or-three character form for the nav toggle, same rule. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  ar: "ع",
};

/** Swap the locale segment of a path, keeping the rest of the route. */
export function localizePath(pathname: string, locale: Locale): string {
  const segments = pathname.split("/");
  // ["", "en", "services"] — index 1 is the locale segment
  if (segments.length > 1 && isLocale(segments[1])) {
    segments[1] = locale;
    return segments.join("/") || "/";
  }
  return `/${locale}${pathname === "/" ? "" : pathname}`;
}
