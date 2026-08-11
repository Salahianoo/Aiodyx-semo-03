import type { Metadata } from "next";

import { ServicesExperience } from "@/components/services-experience";
import { t } from "@/lib/content";

export const metadata: Metadata = {
  title: t("meta.services.title"),
  description: t("meta.services.description"),
};

export default function ServicesPage() {
  return (
    <main>
      <ServicesExperience />
    </main>
  );
}
