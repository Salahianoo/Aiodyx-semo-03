import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

/**
 * The two faces, in one place.
 *
 * They used to be declared inside `[lang]/layout.tsx`, which is the only place
 * that needed them until the 404 arrived. That page sits *outside* the locale
 * layout — an unknown path has no locale segment — so it inherited neither
 * className, both `--font-latin` and `--font-arabic` were undefined, and the
 * page fell back to system faces. The Arabic line was the giveaway: Inter has
 * no Arabic glyphs, so it landed in whatever the OS offers.
 */

/**
 * 700 and 800 are loaded because two places ask for them: the services `bold`
 * variant sets the title to 800, and the home page's display type is 700.
 * Without the real faces the browser synthesises a fake bold, which smears the
 * letterforms.
 */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-latin",
  display: "swap",
});

/**
 * Inter has no Arabic glyphs at all, so Arabic in Inter is not "unstyled" —
 * it is missing. Every Arabic page needs a face of its own, and it has to be
 * one with real weight range, because the whole type system here is built on
 * weight contrast (600 kickers, 800 titles on services).
 *
 * IBM Plex Sans Arabic tops out at 700 where Inter reaches 800. That is a real
 * difference at the largest display sizes and the CSS accounts for it rather
 * than letting the browser synthesise the missing weight.
 */
export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

/** Both variables, for whichever element is acting as the document root. */
export const fontVariables = `${inter.variable} ${plexArabic.variable}`;
