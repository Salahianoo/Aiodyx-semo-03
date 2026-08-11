import { t } from "@/lib/content";
import type { Beat } from "@/lib/story";

/** The five values become the five faces of the monolith. */
export const VALUES = [
  "understand",
  "custom",
  "evolution",
  "partnership",
  "support",
] as const;

export const FACET_COLORS = [
  "#A78BFA",
  "#8FA0F6",
  "#7BB7EE",
  "#6FCBE2",
  "#8B5CF6",
];

const VAL_START = 0.3;
const VAL_END = 0.72;
const VAL_SPAN = (VAL_END - VAL_START) / VALUES.length;

export const ABOUT_BEATS: Beat[] = [
  {
    id: "intro",
    from: 0,
    to: 0.08,
    kicker: t("about.hero.eyebrow"),
    title: t("about.story.title"),
    body: t("about.hero.subtitle"),
  },
  {
    id: "mission",
    from: 0.1,
    to: 0.18,
    kicker: t("about.mission.title"),
    title: t("about.story.quote"),
    body: t("about.mission.text"),
  },
  {
    id: "vision",
    from: 0.2,
    to: 0.28,
    kicker: t("about.vision.title"),
    title: t("about.vision.title"),
    body: t("about.vision.text"),
  },
  ...VALUES.map((v, i) => ({
    id: v,
    from: VAL_START + i * VAL_SPAN,
    to: VAL_START + (i + 1) * VAL_SPAN,
    kicker: t("about.values.eyebrow"),
    title: t(`about.values.${v}.title`),
    body: t(`about.values.${v}.text`),
  })),
  {
    id: "ceo",
    from: 0.74,
    to: 0.86,
    kicker: t("about.ceo.role"),
    title: t("about.ceo.quote"),
    body: `${t("about.ceo.p1")} — ${t("about.ceo.name")}`,
  },
  // Two stops on the ground. The camera leaves orbit and drops to street
  // level at each office before pulling back out for the close.
  {
    id: "amman",
    from: 0.86,
    to: 0.91,
    kicker: t("about.locations.eyebrow"),
    title: t("about.locations.jordan.country"),
    body: t("about.locations.jordan.address"),
    points: [t("about.locations.jordan.phone")],
  },
  {
    id: "riyadh",
    from: 0.91,
    to: 0.96,
    kicker: t("about.locations.eyebrow"),
    title: t("about.locations.saudi.country"),
    body: t("about.locations.saudi.address"),
    points: [t("about.locations.saudi.phone")],
  },
  {
    id: "close",
    from: 0.96,
    to: 1,
    kicker: t("about.locations.eyebrow"),
    title: t("about.locations.title"),
    body: t("about.locations.hours"),
    points: [
      t("about.locations.jordan.address"),
      t("about.locations.saudi.address"),
    ],
  },
];
