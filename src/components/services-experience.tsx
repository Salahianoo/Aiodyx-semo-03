"use client";

import Link from "next/link";

import { useLocale } from "@/components/providers";
import { StoryPage } from "@/components/story-page";
import { ServicesScene } from "@/components/scene/services-scene";
import { buildServicesBeats } from "@/lib/services-story";
import { t } from "@/lib/content";

export function ServicesExperience() {
  const locale = useLocale();

  return (
    <StoryPage
      beats={buildServicesBeats(locale)}
      scene={(env) => <ServicesScene {...env} />}
      // Wide lens: the rig is tall and the camera climbs it from close range,
      // so the perspective is what sells the height.
      fov={58}
      bloom={0.6}
    >
      <div className="beat__actions">
        <Link className="btn btn--primary" href={`/${locale}/contact`}>
          {t(locale, "services.cta.demo")}
        </Link>
        <Link className="btn btn--ghost" href={`/${locale}/about`}>
          {t(locale, "about.hero.cta_approach")}
        </Link>
      </div>
    </StoryPage>
  );
}
