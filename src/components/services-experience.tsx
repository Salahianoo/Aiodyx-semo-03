"use client";

import Link from "next/link";

import { StoryPage } from "@/components/story-page";
import { ServicesScene } from "@/components/scene/services-scene";
import { SERVICES_BEATS } from "@/lib/services-story";
import { t } from "@/lib/content";

export function ServicesExperience() {
  return (
    <StoryPage
      beats={SERVICES_BEATS}
      scene={(reduced) => <ServicesScene reduced={reduced} />}
      // Wider lens: a corridor needs peripheral vision to read as travel
      fov={58}
      bloom={0.6}
    >
      <div className="beat__actions">
        <Link className="btn btn--primary" href="/contact">
          {t("services.cta.demo")}
        </Link>
        <Link className="btn btn--ghost" href="/about">
          {t("about.hero.cta_approach")}
        </Link>
      </div>
    </StoryPage>
  );
}
