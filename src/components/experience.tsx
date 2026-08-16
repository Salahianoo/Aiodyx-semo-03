"use client";

import Image from "next/image";
import Link from "next/link";

import "@/app/trust.css";
import { StoryPage } from "@/components/story-page";
import { HomeScene } from "@/components/scene/home-scene";
import { BEATS } from "@/lib/story";
import { t } from "@/lib/content";

/**
 * Credibility markers, and the rule they follow.
 *
 * A scroll story can be beautiful and still leave a visitor unsure whether
 * there is a company behind it. These are the answers to "who is this and can
 * they actually build my system" — and every one of them is a fact already in
 * the dictionary: the platform, the two offices with their real addresses and
 * numbers, the working week, the languages the team delivers in.
 *
 * Nothing here is invented. No client logos, no headcount, no project count,
 * no years-in-business, no testimonials — a marker that cannot be checked is
 * worse than no marker, because the visitor who checks it stops believing the
 * rest of the page too.
 */

const OFFICES = ["jordan", "saudi"] as const;

function Intro() {
  return (
    <div className="trust">
      <span className="trust__odoo">
        <span>Built on</span>
        <Image
          src="/odoo-logo.svg"
          alt="Odoo"
          width={631}
          height={207}
          priority
          unoptimized
        />
      </span>
      <span className="trust__sep" aria-hidden="true" />
      <span className="trust__fact">
        {t("about.locations.jordan.country")} · {t("about.locations.saudi.country")}
      </span>
      <span className="trust__sep" aria-hidden="true" />
      <span className="trust__fact">{t("home.why.feature5.title")}</span>
    </div>
  );
}

function Offices() {
  return (
    <div className="offices">
      {OFFICES.map((o) => (
        <div key={o} className="offices__card">
          <p className="offices__country">{t(`about.locations.${o}.country`)}</p>
          <p className="offices__line">{t(`about.locations.${o}.address`)}</p>
          <a className="offices__line offices__tel" href={`tel:${t(`about.locations.${o}.phone`).replace(/\s/g, "")}`}>
            {t(`about.locations.${o}.phone`)}
          </a>
        </div>
      ))}
      <p className="offices__hours">{t("about.locations.hours")}</p>
    </div>
  );
}

export function Experience() {
  return (
    <StoryPage
      beats={BEATS}
      scene={(reduced) => <HomeScene reduced={reduced} />}
      showHint
      intro={<Intro />}
    >
      <div className="beat__actions">
        <Link className="btn btn--primary" href="/contact">
          {t("home.cta.button")}
        </Link>
        <Link className="btn btn--ghost" href="/services">
          {t("home.flow.cta_more")}
        </Link>
      </div>
      <Offices />
    </StoryPage>
  );
}
