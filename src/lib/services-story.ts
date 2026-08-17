import { t, tList } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import type { Beat } from "@/lib/story";

/** The seven build stages, read straight from the AIODYX dictionary. */
export const STAGES = [
  "step1",
  "step2",
  "step3",
  "step4",
  "step5",
  "step6",
  "step7",
] as const;

/** Vertical spacing of the seven tiers. The camera climbs +Y as they build. */
export const TIER_GAP = 1.8;

export const tierY = (i: number) => i * TIER_GAP;

/** Top of the finished structure. */
export const TOP_Y = tierY(STAGES.length - 1);

/** A stage's caption, for the 3D tier labels. */
export const stageLabel = (locale: Locale, step: string) =>
  t(locale, `home.process.${step}.label`);

/* Beats: intro, seven stations, close. The stations own the long middle so
   each one gets a full screen of dwell time. */
const STATION_START = 0.1;
const STATION_END = 0.86;
const STATION_SPAN = (STATION_END - STATION_START) / STAGES.length;

/** See `buildBeats` in story.ts — same identity contract, same reason. */
const CACHE = new Map<Locale, Beat[]>();

export function buildServicesBeats(locale: Locale): Beat[] {
  const cached = CACHE.get(locale);
  if (cached) return cached;

  const beats: Beat[] = [
    {
      id: "intro",
      from: 0,
      to: 0.08,
      kicker: t(locale, "services.hero.eyebrow"),
      title: t(locale, "home.flow.title"),
      body: t(locale, "home.flow.subtitle"),
    },
    ...STAGES.map((step, i) => ({
      id: step,
      from: STATION_START + i * STATION_SPAN,
      to: STATION_START + (i + 1) * STATION_SPAN,
      kicker: `${String(i + 1).padStart(2, "0")} · ${stageLabel(locale, step)}`,
      title: t(locale, `home.process.${step}.title`),
      body: t(locale, `home.process.${step}.text`),
    })),
    {
      id: "close",
      from: 0.88,
      to: 1,
      kicker: t(locale, "services.categories.eyebrow"),
      title: t(locale, "services.cta.title"),
      body: t(locale, "services.cta.text"),
      // The concrete deliverables, so the page isn't only process
      points: tList(locale, "services", [
        "implementation.title",
        "customization.title",
        "integration.title",
        "migration.title",
        "training.title",
        "support.title",
      ]),
    },
  ];

  CACHE.set(locale, beats);
  return beats;
}
