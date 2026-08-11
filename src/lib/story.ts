import { t, tList } from "@/lib/content";

export type Vec3 = [number, number, number];

export type ModuleDef = {
  id: string;
  label: string;
  /** Real description from the dictionary — rendered on the card itself. */
  desc: string;
  /** Muted hues — saturated colour reads as a toy, not a product. */
  color: string;
  scattered: Vec3;
  assembled: Vec3;
  /** Per-module drift offset so nothing moves in lockstep. */
  seed: number;
};

/* Cards carry a name AND a description, so they're wider than they are tall
   and the ring has to be big enough to seat ten of them without overlap:
   circumference must exceed count × (width + gap). */
export const CARD_W = 2.35;
export const CARD_H = 1.42;
const RING_RADIUS = 4.75;

/** The ten modules AIODYX actually builds, straight from the dictionary. */
const KEYS = [
  { id: "finance", color: "#A78BFA", scattered: [-7.4, 3.1, -4.2] },
  { id: "crm", color: "#7DD3FC", scattered: [6.9, 3.6, -6.1] },
  { id: "inventory", color: "#6EE7B7", scattered: [-5.8, -3.4, -8.0] },
  { id: "hr", color: "#F0ABFC", scattered: [7.8, -2.3, -3.0] },
  { id: "payroll", color: "#FCD34D", scattered: [-8.3, 0.5, -9.4] },
  { id: "projects", color: "#93C5FD", scattered: [4.1, 5.4, -10.5] },
  { id: "manufacturing", color: "#FDA4AF", scattered: [-3.1, -5.2, -5.3] },
  { id: "support", color: "#C4B5FD", scattered: [8.6, 1.4, -8.8] },
  { id: "bi", color: "#5EEAD4", scattered: [-6.2, 5.0, -7.2] },
  { id: "ai", color: "#D8B4FE", scattered: [2.4, -5.6, -9.9] },
] as const;

export const MODULES: ModuleDef[] = KEYS.map((m, i) => {
  const angle = (i / KEYS.length) * Math.PI * 2 - Math.PI / 2;
  return {
    id: m.id,
    label: t(`home.modules.${m.id}.name`),
    desc: t(`home.modules.${m.id}.desc`),
    color: m.color,
    scattered: m.scattered as unknown as Vec3,
    seed: i * 1.618,
    assembled: [
      Math.cos(angle) * RING_RADIUS,
      Math.sin(angle) * RING_RADIUS,
      Math.sin(i * 2.1) * 0.4,
    ] as Vec3,
  };
});

/** Features for a module, used when the camera stops on it. */
export const moduleFeatures = (id: string) =>
  tList(`home.modules.${id}`, ["f1", "f2", "f3", "f4", "f5"]);

/**
 * Index of the first module beat in BEATS.
 *
 * The rig needs it to know which side the copy column is on for a given
 * module — <StoryOverlay> puts even-indexed beats on the left and odd on the
 * right — so it can park the focused card in the opposite half.
 */
export const moduleBeatOffset = () =>
  BEATS.findIndex((b) => b.id.startsWith("mod-"));

/* ------------------------------------------------------------------ beats */

export type BeatItem = { title: string; text: string };

export type Beat = {
  id: string;
  /** Scroll range this beat owns, 0 → 1 across the document. */
  from: number;
  to: number;
  kicker?: string;
  title: string;
  body?: string;
  /** Pill list — short labels only. */
  points?: string[];
  /** Cards with a description each. */
  items?: BeatItem[];
  /** Index into MODULES; the scene lights this card while the beat is on. */
  focus?: number;
};

const problem = (n: number): BeatItem => ({
  title: t(`home.problems.p${n}.title`),
  text: t(`home.problems.p${n}.text`),
});

const why = (n: number): BeatItem => ({
  title: t(`home.why.feature${n}.title`),
  text: t(`home.why.feature${n}.text`),
});

/* The module tour owns the long middle of the page: one screen per module,
   each with its real name, description and feature list. */
const TOUR_START = 0.4;
const TOUR_END = 0.8;
const TOUR_SPAN = (TOUR_END - TOUR_START) / MODULES.length;

export const BEATS: Beat[] = [
  {
    id: "open",
    from: 0,
    to: 0.05,
    kicker: t("home.hero.badge"),
    title: t("home.hero.title_line1"),
    body: t("home.hero.subtitle"),
  },
  {
    id: "problems",
    from: 0.06,
    to: 0.13,
    kicker: t("home.problems.eyebrow"),
    title: t("home.problems.title"),
    body: t("home.problems.subtitle"),
    items: [problem(1), problem(2), problem(3)],
  },
  {
    id: "problems-2",
    from: 0.14,
    to: 0.21,
    kicker: t("home.problems.eyebrow"),
    title: t("home.problems.p7.title"),
    body: t("home.problems.bridge"),
    items: [problem(4), problem(5), problem(6)],
  },
  {
    id: "flow",
    from: 0.22,
    to: 0.3,
    kicker: t("home.flow.eyebrow"),
    title: t("home.flow.title"),
    body: t("home.flow.subtitle"),
  },
  {
    id: "assembly",
    from: 0.31,
    to: 0.38,
    kicker: t("home.modules.eyebrow"),
    title: t("home.modules.title"),
    body: t("home.modules.subtitle"),
  },
  // One screen per module — the cards now carry their own copy
  ...MODULES.map((m, i) => ({
    id: `mod-${m.id}`,
    from: TOUR_START + i * TOUR_SPAN,
    to: TOUR_START + (i + 1) * TOUR_SPAN,
    kicker: `${String(i + 1).padStart(2, "0")} / ${MODULES.length}`,
    title: m.label,
    body: m.desc,
    points: moduleFeatures(m.id),
    focus: i,
  })),
  {
    id: "ai",
    from: 0.81,
    to: 0.87,
    kicker: t("home.ai_section.eyebrow"),
    title: t("home.ai_section.title"),
    body: t("home.ai_section.subtitle"),
    points: tList("home.ai_section", ["point1", "point2", "point4"]),
  },
  {
    id: "why",
    from: 0.88,
    to: 0.94,
    kicker: t("home.why.eyebrow"),
    title: t("home.why.title"),
    body: t("home.why.subtitle"),
    items: [why(1), why(2), why(3), why(4), why(5), why(6)],
  },
  {
    id: "close",
    from: 0.95,
    to: 1,
    kicker: t("brand.name"),
    title: t("home.cta.title"),
    body: t("home.cta.subtitle"),
  },
];
