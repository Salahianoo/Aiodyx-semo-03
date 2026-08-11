"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Primary">
      <Link href="/" className="nav__brand">
        AIODYX
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
