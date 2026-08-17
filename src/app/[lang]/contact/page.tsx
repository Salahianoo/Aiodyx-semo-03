import type { Metadata } from "next";

import { ContactPanel } from "@/components/contact-panel";
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
    title: t(locale, "meta.contact.title"),
    description: t(locale, "meta.contact.description"),
  };
}

export default function ContactPage() {
  return <ContactPanel />;
}
