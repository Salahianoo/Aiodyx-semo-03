import type { Metadata } from "next";

import { AboutExperience } from "@/components/about-experience";
import { t } from "@/lib/content";

export const metadata: Metadata = {
  title: t("meta.about.title"),
  description: t("meta.about.description"),
};

export default function AboutPage() {
  return (
    <main>
      <AboutExperience />
    </main>
  );
}
