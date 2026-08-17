import { t } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import type { Beat } from "@/lib/story";

/** The five values become the five satellites on the orbit. */
export const VALUES = [
  "understand",
  "custom",
  "evolution",
  "partnership",
  "support",
] as const;

const VAL_START = 0.3;
const VAL_END = 0.72;
const VAL_SPAN = (VAL_END - VAL_START) / VALUES.length;

/** See `buildBeats` in story.ts — same identity contract, same reason. */
const CACHE = new Map<Locale, Beat[]>();

export function buildAboutBeats(locale: Locale): Beat[] {
  const cached = CACHE.get(locale);
  if (cached) return cached;

  const beats: Beat[] = [
    {
      id: "intro",
      from: 0,
      to: 0.08,
      kicker: t(locale, "about.hero.eyebrow"),
      title: t(locale, "about.story.title"),
      body: t(locale, "about.hero.subtitle"),
    },
    {
      id: "mission",
      from: 0.1,
      to: 0.18,
      kicker: t(locale, "about.mission.title"),
      title: t(locale, "about.story.quote"),
      body: t(locale, "about.mission.text"),
    },
    {
      id: "vision",
      from: 0.2,
      to: 0.28,
      kicker: t(locale, "about.vision.title"),
      title: t(locale, "about.vision.title"),
      body: t(locale, "about.vision.text"),
    },
    ...VALUES.map((v, i) => ({
      id: v,
      from: VAL_START + i * VAL_SPAN,
      to: VAL_START + (i + 1) * VAL_SPAN,
      kicker: t(locale, "about.values.eyebrow"),
      title: t(locale, `about.values.${v}.title`),
      body: t(locale, `about.values.${v}.text`),
    })),
    {
      id: "ceo",
      from: 0.74,
      to: 0.86,
      kicker: t(locale, "about.ceo.role"),
      title: t(locale, "about.ceo.quote"),
      body: `${t(locale, "about.ceo.p1")} — ${t(locale, "about.ceo.name")}`,
    },
    // Two stops on the ground. The camera leaves orbit and drops to street
    // level at each office before pulling back out for the close.
    {
      id: "amman",
      from: 0.86,
      to: 0.91,
      kicker: t(locale, "about.locations.eyebrow"),
      title: t(locale, "about.locations.jordan.country"),
      body: t(locale, "about.locations.jordan.address"),
      points: [t(locale, "about.locations.jordan.phone")],
    },
    {
      id: "riyadh",
      from: 0.91,
      to: 0.96,
      kicker: t(locale, "about.locations.eyebrow"),
      title: t(locale, "about.locations.saudi.country"),
      body: t(locale, "about.locations.saudi.address"),
      points: [t(locale, "about.locations.saudi.phone")],
    },
    {
      id: "close",
      from: 0.96,
      to: 1,
      kicker: t(locale, "about.locations.eyebrow"),
      title: t(locale, "about.locations.title"),
      body: t(locale, "about.locations.hours"),
      points: [
        t(locale, "about.locations.jordan.address"),
        t(locale, "about.locations.saudi.address"),
      ],
    },
  ];

  CACHE.set(locale, beats);
  return beats;
}
