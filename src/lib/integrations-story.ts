import { t, tList } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import type { Beat, BeatItem } from "@/lib/story";

/**
 * The three national platforms AIODYX connects Odoo to.
 *
 * Identity and geometry only — names and descriptions are looked up per
 * locale, for the same reason `ModuleDef` in story.ts keeps its labels out:
 * the scene imports this for lane positions, and a translated label would
 * rebuild the geometry every time the language changed.
 *
 * Ordered as the page walks them, which is also the order a document meets
 * them in a company's month: invoice out, wages filed, contracts kept.
 */
export const AUTHORITIES = [
  { id: "zatca", color: "#0E7490" },
  { id: "gosi", color: "#047857" },
  { id: "qiwa", color: "#1D4ED8" },
] as const;

export type AuthorityId = (typeof AUTHORITIES)[number]["id"];

/** Spacing of the gates down the lane. The camera tracks +X across them. */
export const GATE_GAP = 8.4;

/** The hub sits behind the first gate, so the lane starts before it does. */
export const HUB_X = -4.6;

export const gateX = (i: number) => i * GATE_GAP;

/** Far end of the conduit, past the last gate. */
export const LANE_END = gateX(AUTHORITIES.length - 1) + 4.6;

/** An authority's short name, for the 3D gate label. */
export const authorityName = (locale: Locale, id: string) =>
  t(locale, `integrations.${id}.name`);

/** And what it governs — the second line under it. */
export const authoritySubject = (locale: Locale, id: string) =>
  t(locale, `integrations.${id}.subject`);

/** See `buildBeats` in story.ts — same identity contract, same reason. */
const CACHE = new Map<Locale, Beat[]>();

export function buildIntegrationsBeats(locale: Locale): Beat[] {
  const cached = CACHE.get(locale);
  if (cached) return cached;

  const benefit = (n: number): BeatItem => ({
    title: t(locale, `integrations.why.b${n}.title`),
    text: t(locale, `integrations.why.b${n}.text`),
  });

  const step = (n: number): BeatItem => ({
    title: t(locale, `integrations.how.s${n}.title`),
    text: t(locale, `integrations.how.s${n}.text`),
  });

  /* Each authority owns a long stretch: the gate has to arrive, open, take a
     document and hand one back, and none of that reads if the camera is
     already leaving. */
  const GATE_START = 0.21;
  const GATE_SPAN = 0.185;

  const beats: Beat[] = [
    {
      id: "intro",
      from: 0,
      to: 0.07,
      kicker: t(locale, "integrations.hero.eyebrow"),
      title: t(locale, "integrations.hero.title"),
      body: t(locale, "integrations.hero.subtitle"),
    },
    {
      id: "why",
      from: 0.09,
      to: 0.18,
      kicker: t(locale, "integrations.why.eyebrow"),
      title: t(locale, "integrations.why.title"),
      body: t(locale, "integrations.why.subtitle"),
      items: [benefit(1), benefit(2), benefit(3), benefit(4)],
    },
    ...AUTHORITIES.map((a, i) => ({
      id: a.id,
      from: GATE_START + i * GATE_SPAN,
      to: GATE_START + (i + 1) * GATE_SPAN,
      // The authority's full legal name is the kicker rather than the title:
      // it is what proves which body is meant, but it is not the point being
      // made, and as a headline it would push the actual claim off the screen.
      kicker: `${t(locale, `integrations.${a.id}.eyebrow`)} · ${t(locale, `integrations.${a.id}.authority`)}`,
      title: t(locale, `integrations.${a.id}.title`),
      body: t(locale, `integrations.${a.id}.text`),
      points: tList(locale, `integrations.${a.id}`, ["p1", "p2", "p3", "p4", "p5"]),
      focus: i,
    })),
    {
      id: "how",
      from: 0.78,
      to: 0.87,
      kicker: t(locale, "integrations.how.eyebrow"),
      title: t(locale, "integrations.how.title"),
      body: t(locale, "integrations.how.subtitle"),
      items: [step(1), step(2), step(3), step(4)],
    },
    {
      id: "more",
      from: 0.88,
      to: 0.93,
      kicker: t(locale, "integrations.more.eyebrow"),
      title: t(locale, "integrations.more.title"),
      body: t(locale, "integrations.more.text"),
    },
    {
      id: "close",
      from: 0.94,
      to: 1,
      kicker: t(locale, "brand.name"),
      title: t(locale, "integrations.cta.title"),
      body: t(locale, "integrations.cta.text"),
    },
  ];

  CACHE.set(locale, beats);
  return beats;
}
