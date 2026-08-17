"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/brand";
import { useLocale } from "@/components/providers";
import { t } from "@/lib/content";
import { localizePath, LOCALE_NAMES, LOCALE_SHORT, LOCALES } from "@/lib/i18n";

const LINKS = [
  { href: "", key: "nav.home" },
  { href: "/services", key: "nav.services" },
  { href: "/about", key: "nav.about" },
  { href: "/contact", key: "nav.contact" },
];

/**
 * Deliberately quiet: a cinematic page shouldn't carry a heavy marketing bar.
 * No scroll-hide behaviour — chrome that appears and disappears while you
 * scroll is exactly the kind of motion that reads as jitter on a page whose
 * whole job is smooth travel.
 *
 * The language switch lives here rather than in a footer because it changes
 * what the visitor is looking at *right now*, and a control whose effect is
 * immediate has to be reachable without scrolling to the end of a story.
 */
export function Nav() {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <nav className="nav" aria-label="Primary">
      <Link
        href={`/${locale}`}
        className="nav__brand"
        aria-label={`${t(locale, "brand.name")} — ${t(locale, "nav.home")}`}
      >
        {/* Brand navy, as drawn. The page is light, so the monogram gets to
            keep the real colour rather than a lifted tint of it. */}
        <Wordmark className="nav__mark" mark="var(--brand-mark)" />
      </Link>

      <ul className="nav__list">
        {LINKS.map((l) => {
          const href = `/${locale}${l.href}`;
          const active = l.href
            ? pathname.startsWith(href)
            : pathname === `/${locale}` || pathname === `/${locale}/`;
          return (
            <li key={l.key}>
              <Link
                href={href}
                className="nav__link"
                data-active={active}
                aria-current={active ? "page" : undefined}
              >
                {t(locale, l.key)}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="nav__tools">
        <LanguageSwitch pathname={pathname} />
      </div>
    </nav>
  );
}

/**
 * A link, not a button.
 *
 * The other language is a different URL, so this is navigation — which means
 * it must open in a new tab, be copied, and be crawled like any other link.
 * A button with an onClick would be none of those things.
 */
function LanguageSwitch({ pathname }: { pathname: string }) {
  const locale = useLocale();
  const other = LOCALES.find((l) => l !== locale) ?? locale;

  return (
    <Link
      href={localizePath(pathname, other)}
      className="nav__switch"
      // Written in the language being offered, never in the one being left:
      // someone who cannot read the current UI has to be able to find the way
      // out of it.
      lang={other}
      hrefLang={other}
      aria-label={`${t(locale, "ui.language_switch")}: ${LOCALE_NAMES[other]}`}
      title={LOCALE_NAMES[other]}
      // Remembered so the bare "/" lands them here next time rather than
      // sending them back through language negotiation. Read by proxy.ts.
      onClick={() => {
        document.cookie = `aiodyx-locale=${other};path=/;max-age=31536000;samesite=lax`;
      }}
    >
      {LOCALE_SHORT[other]}
    </Link>
  );
}
