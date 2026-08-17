"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

import { dirOf, isRtl, type Locale } from "@/lib/i18n";
import { scroll } from "@/lib/scroll";

const LocaleContext = createContext<Locale>("en");

/**
 * The locale is decided by the URL, so this provider only publishes it — there
 * is no setter. Switching language is a navigation (`/ar/services`), which is
 * the point of putting it in the path: the Arabic page is a real, shareable,
 * indexable address rather than a state flag inside an English one.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  // Published to the scroll module for the scenes, which read it on the render
  // loop and cannot take a context subscription there.
  useEffect(() => {
    scroll.rtl = isRtl(locale);
    return () => {
      scroll.rtl = false;
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);

export const useDir = () => dirOf(useContext(LocaleContext));
