"use client";

import Link from "next/link";

import { useLocale } from "@/components/providers";
import { StoryPage } from "@/components/story-page";
import { IntegrationsScene } from "@/components/scene/integrations-scene";
import { buildIntegrationsBeats } from "@/lib/integrations-story";
import { t } from "@/lib/content";

export function IntegrationsExperience() {
  const locale = useLocale();

  return (
    <StoryPage
      beats={buildIntegrationsBeats(locale)}
      scene={(env) => <IntegrationsScene {...env} />}
      // Narrower than the other pages: the lane is long and the gates are read
      // side-on, so a wide lens bends the ring the camera is square to.
      fov={38}
      bloom={0.55}
      showHint
    >
      <div className="beat__actions">
        <Link className="btn btn--primary" href={`/${locale}/contact`}>
          {t(locale, "integrations.hero.cta")}
        </Link>
        <Link className="btn btn--ghost" href={`/${locale}/services`}>
          {t(locale, "home.flow.cta_more")}
        </Link>
      </div>
    </StoryPage>
  );
}
