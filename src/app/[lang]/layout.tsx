import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

import "../globals.css";

import { LocaleProvider } from "@/components/providers";
import { t } from "@/lib/content";
import { dirOf, isLocale, LOCALES, type Locale } from "@/lib/i18n";

/**
 * 700 and 800 are loaded because two places ask for them: the services `bold`
 * variant sets the title to 800, and the home page's display type is 700.
 * Without the real faces the browser synthesises a fake bold, which smears the
 * letterforms.
 */
const inter = Inter({
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
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

/** Both locales are known at build time, so both are prerendered. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";

  return {
    title: t(locale, "meta.home.title"),
    description: t(locale, "meta.home.description"),
    // Tells search engines these two are the same page in two languages
    // rather than duplicates competing with each other.
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      dir={dirOf(lang)}
      className={`${inter.variable} ${plexArabic.variable}`}
    >
      <body>
        <LocaleProvider locale={lang}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
