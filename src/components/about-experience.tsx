"use client";

import Link from "next/link";

import { StoryPage } from "@/components/story-page";
import { AboutScene } from "@/components/scene/about-scene";
import { ABOUT_BEATS } from "@/lib/about-story";
import { t } from "@/lib/content";

export function AboutExperience() {
  return (
    <StoryPage
      beats={ABOUT_BEATS}
      scene={(reduced) => <AboutScene reduced={reduced} />}
    >
      <div className="beat__actions">
        <Link className="btn btn--primary" href="/contact">
          {t("about.cta.demo")}
        </Link>
        <Link className="btn btn--ghost" href="/services">
          {t("home.services.view_all")}
        </Link>
      </div>
    </StoryPage>
  );
}
