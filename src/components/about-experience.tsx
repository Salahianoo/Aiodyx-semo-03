"use client";

import Link from "next/link";

import { useLocale } from "@/components/providers";
import { StoryPage } from "@/components/story-page";
import { AboutScene } from "@/components/scene/about-scene";
import { buildAboutBeats } from "@/lib/about-story";
import { t } from "@/lib/content";

export function AboutExperience() {
  const locale = useLocale();

  return (
    <StoryPage
      beats={buildAboutBeats(locale)}
      scene={(env) => <AboutScene {...env} />}
    >
      <div className="beat__actions">
        <Link className="btn btn--primary" href={`/${locale}/contact`}>
          {t(locale, "about.cta.demo")}
        </Link>
        <Link className="btn btn--ghost" href={`/${locale}/services`}>
          {t(locale, "home.services.view_all")}
        </Link>
      </div>
    </StoryPage>
  );
}
