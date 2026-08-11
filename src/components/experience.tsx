"use client";

import Link from "next/link";

import { StoryPage } from "@/components/story-page";
import { HomeScene } from "@/components/scene/home-scene";
import { BEATS } from "@/lib/story";

export function Experience() {
  return (
    <StoryPage
      beats={BEATS}
      scene={(reduced) => <HomeScene reduced={reduced} />}
      showHint
    >
      <div className="beat__actions">
        <Link className="btn btn--primary" href="/contact">
          Book a consultation
        </Link>
        <Link className="btn btn--ghost" href="/services">
          See how we build
        </Link>
      </div>
    </StoryPage>
  );
}
