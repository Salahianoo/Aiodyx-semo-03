import { t, tList } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import type { Beat, BeatItem } from "@/lib/story";

/**
 * The three national platforms AIODYX connects Odoo to.
 *
 * Identity and geometry only — names and descriptions are looked up per
 * locale, for the same reason `ModuleDef` in story.ts keeps its labels out:
 * the scene imports this for ring positions, and a translated label would
 * rebuild the geometry every time the language changed.
 *
 * Ordered as the page walks them, which is also the order a document meets
 * them in a company's month: invoice out, wages filed, contracts kept. Each
 * platform's hue is its own, deepened for a light ground: ZATCA's shield-teal,
 * GOSI's green, QIWA's orange. The documents coming back down a spoke are the
 * colour of the mark that stamped them.
 */
export const AUTHORITIES = [
  // Angles, not lane positions: see `authorityPos`. Spaced 120° apart, with
  // the first at the top, so the three stand as a triangle about the hub and
  // none of them sits directly under it where the Odoo mark hangs.
  { id: "zatca", color: "#0E7490", angle: 90 },
  { id: "gosi", color: "#047857", angle: 210 },
  { id: "qiwa", color: "#B45309", angle: 330 },
] as const;

export type AuthorityId = (typeof AUTHORITIES)[number]["id"];

/**
 * The ring the platforms stand on, around your own system at the centre.
 *
 * An ellipse rather than a circle. On a circle wide enough to keep three marks
 * off each other, the top one climbs as far above the hub as the side ones sit
 * out from it — and a browser frame is half again as wide as it is tall, so
 * that spends height the page does not have and leaves the sides empty. Wider
 * than tall, the same clearance costs a frame the shape of the screen.
 */
export const RING_RX = 8;
/**
 * Taller than the frame alone would ask for, because of the top platform.
 *
 * At 4.8 the vertical run from the hub to ZATCA was 4.5 units and the two
 * lockups facing each other across it wanted more than that between them — the
 * spoke came out a negative length and simply was not drawn, so the one
 * platform standing straight above your system had no visible connection to
 * it. The ring has to be at least as big as the things standing on it.
 */
export const RING_RY = 6.6;

/**
 * Where a platform stands, in the plane the camera faces.
 *
 * `mirror` is −1 under Arabic, and the ring genuinely has to flip.
 *
 * <StoryOverlay> places each copy column with `flex-start`/`flex-end`, which
 * are *logical* — so every column swaps sides under RTL while a ring fixed in
 * world space does not. GOSI stands to the left of the hub and its beat reads
 * on the right in English; in Arabic that beat reads on the *left* and GOSI
 * was still on the left, so the mark landed on its own paragraph. No amount of
 * camera push fixes that: both things are on the same side of the hub, and
 * moving the camera moves them together.
 *
 * The marks themselves are not mirrored — only where they stand. A logotype
 * flipped is a different logo.
 */
export const authorityPos = (
  i: number,
  mirror: number,
): [number, number] => {
  const a = (AUTHORITIES[i].angle * Math.PI) / 180;
  return [mirror * RING_RX * Math.cos(a), RING_RY * Math.sin(a)];
};

/** The middle of the hub's stack — the AIODYX mark with Odoo under it. */
export const HUB_MID_Y = 0.3;

/**
 * The middle of the whole constellation, which is not the middle of the ring:
 * the top platform reaches further above the hub than the lower two reach
 * below it, because their captions hang under them and its does not.
 */
export const FIELD_MID_Y = 1.4;

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
