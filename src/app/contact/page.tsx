import type { Metadata } from "next";

import { ContactPanel } from "@/components/contact-panel";
import { t } from "@/lib/content";

export const metadata: Metadata = {
  title: t("meta.contact.title"),
  description: t("meta.contact.description"),
};

export default function ContactPage() {
  return <ContactPanel />;
}
