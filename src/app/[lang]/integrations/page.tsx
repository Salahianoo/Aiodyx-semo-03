import type { Metadata } from "next";

import { IntegrationsExperience } from "@/components/integrations-experience";
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
    title: t(locale, "meta.integrations.title"),
    description: t(locale, "meta.integrations.description"),
  };
}

export default function IntegrationsPage() {
  return (
    <main>
      <IntegrationsExperience />
    </main>
  );
}
