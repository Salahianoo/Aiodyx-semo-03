import type { Locale } from "@/lib/i18n";

/**
 * The font troika loads for 3D labels.
 *
 * troika parses a font file itself and builds an SDF atlas from it, so it
 * needs a URL to a real TTF/OTF — it cannot use a CSS `@font-face` the browser
 * has already loaded, and its own default face has no Arabic glyphs at all.
 * Without this every Arabic ring label, tier caption and city name renders as
 * empty boxes.
 *
 * troika 0.52 does the hard part on its own: it ships bidi reordering and
 * Arabic joining, so the contextual forms come out correct as long as the face
 * carries the `GSUB` table. This build of IBM Plex Sans Arabic does.
 *
 * `undefined` for English keeps troika's built-in face, which is what every
 * label on this site has always used.
 */
export const arabicFontUrl = (locale: Locale): string | undefined =>
  locale === "ar" ? "/fonts/ibm-plex-sans-arabic-600.ttf" : undefined;

/**
 * Arabic has no capitals, so `toUpperCase()` is a no-op there — but the
 * letter-spacing that goes with a Latin all-caps label is actively harmful:
 * it breaks the cursive joins that make Arabic legible.
 */
export const displayCase = (text: string, locale: Locale) =>
  locale === "ar" ? text : text.toUpperCase();

/** Tracking for those same labels. Zero for Arabic, for the reason above. */
export const displayTracking = (locale: Locale) => (locale === "ar" ? 0 : 0.06);
