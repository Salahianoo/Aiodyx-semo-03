import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/i18n";

/**
 * Puts every request on a locale path.
 *
 * `middleware.ts` is deprecated in this version of Next; the same file is now
 * `proxy.ts`. It runs before rendering and may be deployed to a CDN, so it
 * imports nothing but the locale table — no dictionaries, no React.
 */

/** First language the visitor asked for that we actually publish. */
function preferredLocale(header: string | null) {
  if (!header) return DEFAULT_LOCALE;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return {
        // `ar-JO` and `ar-SA` are both Arabic to us — match on the primary
        // subtag, or the two markets this company actually sells into would
        // each fall through to English.
        tag: tag.trim().toLowerCase().split("-")[0],
        q: q ? Number(q.split("=")[1]) || 0 : 1,
      };
    })
    .sort((a, b) => b.q - a.q);

  return ranked.find((r) => isLocale(r.tag))?.tag ?? DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return NextResponse.next();

  // A returning visitor's explicit choice outranks their browser's headers —
  // someone who switched to Arabic on an English-configured laptop meant it.
  const chosen = request.cookies.get("aiodyx-locale")?.value;
  const locale =
    chosen && isLocale(chosen)
      ? chosen
      : preferredLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Everything except the things that must not be rewritten: the API (it has
   * no locale), Next's own assets, and any request with a file extension —
   * `/odoo-logo.svg` prefixed to `/en/odoo-logo.svg` is a 404, and the home
   * scene needs that file to draw its credibility line.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
