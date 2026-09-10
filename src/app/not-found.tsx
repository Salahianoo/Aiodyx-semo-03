import Link from "next/link";

import "./globals.css";

import { fontVariables } from "@/app/fonts";

/**
 * The 404, for any address that matches nothing.
 *
 * It carries its own `<html>` because it sits outside `[lang]/layout.tsx` — an
 * unknown path has no locale segment to read, so there is no root layout above
 * this and nothing has set `lang` or `dir`.
 *
 * That same fact decides the content: this page cannot know which language the
 * visitor came for, so it offers both rather than guessing. No 3D scene either
 * — the scenes are heavy client components tied to the scroll story, and a
 * wrong turn is not the place to spend a visitor's battery.
 */
export const metadata = {
  title: "404 — AIODYX",
  description: "The page you asked for does not exist.",
};

export default function NotFound() {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <main className="notfound">
          <p className="notfound__code">404</p>

          <div className="notfound__pair">
            <p className="notfound__line" lang="en" dir="ltr">
              This page does not exist.
            </p>
            <p className="notfound__line" lang="ar" dir="rtl">
              هذه الصفحة غير موجودة.
            </p>
          </div>

          <div className="notfound__actions">
            <Link className="btn btn--primary" href="/en" lang="en" dir="ltr">
              Go to the homepage
            </Link>
            <Link className="btn btn--ghost" href="/ar" lang="ar" dir="rtl">
              الانتقال إلى الرئيسية
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
