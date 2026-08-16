"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/brand";

const LINKS = [
  { href: "/", label: "Story" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/**
 * Deliberately quiet: a cinematic page shouldn't carry a heavy marketing bar.
 * No scroll-hide behaviour — chrome that appears and disappears while you
 * scroll is exactly the kind of motion that reads as jitter on a page whose
 * whole job is smooth travel.
 */
export function Nav({
  /**
   * The three scene pages are near-black; home is white. Only the colours
   * differ, so this is one attribute rather than a second component — and it
   * is a prop rather than a route check because the page that renders the bar
   * is the thing that knows what it painted behind it.
   */
  theme = "dark",
}: {
  theme?: "dark" | "light";
}) {
  const pathname = usePathname();

  return (
    <nav className="nav" data-theme={theme} aria-label="Primary">
      <Link href="/" className="nav__brand" aria-label="AIODYX — home">
        {/* Brand navy on white; a lifted tint of the same hue on black, where
            #13308a is all but invisible. */}
        <Wordmark
          className="nav__mark"
          mark={theme === "light" ? "#13308a" : "#6E8BEA"}
        />
      </Link>
      <ul className="nav__list">
        {LINKS.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className="nav__link"
                data-active={active}
                aria-current={active ? "page" : undefined}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
