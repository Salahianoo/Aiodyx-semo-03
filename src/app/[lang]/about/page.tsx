import type { Metadata } from "next";

import { AboutExperience } from "@/components/about-experience";
import { t } from "@/lib/content";
import { isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  return {
    title: t(locale, "meta.about.title"),
    description: t(locale, "meta.about.description"),
  };
}

export default function AboutPage() {
  return (
    <main>
      <AboutExperience />
    </main>
  );
}
