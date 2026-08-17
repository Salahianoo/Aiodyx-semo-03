import { t, tList } from "@/lib/content";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export type Vec3 = [number, number, number];

/**
 * A module's *identity and geometry* — everything about it that does not
 * change with language or theme.
 *
 * Labels used to live here, which quietly made the whole table a function of
 * locale: the scenes import it for ring positions and cluster count, so a
 * translated label would have rebuilt the geometry every time the language
 * changed. Copy is looked up separately through `moduleCopy()`, and hues come
 * from `MODULE_HUES` in `theme.ts` for the same reason.
 */
export type ModuleDef = {
  id: string;
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
  { id: "finance", scattered: [-7.4, 3.1, -4.2] },
  { id: "crm", scattered: [6.9, 3.6, -6.1] },
  { id: "inventory", scattered: [-5.8, -3.4, -8.0] },
  { id: "hr", scattered: [7.8, -2.3, -3.0] },
  { id: "payroll", scattered: [-8.3, 0.5, -9.4] },
  { id: "projects", scattered: [4.1, 5.4, -10.5] },
  { id: "manufacturing", scattered: [-3.1, -5.2, -5.3] },
  { id: "support", scattered: [8.6, 1.4, -8.8] },
  { id: "bi", scattered: [-6.2, 5.0, -7.2] },
  { id: "ai", scattered: [2.4, -5.6, -9.9] },
] as const;

export const MODULES: ModuleDef[] = KEYS.map((m, i) => {
  const angle = (i / KEYS.length) * Math.PI * 2 - Math.PI / 2;
  return {
    id: m.id,
    scattered: m.scattered as unknown as Vec3,
    seed: i * 1.618,
    assembled: [
      Math.cos(angle) * RING_RADIUS,
      Math.sin(angle) * RING_RADIUS,
      Math.sin(i * 2.1) * 0.4,
    ] as Vec3,
  };
});

/** A module's name and description in one language. */
export const moduleCopy = (locale: Locale, id: string) => ({
  label: t(locale, `home.modules.${id}.name`),
  desc: t(locale, `home.modules.${id}.desc`),
});

/** Features for a module, used when the camera stops on it. */
export const moduleFeatures = (locale: Locale, id: string) =>
  tList(locale, `home.modules.${id}`, ["f1", "f2", "f3", "f4", "f5"]);

/**
 * Index of the first module beat in the beat list.
 *
 * The rig needs it to know which side the copy column is on for a given
 * module — <StoryOverlay> puts even-indexed beats on the left and odd on the
 * right — so it can park the focused field opposite it.
 *
 * Beat *ids* are the same in every language, so this is computed once against
 * the default locale rather than being made a function of one.
 */
export const moduleBeatOffset = () =>
  buildBeats(DEFAULT_LOCALE).findIndex((b) => b.id.startsWith("mod-"));

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
  /** Index into MODULES; the scene lights this cluster while the beat is on. */
  focus?: number;
};

/* The module tour owns the long middle of the page: one screen per module,
   each with its real name, description and feature list. */
const TOUR_START = 0.4;
const TOUR_END = 0.8;
const TOUR_SPAN = (TOUR_END - TOUR_START) / MODULES.length;

/**
 * Built per locale and cached.
 *
 * The cache is not an optimisation — <StoryOverlay> keys its measuring effect
 * on the beat array, so handing it a freshly built list on every render would
 * tear down and re-measure the whole page continuously, and the scenes read
 * those measurements. Same locale must mean the same array identity.
 */
const CACHE = new Map<Locale, Beat[]>();

export function buildBeats(locale: Locale): Beat[] {
  const cached = CACHE.get(locale);
  if (cached) return cached;

  const problem = (n: number): BeatItem => ({
    title: t(locale, `home.problems.p${n}.title`),
    text: t(locale, `home.problems.p${n}.text`),
  });

  const why = (n: number): BeatItem => ({
    title: t(locale, `home.why.feature${n}.title`),
    text: t(locale, `home.why.feature${n}.text`),
  });

  const beats: Beat[] = [
    {
      id: "open",
      from: 0,
      to: 0.05,
      kicker: t(locale, "home.hero.badge"),
      title: t(locale, "home.hero.title_line1"),
      body: t(locale, "home.hero.subtitle"),
    },
    {
      id: "problems",
      from: 0.06,
      to: 0.13,
      kicker: t(locale, "home.problems.eyebrow"),
      title: t(locale, "home.problems.title"),
      body: t(locale, "home.problems.subtitle"),
      items: [problem(1), problem(2), problem(3)],
    },
    {
      id: "problems-2",
      from: 0.14,
      to: 0.21,
      kicker: t(locale, "home.problems.eyebrow"),
      title: t(locale, "home.problems.p7.title"),
      body: t(locale, "home.problems.bridge"),
      items: [problem(4), problem(5), problem(6)],
    },
    {
      id: "flow",
      from: 0.22,
      to: 0.3,
      kicker: t(locale, "home.flow.eyebrow"),
      title: t(locale, "home.flow.title"),
      body: t(locale, "home.flow.subtitle"),
    },
    {
      id: "assembly",
      from: 0.31,
      to: 0.38,
      kicker: t(locale, "home.modules.eyebrow"),
      title: t(locale, "home.modules.title"),
      body: t(locale, "home.modules.subtitle"),
    },
    // One screen per module — the cards carry their own copy
    ...MODULES.map((m, i) => {
      const { label, desc } = moduleCopy(locale, m.id);
      return {
        id: `mod-${m.id}`,
        from: TOUR_START + i * TOUR_SPAN,
        to: TOUR_START + (i + 1) * TOUR_SPAN,
        // Latin digits in both languages: these are an index into a tour, and
        // Arabic-Indic numerals here would read as a different counter from
        // the "01 / 10" the eye is tracking down the page.
        kicker: `${String(i + 1).padStart(2, "0")} / ${MODULES.length}`,
        title: label,
        body: desc,
        points: moduleFeatures(locale, m.id),
        focus: i,
      };
    }),
    {
      id: "ai",
      from: 0.81,
      to: 0.87,
      kicker: t(locale, "home.ai_section.eyebrow"),
      title: t(locale, "home.ai_section.title"),
      body: t(locale, "home.ai_section.subtitle"),
      points: tList(locale, "home.ai_section", ["point1", "point2", "point4"]),
    },
    {
      id: "why",
      from: 0.88,
      to: 0.94,
      kicker: t(locale, "home.why.eyebrow"),
      title: t(locale, "home.why.title"),
      body: t(locale, "home.why.subtitle"),
      items: [why(1), why(2), why(3), why(4), why(5), why(6)],
    },
    {
      id: "close",
      from: 0.95,
      to: 1,
      kicker: t(locale, "brand.name"),
      title: t(locale, "home.cta.title"),
      body: t(locale, "home.cta.subtitle"),
    },
  ];

  CACHE.set(locale, beats);
  return beats;
}
