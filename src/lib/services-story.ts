import { t, tList } from "@/lib/content";
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

/** Hue per stage — a slow violet→cyan traverse as the build rises. */
export const STATION_COLORS = [
  "#A78BFA",
  "#9F8BF7",
  "#8B95F5",
  "#7DA5F2",
  "#6FB6EE",
  "#63C7E8",
  "#5AD6E0",
];

/* Beats: intro, seven stations, close. The stations own the long middle so
   each one gets a full screen of dwell time. */
const STATION_START = 0.1;
const STATION_END = 0.86;
const STATION_SPAN = (STATION_END - STATION_START) / STAGES.length;

export const SERVICES_BEATS: Beat[] = [
  {
    id: "intro",
    from: 0,
    to: 0.08,
    kicker: t("services.hero.eyebrow"),
    title: t("home.flow.title"),
    body: t("home.flow.subtitle"),
  },
  ...STAGES.map((step, i) => ({
    id: step,
    from: STATION_START + i * STATION_SPAN,
    to: STATION_START + (i + 1) * STATION_SPAN,
    kicker: `${String(i + 1).padStart(2, "0")} · ${t(`home.process.${step}.label`)}`,
    title: t(`home.process.${step}.title`),
    body: t(`home.process.${step}.text`),
  })),
  {
    id: "close",
    from: 0.88,
    to: 1,
    kicker: t("services.categories.eyebrow"),
    title: t("services.cta.title"),
    body: t("services.cta.text"),
    // The concrete deliverables, so the page isn't only process
    points: tList("services", [
      "implementation.title",
      "customization.title",
      "integration.title",
      "migration.title",
      "training.title",
      "support.title",
    ]),
  },
];
