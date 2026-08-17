"use client";

import Image from "next/image";
import Link from "next/link";

import "@/app/trust.css";
import { useLocale } from "@/components/providers";
import { StoryPage } from "@/components/story-page";
import { HomeScene } from "@/components/scene/home-scene";
import { buildBeats } from "@/lib/story";
import { t } from "@/lib/content";
import type { Locale } from "@/lib/i18n";

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

function Intro({ locale }: { locale: Locale }) {
  return (
    <div className="trust">
      <span className="trust__odoo">
        <span>{t(locale, "trust.built_on", "Built on")}</span>
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
        {t(locale, "about.locations.jordan.country")} ·{" "}
        {t(locale, "about.locations.saudi.country")}
      </span>
      <span className="trust__sep" aria-hidden="true" />
      <span className="trust__fact">{t(locale, "home.why.feature5.title")}</span>
    </div>
  );
}

function Offices({ locale }: { locale: Locale }) {
  return (
    <div className="offices">
      {OFFICES.map((o) => (
        <div key={o} className="offices__card">
          <p className="offices__country">
            {t(locale, `about.locations.${o}.country`)}
          </p>
          <p className="offices__line">
            {t(locale, `about.locations.${o}.address`)}
          </p>
          <a
            className="offices__line offices__tel"
            // The number itself always stays Latin-digit and LTR: `tel:` is a
            // protocol, not prose, and the dialler gets the raw string.
            href={`tel:${t(locale, `about.locations.${o}.phone`).replace(/\s/g, "")}`}
            dir="ltr"
          >
            {t(locale, `about.locations.${o}.phone`)}
          </a>
        </div>
      ))}
      <p className="offices__hours">{t(locale, "about.locations.hours")}</p>
    </div>
  );
}

export function Experience() {
  const locale = useLocale();

  return (
    <StoryPage
      beats={buildBeats(locale)}
      scene={(env) => <HomeScene {...env} />}
      showHint
      signed
      intro={<Intro locale={locale} />}
    >
      <div className="beat__actions">
        <Link className="btn btn--primary" href={`/${locale}/contact`}>
          {t(locale, "home.cta.button")}
        </Link>
        <Link className="btn btn--ghost" href={`/${locale}/services`}>
          {t(locale, "home.flow.cta_more")}
        </Link>
      </div>
      <Offices locale={locale} />
    </StoryPage>
  );
}
