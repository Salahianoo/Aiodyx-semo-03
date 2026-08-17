"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import {
  BRAND_NAVY,
  WORDMARK_LETTER_PATHS,
  WORDMARK_MONOGRAM_PATHS,
  WORDMARK_PATHS,
  WORDMARK_VIEWBOX,
} from "@/components/brand";
import type { SceneEnv } from "@/components/story-page";
import { arabicFontUrl, displayCase, displayTracking } from "@/lib/fonts";
import type { Locale } from "@/lib/i18n";
import { MODULE_SCENES } from "@/lib/module-scenes";
import { ICON_COUNT, iconPoint } from "@/lib/icons";
import {
  ODOO_ACCENT_PATHS,
  ODOO_MAGENTA,
  ODOO_NEUTRAL,
  ODOO_PLAIN_PATHS,
  ODOO_VIEWBOX,
} from "@/lib/odoo-mark";
import { rasterize, shuffle, type MarkSample } from "@/lib/raster";
import { buildBeats, MODULES, moduleBeatOffset, moduleCopy } from "@/lib/story";
import {
  clamp,
  damp,
  owns,
  range,
  rangeOf,
  scroll,
  sideSign,
  smooth,
} from "@/lib/scroll";
import { MODULE_HUES, SCENE } from "@/lib/theme";
import { Starfield } from "./starfield";

/**
 * One field of points, re-formed eight times.
 *
 * Every other page here builds an object and moves a camera around it. This
 * one has no object: the same twelve thousand points are the scattered data,
 * the assembled core, the ten modules and the logotype, and the story is the
 * transitions between those states. Nothing is created or destroyed the whole
 * way down, which is the argument the page is making — these are not separate
 * tools that get replaced, it is the same material organised.
 *
 * That also settles the motion problem. Home cannot converge-and-orbit without
 * repeating what it used to do, and it cannot climb or rotate without
 * repeating services and about. Transformation in place is nobody else's.
 *
 * ## Why the blend is eight attributes and not a morph target
 *
 * Each point carries all eight of its positions at once (`aPos0`…`aPos7`) and
 * the vertex shader sums them against eight uniform weights. So a frame costs
 * one multiply-add per formation and the CPU touches nothing but the weights —
 * no per-frame buffer upload, and no interpolation state anywhere.
 *
 * Which means the scene is a pure function of scroll position. Scrubbing
 * backwards is not a reversal that has to be computed, it is the same
 * evaluation at a smaller number, so the field cannot drift out of sync with
 * the copy however fast the timeline is dragged.
 */

const COUNT = 12000;
const CLUSTERS = MODULES.length; // 10

/**
 * Logotype size at the finale, and its true aspect.
 *
 * Sized and dropped to clear the closing copy, which is the tallest block on
 * the page — headline, subtitle, two buttons and the office cards. The mark
 * signs off underneath all of it rather than sitting behind it.
 */
const MARK_W = 6.8;
const MARK_AR = WORDMARK_VIEWBOX.h / WORDMARK_VIEWBOX.w;

/**
 * Where the ten module clusters sit. Kept inside the frustum's *short* axis —
 * at 5.5 the ring fitted the frame's width and was cropped top and bottom.
 */
const RING_R = 4.5;

/**
 * The signature in the middle of the ring: AIODYX, and Odoo under it.
 *
 * The hub used to hold a wireframe icosahedron — the last abstract object left
 * on a page that had become entirely depiction, and the one thing on it that
 * appeared rather than resolved. These are the same twelve thousand points, so
 * the lockup arrives on the same weight blend as everything else and cannot
 * pop.
 *
 * Sized against the hub's clear radius. The clusters sit at 4.5 with a 0.72
 * spread, so anything inside about 3.2 is safe; the far corner of this stack
 * lands at 2.7.
 */
const HUB_MARK_W = 4.4;
const HUB_MARK_Y = 0.66;
// Two thirds of AIODYX rather than under half. At 1.9 the two marks read as a
// logo and a footnote instead of a lockup, and "odoo" is four letters inside
// what was 125 screen pixels.
const HUB_ODOO_W = 2.4;
const HUB_ODOO_Y = -0.72;
const HUB_RULE_Y = -0.06;
const HUB_RULE_W = 0.8;
/**
 * Thick enough to survive the idle drift.
 *
 * At 0.022 the rule was thinner than the breath moving it, so it arrived as a
 * band of specks. A line has to be wider than the noise displacing it or it is
 * not a line.
 */
const HUB_RULE_T = 0.055;

/**
 * Which points make up the hub, spread through the field rather than taken as
 * a block. Every point also has a position in every other formation, and a
 * contiguous slice would arrive at the ring as one lump of the cluster it came
 * from.
 */
const HUB_EVERY = 50;
const HUB_TAKE = 15;
const isHub = (i: number) => i % HUB_EVERY < HUB_TAKE;

/** Colour bands for the hub, read as `aHub` in the shader. */
const HUB = { none: 0, letters: 1, monogram: 2, odooA: 3, odooB: 4 } as const;

/**
 * The icon ring. An ellipse rather than a circle, because the hole in the
 * middle has to clear a copy block that is far wider than it is tall — a
 * circle big enough to clear it sideways runs off the top of the frame.
 *
 * Six glyphs at 60° steps means none of them lands at twelve or six o'clock,
 * which is where the headline and the trust line reach furthest.
 */
const ICON_RX = 9.9;
const ICON_RY = 5.4;
const ICON_SIZE = 2.9;

/**
 * Where the six glyphs go once the ring breaks apart, and how they tumble.
 *
 * The scatter beat's copy is "Your Business Runs on Separate Tools — Not One
 * System", so this formation *is* that sentence: the same six glyphs, still in
 * their own colours, flung to their own corners of a volume and each turning
 * on its own axis. It used to be seven anonymous gaussian clumps, which said
 * "some stuff is scattered" and nothing more specific than that.
 *
 * Unlike every other formation this one is not a baked attribute — it is
 * rebuilt in the vertex shader each frame from the glyph's local coordinates,
 * because a rotation cannot be baked and still be driven by scroll.
 */
const SCATTER_SIZE = 2.6;

/**
 * All six start in the *leading* half and sweep to the trailing one.
 *
 * Both scatter beats share this formation but <StoryOverlay> alternates their
 * copy column — `problems` reads right, `problems-2` reads left — so any fixed
 * arrangement puts glyphs under one of them. Rather than compromise between
 * the two, the cloud crosses the frame as you scroll: it sits clear on the
 * left while the first list is being read, and clear on the right by the time
 * the second one is, passing through the middle only while both columns are
 * mid-fade.
 *
 * The z spread is doing as much work as the x. At 14.5 back, +3.0 and −7.0 are
 * a 2:1 difference in apparent size, which is what stops six flat drawings
 * from reading as wallpaper.
 */
const SCATTER_CENTERS = [
  new THREE.Vector3(-5.8, 2.4, 2.0),
  new THREE.Vector3(-3.0, -3.2, -2.5),
  new THREE.Vector3(-5.2, -2.6, -4.5),
  new THREE.Vector3(-2.2, 3.3, 0.5),
  new THREE.Vector3(-4.0, 2.6, -7.0),
  new THREE.Vector3(-2.6, -1.6, 3.0),
];

/** How far the cloud travels across the frame over the two scatter beats. */
const SCATTER_SWEEP = 8.4;
/** Spread at the end of the sweep — the funnel has to start from here. */
const SCATTER_SPREAD_END = 1.2;

/**
 * Tumble axes, deliberately weighted toward Z.
 *
 * A glyph is a flat drawing. Turned about X or Y it goes edge-on and vanishes
 * — which is the trap the logotype and the figure both had to dodge by
 * suppressing rotation outright. Spun about Z it stays face-on and simply
 * rolls. These sit near Z with enough tilt to read as real 3D rotation rather
 * than a sprite spinning, and never far enough to disappear.
 */
const SCATTER_AXES = [
  new THREE.Vector3(0.28, 0.15, 0.95).normalize(),
  new THREE.Vector3(-0.2, 0.35, 0.91).normalize(),
  new THREE.Vector3(0.34, -0.22, 0.91).normalize(),
  new THREE.Vector3(-0.3, -0.25, 0.92).normalize(),
  new THREE.Vector3(0.15, 0.4, 0.9).normalize(),
  new THREE.Vector3(-0.38, 0.12, 0.92).normalize(),
];

const NODES = Array.from({ length: CLUSTERS }, (_, i) => {
  const a = (i / CLUSTERS) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(
    Math.cos(a) * RING_R,
    Math.sin(a) * RING_R,
    Math.sin(i * 2.1) * 0.5,
  );
});

/* ------------------------------------------------------------ formations */

/**
 * Six ERP glyphs on a wide ring, with the hero copy sitting in the hub.
 *
 * This replaces the formless haze the page used to open on. The haze was
 * deliberately faint so the headline could win, which it did — by saying
 * nothing at all. A ring says what the product is before a word is read, and
 * it is the one arrangement that fills the frame without putting anything
 * behind the copy: a grid or a scatter would have to sit under it.
 */
const ICONS = 0;
const SCATTER = 1;
const FUNNEL = 2;
const RING = 3;
const WEAVE = 4;
const LATTICE = 5;
const MARK = 6;
/**
 * The ten module scenes — one image per module, held in a data texture rather
 * than in ten attributes. See MODULE_TEX below for why.
 */
const MODULE = 7;
const FORMS = 8;

/** Which formation each beat holds. */
function formationOf(id: string) {
  if (id.startsWith("mod-")) return MODULE;
  switch (id) {
    case "open":
      return ICONS;
    case "problems":
    case "problems-2":
      return SCATTER;
    case "flow":
      return FUNNEL;
    // The overview, and the one place all ten names are on screen at once.
    // This used to be a dense shell — the "one system" image — but the funnel
    // already converges to a core, and once every module beat became its own
    // scene the ring had no other beat left to appear in. Losing it would have
    // cost the page the only moment that says *here is everything in it*.
    case "assembly":
      return RING;
    case "ai":
      return WEAVE;
    case "why":
      return LATTICE;
    case "close":
      return MARK;
    default:
      return ICONS;
  }
}

/** How far the camera sits back while each formation holds the frame. */
// The icon ring is furthest back: its six glyphs have to clear a centred hero
// block that is ~12 units wide and ~8 tall at this distance, so the ring is
// wider than anything else on the page and the camera has to see all of it.
// The module ring is next — it holds ten labels as well as ten clusters.
// The module scenes are ~6.2 units tall and have to clear the nav; at 42° fov,
// 11.0 back shows 8.4 units of height. Close enough that the Odoo wordmark on
// a held screen has pixels to land on, which is the tightest detail any of the
// ten has to carry.
const DISTANCE = [20.0, 14.5, 11.5, 17.8, 12.6, 12.2, 12.7, 11.0];
/** And how high it rides. */
// Lifted toward the ledger, since the origin sits at hip height.
// Near zero for the icons: they are flat glyphs and a raised camera
// foreshortens them into ellipses.
const HEIGHT = [0.2, 1.0, 0.7, 0.6, 0.5, 0.9, 0.2, 0.35];
/**
 * Per-formation opacity, blended by the same weights as everything else.
 *
 * The copy sits on top of this and has to win. A formation spread wide enough
 * to fill the frame — the opening haze especially — has to be much fainter
 * than a compact one to put the same amount of light on screen, so density is
 * paid for here rather than by thinning the field itself.
 */
const ALPHA = [0.85, 0.55, 0.7, 0.85, 0.8, 0.7, 1.0, 0.98];

/**
 * Per-formation point size, blended by the same weights as everything else.
 *
 * Point size falls off with camera distance (`42 / -mv.z`), and the icon ring
 * is the furthest back anything gets — at 20 units its points land at barely
 * two pixels, which turns a drawn glyph into speckle. A formation that has to
 * be *read* rather than felt needs its marks to hold together, so it pays for
 * that here rather than by crowding the camera in.
 */
// The ring sits second-furthest back, and now carries a logotype in its hub —
// at 17.8 its points land near two and a half pixels, which is speckle rather
// than letterforms.
const SIZE = [1.75, 1, 1, 1.45, 1, 1, 1, 1];

/**
 * Per-formation turbulence, and the reason detailed formations need it.
 *
 * A held formation should breathe or a beat you dwell on turns into a
 * photograph — but the breath is ±0.12 world units, and the strokes of the
 * Odoo wordmark on the accountant's ledger are about 0.09 thick. The idle
 * animation was wider than the thing it was animating, which turned four
 * letterforms into one smear.
 *
 * Blended by the same weights as everything else, so a formation made of
 * clouds keeps its full breath and a formation made of drawing gets almost
 * none.
 */
// Same lesson the Odoo mark taught on the ledger: the ±0.12 idle breath is as
// wide as a wordmark's strokes. At 0.4 the drift was still a third of the
// stroke width on "odoo" and its letters ran together. The clusters give up
// nearly all their drift so the signature between them stays crisp — they are
// clouds, and a cloud that breathes less is not a cloud that looks wrong.
const TURB = [0.65, 1, 1, 0.22, 1, 1, 0.4, 0.18];

/** Deterministic PRNG — the field must be identical on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The logotype, as points.
 *
 * The outlines are filled onto a canvas and the opaque pixels are sampled, so
 * the finale resolves into the actual mark. Rasterising is the only way to get
 * a *fill* — walking the path data would only ever give the outline, and the
 * mark would come out hollow.
 */
function markPoints(rand: () => number): [number, number][] {
  return shuffle(rasterize(WORDMARK_PATHS, WORDMARK_VIEWBOX, 420), rand);
}

/**
 * The AIODYX mark, split into letters and monogram.
 *
 * Rasterised at one width so both halves land in the same coordinate system —
 * the monogram has to sit where it belongs beside "ODYX" rather than being
 * re-fitted to its own bounding box.
 */
function aiodyxSample(rand: () => number): MarkSample {
  const W = 360;
  return {
    accent: shuffle(rasterize(WORDMARK_MONOGRAM_PATHS, WORDMARK_VIEWBOX, W), rand),
    plain: shuffle(rasterize(WORDMARK_LETTER_PATHS, WORDMARK_VIEWBOX, W), rand),
    aspect: WORDMARK_VIEWBOX.h / WORDMARK_VIEWBOX.w,
  };
}

/**
 * The Odoo mark, sampled once for the accountant's ledger.
 *
 * Both halves are rasterised at the same width, so they land in the same
 * coordinate system and the accent letter sits where it belongs relative to
 * the other three rather than being re-fitted to its own bounding box.
 */
function odooSample(rand: () => number): MarkSample {
  const W = 300;
  return {
    accent: shuffle(rasterize(ODOO_ACCENT_PATHS, ODOO_VIEWBOX, W), rand),
    plain: shuffle(rasterize(ODOO_PLAIN_PATHS, ODOO_VIEWBOX, W), rand),
    aspect: ODOO_VIEWBOX.h / ODOO_VIEWBOX.w,
  };
}

type Field = {
  geometry: THREE.BufferGeometry;
  moduleTex: THREE.DataTexture;
};

/**
 * The ten module scenes live in a data texture, not in ten attributes.
 *
 * Every other formation is a `vec3` attribute the vertex shader sums. Ten more
 * would put the geometry at 23 vertex attributes, and WebGL only guarantees
 * **16** — the page would render on the machine it was built on and fail on a
 * good share of the ones it ships to.
 *
 * A texture has none of that ceiling. It is uploaded once, the scene stays a
 * pure function of scroll, and adding an eleventh module costs a row rather
 * than an attribute. The cost is a vertex texture fetch, which every WebGL2
 * context supports.
 *
 * Laid out a whole number of rows per module, so locating a point is two cheap
 * operations rather than a division across the whole table.
 */
const MOD_TEX_W = 1024;
const MOD_ROWS = Math.ceil(COUNT / MOD_TEX_W);

function buildField(): Field {
  const rand = mulberry32(0x0d1a);
  const pos = Array.from({ length: FORMS }, () => new Float32Array(COUNT * 3));
  const cluster = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);
  /** Which of the six ERP glyphs a point belongs to, for its tint. */
  const icon = new Float32Array(COUNT);
  /**
   * The point's place inside its own glyph, in the ±0.5 authoring box.
   *
   * Three formations are built from this — the ring, the scatter and the
   * funnel — and the scatter needs it at *render* time rather than build time,
   * because that is the one that rotates with scroll.
   */
  const local = new Float32Array(COUNT * 3);
  /** The point's row in the module texture. */
  const index = new Float32Array(COUNT);
  /** Which band of the hub lockup a point belongs to; 0 for everything else. */
  const hub = new Float32Array(COUNT);

  const gauss = () =>
    (rand() + rand() + rand() + rand() - 2) * 0.7; // cheap normal-ish

  const nodes = NODES;
  const marks = markPoints(rand);
  const odoo = odooSample(rand);
  const aiodyx = aiodyxSample(rand);
  const v = new THREE.Vector3();
  const g2 = { x: 0, y: 0 };

  for (let i = 0; i < COUNT; i++) {
    const c = i % CLUSTERS;
    cluster[i] = c;
    seed[i] = rand();
    const k = i * 3;

    /* 0 — ICONS: six ERP glyphs on a wide ring, hero copy in the hub. Each
       glyph is authored flat in a ±0.5 box and placed here, so none of the
       drawing code in icons.ts knows anything about the ring. */
    index[i] = i;
    const ic = i % ICON_COUNT;
    icon[i] = ic;
    iconPoint(rand, g2, ic);
    // Kept in unit-box terms so every formation that uses the glyph can pick
    // its own scale. Thin, but not zero: a perfectly flat sheet turned edge-on
    // is a line, and the scatter turns these.
    const lz = gauss() * 0.055;
    local[k] = g2.x;
    local[k + 1] = g2.y;
    local[k + 2] = lz;

    const ia = (ic / ICON_COUNT) * Math.PI * 2;
    pos[ICONS][k] = Math.cos(ia) * ICON_RX + g2.x * ICON_SIZE;
    pos[ICONS][k + 1] = Math.sin(ia) * ICON_RY + g2.y * ICON_SIZE;
    pos[ICONS][k + 2] = lz * ICON_SIZE;

    /* 1 — SCATTER has no baked positions. It is the one formation rebuilt in
       the vertex shader every frame, from `aLocal` and the scroll-driven spin
       and spread uniforms. See SCATTER_CENTERS above. */

    /* 2 — FUNNEL: the six scattered glyphs drawn inward on a twist. They
       arrive at the centre still holding their shape for most of the way,
       which is what makes the flow beat read as things being *gathered*
       rather than as a new cloud fading up. */
    /**
     * Gathers from the *left*, mirroring where the sweep left the glyphs.
     *
     * Continuity with the scatter's final positions was the obvious thing to
     * want, and it was wrong: the flow beat's copy column is on the right,
     * exactly where the sweep parks the cloud, so a funnel that started there
     * laid a dense spiral straight over the body text. The glyphs have to
     * cross back regardless — so the crossing becomes the transition, and
     * "one team builds your full system" gets a field flowing in toward the
     * centre from the empty half of the frame.
     */
    const cen = SCATTER_CENTERS[ic];
    const ex = cen.x * SCATTER_SPREAD_END;
    const ey = cen.y * SCATTER_SPREAD_END;
    const ez = cen.z * SCATTER_SPREAD_END;
    const t = Math.pow(rand(), 0.65);
    const twist = t * 2.4;
    const cs = Math.cos(twist);
    const sn = Math.sin(twist);
    const keep = (1 - t) * 0.85;
    const fx = ex * (1 - t) + g2.x * SCATTER_SIZE * keep;
    const fz = ez * (1 - t) + lz * SCATTER_SIZE * keep;
    pos[FUNNEL][k] = fx * cs - fz * sn;
    pos[FUNNEL][k + 1] =
      ey * (1 - t) + g2.y * SCATTER_SIZE * keep + gauss() * 0.3;
    pos[FUNNEL][k + 2] = fx * sn + fz * cs;

    /* 4 — RING: the core opened out into ten seated clusters. Roughly a
       seventh of the field stays on the ring itself, so the modules read as
       joined rather than as ten separate clouds. */
    const node = nodes[c];
    if (isHub(i)) {
      // The signature in the hole. Sampled by area within each mark so the
      // monogram, which is two glyphs of six, does not come out three times
      // denser than the letters beside it.
      const band = rand();
      if (band < 0.04) {
        // A rule between the two marks. Stacked bare they read as two
        // unrelated logos; this makes it one "X, built on Y" lockup.
        pos[RING][k] = (rand() - 0.5) * HUB_RULE_W;
        pos[RING][k + 1] = HUB_RULE_Y + (rand() - 0.5) * HUB_RULE_T;
        hub[i] = HUB.odooB;
      } else if (band < 0.34) {
        // Sampled by area within each mark, so the accent letter does not come
        // out denser than the neutral ones beside it.
        const total = odoo.accent.length + odoo.plain.length;
        const useA = total > 0 && rand() * total < odoo.accent.length;
        const src = useA ? odoo.accent : odoo.plain;
        const [mx, my] = src.length ? src[Math.floor(rand() * src.length)] : [0, 0];
        pos[RING][k] = mx * HUB_ODOO_W;
        pos[RING][k + 1] = HUB_ODOO_Y + my * HUB_ODOO_W * odoo.aspect;
        hub[i] = useA ? HUB.odooA : HUB.odooB;
      } else {
        const total = aiodyx.accent.length + aiodyx.plain.length;
        const useA = total > 0 && rand() * total < aiodyx.accent.length;
        const src = useA ? aiodyx.accent : aiodyx.plain;
        const [mx, my] = src.length ? src[Math.floor(rand() * src.length)] : [0, 0];
        pos[RING][k] = mx * HUB_MARK_W;
        pos[RING][k + 1] = HUB_MARK_Y + my * HUB_MARK_W * aiodyx.aspect;
        hub[i] = useA ? HUB.monogram : HUB.letters;
      }
      pos[RING][k + 2] = gauss() * 0.1;
    } else if (i % 7 === 0) {
      const a = rand() * Math.PI * 2;
      pos[RING][k] = Math.cos(a) * RING_R + gauss() * 0.13;
      pos[RING][k + 1] = Math.sin(a) * RING_R + gauss() * 0.13;
      pos[RING][k + 2] = gauss() * 0.13;
    } else {
      pos[RING][k] = node.x + gauss() * 0.72;
      pos[RING][k + 1] = node.y + gauss() * 0.72;
      pos[RING][k + 2] = node.z + gauss() * 0.5;
    }

    /* 5 — WEAVE: every cluster wired through the middle. The assistant is the
       only beat where the centre is busier than the ring. */
    const u = rand();
    if (u < 0.62) {
      const s2 = Math.pow(rand(), 0.8);
      const sag = Math.sin(s2 * Math.PI) * 0.9;
      pos[WEAVE][k] = node.x * s2 + gauss() * 0.16;
      pos[WEAVE][k + 1] = node.y * s2 + gauss() * 0.16 - sag * 0.3;
      pos[WEAVE][k + 2] = node.z * s2 + sag;
    } else {
      const next = nodes[(c + 1) % CLUSTERS];
      const s2 = rand();
      const bow = Math.sin(s2 * Math.PI) * 1.5;
      pos[WEAVE][k] = THREE.MathUtils.lerp(node.x, next.x, s2) * (1 - bow * 0.12);
      pos[WEAVE][k + 1] = THREE.MathUtils.lerp(node.y, next.y, s2) * (1 - bow * 0.12);
      pos[WEAVE][k + 2] = THREE.MathUtils.lerp(node.z, next.z, s2) + gauss() * 0.2;
    }

    /* 6 — LATTICE: order. Six columns, because there are six reasons. */
    const gx = i % 6;
    const gy = Math.floor(i / 6) % 6;
    const gz = Math.floor(i / 36) % 7;
    pos[LATTICE][k] = (gx - 2.5) * 1.75 + gauss() * 0.1;
    pos[LATTICE][k + 1] = (gy - 2.5) * 1.35 + gauss() * 0.1;
    pos[LATTICE][k + 2] = (gz - 3) * 1.35 + gauss() * 0.1;

    /* 7 — MARK. Sized to sit under the closing copy rather than behind it:
       the last beat is centred, so a full-frame logotype and the CTA fight
       over the same middle. */
    if (marks.length) {
      const [mx, my] = marks[i % marks.length];
      // Both axes come back normalised to ±0.5 against their *own* dimension,
      // so scaling them by the same number squares up a mark that is nearly
      // five times wider than it is tall. The height carries the aspect.
      pos[MARK][k] = mx * MARK_W;
      // Raised from −4.1 once the closing copy gave up its bottom padding.
      // At −4.1 the mark sat flush against the bottom edge of the frame with
      // five pixels to spare and its top overlapping the working-week line.
      pos[MARK][k + 1] = my * MARK_W * MARK_AR - 3.5;
      pos[MARK][k + 2] = gauss() * 0.2;
    } else {
      // Only reachable if the canvas refused a 2D context. A shell is a
      // graceful nothing; a pile at the origin is not.
      v.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(2.05);
      pos[MARK][k] = v.x;
      pos[MARK][k + 1] = v.y;
      pos[MARK][k + 2] = v.z;
    }
  }

  /* ------------------------------------------------------- module scenes */

  const modCount = MODULES.length;
  const modData = new Float32Array(MOD_TEX_W * MOD_ROWS * modCount * 4);

  for (let m = 0; m < modCount; m++) {
    const scene = MODULE_SCENES[MODULES[m].id];
    for (let i = 0; i < COUNT; i++) {
      const t = (m * MOD_ROWS * MOD_TEX_W + i) * 4;
      if (scene) {
        // `w` carries the palette slot, not an alpha — see `slotColor` in the
        // shader. Packing it here means one fetch does position and colour.
        modData[t + 3] = scene(rand, v, i / COUNT, odoo);
        modData[t] = v.x;
        modData[t + 1] = v.y;
        modData[t + 2] = v.z;
      } else {
        // A module with no scene falls back to its cluster on the ring, so a
        // missing entry is a plain image rather than a pile at the origin.
        modData[t] = pos[RING][i * 3];
        modData[t + 1] = pos[RING][i * 3 + 1];
        modData[t + 2] = pos[RING][i * 3 + 2];
        modData[t + 3] = 1;
      }
    }
  }

  const moduleTex = new THREE.DataTexture(
    modData,
    MOD_TEX_W,
    MOD_ROWS * modCount,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  // Nearest, and no mipmaps: these are exact per-point records, and any
  // filtering would blend one point's position into its neighbour's.
  moduleTex.minFilter = THREE.NearestFilter;
  moduleTex.magFilter = THREE.NearestFilter;
  moduleTex.generateMipmaps = false;
  moduleTex.needsUpdate = true;

  const geometry = new THREE.BufferGeometry();
  // `position` is never read by the shader — the blended sets are. It exists
  // so three can count vertices.
  geometry.setAttribute("position", new THREE.BufferAttribute(pos[ICONS], 3));
  for (const f of STATIC_FORMS) {
    geometry.setAttribute(`aPos${f}`, new THREE.BufferAttribute(pos[f], 3));
  }
  geometry.setAttribute("aCluster", new THREE.BufferAttribute(cluster, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute("aIcon", new THREE.BufferAttribute(icon, 1));
  geometry.setAttribute("aLocal", new THREE.BufferAttribute(local, 3));
  geometry.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
  geometry.setAttribute("aHub", new THREE.BufferAttribute(hub, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

  return { geometry, moduleTex };
}

/* -------------------------------------------------------------- material */

const UNIFORMS = {
  uW: { value: new Float32Array(FORMS) },
  uTime: { value: 0 },
  uTurb: { value: 0 },
  uFocus: { value: -1 },
  uFocusAmt: { value: 0 },
  uAlpha: { value: 0.3 },
  /**
   * Points are small on purpose. The first pass used 2.6 against a 300 unit
   * scale, which put ~46px sprites on screen: twelve thousand of those,
   * additive, is twenty million fragments a frame — it saturated to flat white
   * and dropped the framerate far enough to be visible.
   */
  uSize: { value: 1.25 * SCENE.size },
  uBase: { value: new THREE.Color(SCENE.base) },
  uCluster: {
    value: MODULES.map((m) => new THREE.Color(MODULE_HUES[m.id])),
  },
  /**
   * Corrects for normal blending: points that do not accumulate need more
   * coverage each to put the same density on screen. See `ScenePalette.alpha`.
   */
  uAlphaScale: { value: SCENE.alpha },
  /** The blended `SIZE` table above. */
  uSizeMul: { value: SIZE[ICONS] },
  /** Where each glyph flies to when the ring breaks. */
  uScatterC: { value: SCATTER_CENTERS.map((v) => v.clone()) },
  uScatterAxis: { value: SCATTER_AXES.map((v) => v.clone()) },
  /**
   * The two scroll-driven halves of the scatter animation: how far each glyph
   * has turned, and how far apart they have drifted. Both are pure functions
   * of scroll position — no damping, no state — so scrubbing backwards runs
   * the tumble backwards exactly.
   */
  uSpin: { value: 0 },
  uSpread: { value: 1 },
  /** How far along the sweep the cloud has travelled, sign included. */
  uShift: { value: 0 },
  /** +1 while the copy reads left-to-right, −1 when it reads right-to-left. */
  uMirror: { value: 1 },
  /**
   * The module scenes, and which two of them are on screen.
   *
   * `uModMix` cross-fades A into B, so scrolling from one module to the next
   * morphs one image into the other rather than cutting.
   */
  uModTex: { value: null as THREE.Texture | null },
  uModTexel: { value: new THREE.Vector2(1 / MOD_TEX_W, 1) },
  uModRows: { value: MOD_ROWS },
  uModA: { value: 0 },
  uModB: { value: 0 },
  uModMix: { value: 0 },
  /** Fixed slots in the scene palette; the accent comes from the module. */
  uBrand: { value: new THREE.Color(BRAND_NAVY) },
  uOdooA: { value: new THREE.Color(ODOO_MAGENTA) },
  uOdooB: { value: new THREE.Color(ODOO_NEUTRAL) },
  uWarm: { value: new THREE.Color(MODULE_HUES.payroll) },
  /**
   * A hue per ERP glyph.
   *
   * Borrowed from the module palette rather than invented, so the opening and
   * the module tour are visibly the same set of colours — six of the ten,
   * picked to sit apart from each other around the ring.
   */
  uIcon: {
    value: [
      MODULE_HUES.bi,
      MODULE_HUES.projects,
      MODULE_HUES.manufacturing,
      MODULE_HUES.finance,
      MODULE_HUES.inventory,
      MODULE_HUES.payroll,
    ].map((c) => new THREE.Color(c)),
  },
};

/**
 * The blend, generated rather than typed out.
 *
 * This sum used to be eight hand-written terms, and the README carried a
 * standing warning that adding a formation meant remembering to edit the
 * shader as well as the tables. Adding the ninth is what made that warning
 * worth removing instead of heeding: the loop below cannot fall out of step
 * with `FORMS`.
 */
/**
 * Formations stored as a baked attribute.
 *
 * SCATTER is missing on purpose: it is rebuilt in the shader from `aLocal`
 * every frame, because a rotation driven by scroll cannot be baked into a
 * buffer. Everything that walks the formation list for *geometry* has to use
 * this rather than `FORMS`, or it uploads an attribute the shader never
 * declares.
 */
const STATIC_FORMS = Array.from({ length: FORMS }, (_, f) => f).filter(
  (f) => f !== SCATTER,
);

const POS_ATTRS = STATIC_FORMS.map(
  (f) => `attribute vec3 aPos${f};`,
).join("\n    ");

/**
 * The funnel is the one baked formation that is mirrored.
 *
 * It gathers from the half of the frame the copy column is not using, and
 * <StoryOverlay> puts that column on the opposite side under Arabic — so a
 * fixed funnel lays its densest streams straight over the headline on /ar.
 * Everything else here is either centred on the origin or, like the ring and
 * the logotype, would come out backwards if flipped.
 */
const POS_BLEND = STATIC_FORMS.map((f) =>
  f === FUNNEL
    ? `vec3(aPos${f}.x * uMirror, aPos${f}.yz) * uW[${f}]`
    : `aPos${f} * uW[${f}]`,
).join("\n        + ");

const MATERIAL = new THREE.ShaderMaterial({
  uniforms: UNIFORMS,
  transparent: true,
  depthWrite: false,
  // Normal, not additive: additive adds its colour to what is behind it, and
  // on paper that is a no-op — the entire field would render blank.
  blending: THREE.NormalBlending,
  vertexShader: /* glsl */ `
    ${POS_ATTRS}
    attribute float aCluster;
    attribute float aSeed;
    attribute float aIndex;
    attribute float aHub;
    attribute float aIcon;
    attribute vec3 aLocal;

    uniform float uW[${FORMS}];
    uniform float uTime;
    uniform float uTurb;
    uniform float uFocus;
    uniform float uFocusAmt;
    uniform float uAlpha;
    uniform float uAlphaScale;
    uniform float uSize;
    uniform float uSizeMul;
    uniform vec3 uBase;
    uniform sampler2D uModTex;
    uniform vec2 uModTexel;
    uniform float uModRows;
    uniform float uModA;
    uniform float uModB;
    uniform float uModMix;
    uniform vec3 uBrand;
    uniform vec3 uOdooA;
    uniform vec3 uOdooB;
    uniform vec3 uWarm;
    uniform vec3 uIcon[${ICON_COUNT}];
    uniform vec3 uScatterC[${ICON_COUNT}];
    uniform vec3 uScatterAxis[${ICON_COUNT}];
    uniform float uSpin;
    uniform float uSpread;
    uniform float uShift;
    uniform float uMirror;
    uniform vec3 uCluster[${CLUSTERS}];

    varying vec3 vCol;
    varying float vAlpha;

    /**
     * This point's record in module m: xyz is its position, w is a palette
     * slot. Rows-per-module keeps the arithmetic small and exact.
     */
    vec4 fetchModule(float m) {
      float col = mod(aIndex, ${MOD_TEX_W}.0);
      float row = m * uModRows + floor(aIndex / ${MOD_TEX_W}.0);
      return texture2D(uModTex, (vec2(col, row) + 0.5) * uModTexel);
    }

    /**
     * Slot 1 is the module's *own* hue rather than a fixed colour, which is
     * what lets ten scenes share one palette and none of them know which
     * module it is drawing.
     */
    vec3 slotColor(float slot, float m) {
      vec3 accent = uCluster[int(m)];
      if (slot < 0.5) return uBase;
      if (slot < 1.5) return accent;
      if (slot < 2.5) return mix(uBase, accent, 0.45);
      if (slot < 3.5) return uOdooA;
      if (slot < 4.5) return uOdooB;
      return uWarm;
    }

    /** Rodrigues. Cheaper than building a matrix for one rotation per vertex. */
    vec3 spin(vec3 v, vec3 axis, float a) {
      float c = cos(a);
      float s = sin(a);
      return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
    }

    void main() {
      int ic = int(aIcon);

      vec3 p =
          ${POS_BLEND};

      // The scatter, built here rather than read from a buffer. Each glyph
      // keeps its shape, rides out to its own corner and rolls about its own
      // axis, at a rate that differs per glyph so the six never move as one.
      vec3 centre = uScatterC[ic] * uSpread;
      // Placement mirrors under Arabic; the glyph itself never does, or the
      // calculator and the trend arrow would read backwards.
      centre.x = centre.x * uMirror + uShift;
      vec3 scattered =
          centre
        + spin(aLocal * ${SCATTER_SIZE.toFixed(2)}, uScatterAxis[ic], uSpin * (0.62 + 0.16 * aIcon));
      p += scattered * uW[${SCATTER}];

      // The two module scenes currently on screen, cross-faded.
      vec4 ma = fetchModule(uModA);
      vec4 mb = fetchModule(uModB);
      p += mix(ma.xyz, mb.xyz, uModMix) * uW[${MODULE}];

      // A held formation should breathe, or a beat you dwell on turns into a
      // photograph. Amplitude is a uniform so reduced motion can zero it.
      float ph = aSeed * 6.2831853;
      p += vec3(
        sin(uTime * 0.5 + ph),
        cos(uTime * 0.43 + ph * 1.7),
        sin(uTime * 0.37 + ph * 2.3)
      ) * uTurb;

      float mine = step(abs(aCluster - uFocus), 0.5);
      float lit = mine * uFocusAmt;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;

      // Module hues only while the ring and the weave own the frame; before
      // and after that the field is one material, which is the point.
      // Interpolated, not typed: these were literal indices, and renumbering
      // the formations silently pointed the module hues at the wrong three —
      // the ring went grey while its labels stayed coloured, which is the
      // kind of bug that looks like a palette decision.
      //
      // The hub lockup opts out: it sits inside the ring but is a logotype,
      // not an eleventh cluster, so it must not take a cluster hue.
      float hub = step(0.5, aHub);
      float hueAmt = clamp(
        uW[${RING}] + uW[${WEAVE}] * 0.85 + uW[${LATTICE}] * 0.3,
        0.0,
        1.0
      ) * (1.0 - hub);
      vec3 col = mix(uBase, uCluster[int(aCluster)], hueAmt);

      // Only while the ring holds the frame. Everywhere else these are
      // ordinary points and take whatever their formation is wearing.
      vec3 hubCol =
          aHub < 1.5 ? uBase
        : aHub < 2.5 ? uBrand
        : aHub < 3.5 ? uOdooA
        : uOdooB;
      col = mix(col, hubCol, hub * uW[${RING}]);

      // The figure is two materials, not one: the person in the field's own
      // ink and the ledger and chart in the module's hue. Tinting the whole
      // body violet made it read as a mascot rather than as the same twelve
      // thousand records arranged into a person.
      col = mix(
        col,
        mix(slotColor(ma.w, uModA), slotColor(mb.w, uModB), uModMix),
        uW[${MODULE}]
      );

      // Each glyph in its own hue, and it holds all the way from the opening
      // ring through the scatter and most of the way down the funnel. Losing
      // it at the ring was what made the scatter read as anonymous dust; the
      // colours draining only as the field reaches the core is the "many
      // become one" the flow beat is actually about.
      float iconAmt = clamp(
        uW[${ICONS}] + uW[${SCATTER}] + uW[${FUNNEL}] * 0.6,
        0.0,
        1.0
      );
      col = mix(col, uIcon[ic], iconAmt);
      // Deepened, not lifted. Emphasis is a move *away from the ground*, and
      // the ground here is paper — pushing the focused cluster toward white
      // would fade it out at exactly the moment it is being talked about.
      //
      // Only a little, either way: boosting colour, alpha and size at once
      // blows the cluster into a solid disc, losing both its hue, which is the
      // one thing identifying it, and the grain that makes it read as a cloud
      // of records rather than a blob.
      vCol = mix(col, vec3(0.0), lit * 0.22);

      float dim = mix(1.0, 0.28, uFocusAmt * (1.0 - mine));
      // Clamped: normal blending needs more coverage per point than additive,
      // but coverage above 1 is not a thing.
      vAlpha = min(dim * uAlpha * uAlphaScale * (1.0 + lit * 0.5), 1.0);

      gl_PointSize = uSize * uSizeMul * (1.0 + lit * 0.5) * (42.0 / max(-mv.z, 0.001));
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vCol;
    varying float vAlpha;

    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float r2 = dot(d, d);
      if (r2 > 0.25) discard;
      float a = smoothstep(0.25, 0.02, r2) * vAlpha;
      if (a < 0.004) discard;
      gl_FragColor = vec4(vCol, a);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});

/* ---------------------------------------------------------------- timing */

type Anchor = {
  at: number;
  form: number;
  id: string;
  /** Index into MODULES, or −1 for a beat that is not a module. */
  mod: number;
};

/**
 * Which two module scenes the shader should blend, and how far between them.
 *
 * The formation weights alone cannot say this: all ten module beats share one
 * formation, so `uW[MODULE]` is their *total* and says nothing about which of
 * the ten. Written in place, like the anchor table, for the same reason.
 */
const MOD_BLEND = { a: 0, b: 0, t: 0 };

/**
 * One anchor per beat, at the centre of its measured range.
 *
 * Rebuilt every frame rather than cached because `scroll.ranges` is remeasured
 * on resize and on font settle, and a stale table would drift the field away
 * from the copy it is illustrating. Eighteen beats — the cost is nothing.
 */
function anchors(out: Anchor[]) {
  // Written in place. Rebuilding the list allocated eighteen objects a frame,
  // which is a thousand a second of pure garbage for a table that only ever
  // changes on resize.
  //
  // Each anchor carries its own beat id, so this no longer reaches back into
  // a module-level beat table — that table is a function of locale now, and
  // the one thing this loop must not do is read a *different* language's
  // beats from the one the page is measuring.
  for (let i = 0; i < out.length; i++) {
    const [from, to] = rangeOf(out[i].id);
    out[i].at = (from + to) / 2;
  }
  return out;
}

function weightsAt(p: number, list: Anchor[], out: Float32Array) {
  out.fill(0);
  if (!list.length) {
    out[ICONS] = 1;
    return;
  }
  if (p <= list[0].at) {
    out[list[0].form] = 1;
    return;
  }
  const last = list[list.length - 1];
  if (p >= last.at) {
    out[last.form] = 1;
    return;
  }
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (p < a.at || p > b.at) continue;
    const t = smooth(clamp((p - a.at) / Math.max(b.at - a.at, 1e-6)));
    // Only cross-fade when both ends are modules. Entering the tour from the
    // ring, or leaving it for the wiring beat, would otherwise blend the live
    // scene against whatever module happens to sit at index 0.
    if (a.mod >= 0 && b.mod >= 0) {
      MOD_BLEND.a = a.mod;
      MOD_BLEND.b = b.mod;
      MOD_BLEND.t = t;
    } else if (a.mod >= 0) {
      MOD_BLEND.a = MOD_BLEND.b = a.mod;
      MOD_BLEND.t = 0;
    } else if (b.mod >= 0) {
      MOD_BLEND.a = MOD_BLEND.b = b.mod;
      MOD_BLEND.t = 0;
    }
    // `+=` rather than `=`: consecutive beats often share a formation (all ten
    // module beats do), and the two halves have to add back up to one.
    out[a.form] += 1 - t;
    out[b.form] += t;
    return;
  }
  out[last.form] = 1;
}

/* --------------------------------------------------------------- labels */

/**
 * The ten module names, on the ring.
 *
 * Without them the tour is ten anonymous coloured clouds: the copy column
 * names one module at a time, so nothing on screen ever says *this is an ERP
 * and here is everything in it*. All ten stay legible at once and the active
 * one lifts, which is the one thing the DOM cannot show.
 *
 * Children of the spin group, so a label travels with its own cluster as the
 * ring turns. Billboarded, or they would rotate with it and render mirrored —
 * the same trap the about-page city labels hit.
 */
/**
 * troika's own opacity properties, not the material's.
 *
 * The material is derived and its uniforms are rewritten from `fillOpacity` in
 * `onBeforeRender` — so `material.opacity = x` is overwritten before it ever
 * reaches the screen, and all ten labels hung there at full strength through
 * the opening beat. The outline is a second material for the same reason and
 * needs telling separately.
 */
type TroikaText = THREE.Mesh & {
  fillOpacity: number;
  outlineOpacity: number;
};

function RingLabels({ locale }: { locale: Locale }) {
  const refs = useRef<(TroikaText | null)[]>([]);
  // Kept here rather than read back off the text, so the damp starts from
  // hidden instead of from troika's default of fully opaque.
  const opacity = useRef(new Float32Array(CLUSTERS));

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const ring = UNIFORMS.uW.value[RING];
    const focus = UNIFORMS.uFocus.value;
    const amt = UNIFORMS.uFocusAmt.value;

    for (let i = 0; i < refs.current.length; i++) {
      const t = refs.current[i];
      if (!t) continue;
      // The nine that are not being talked about are context, not competition
      // — they say "and these too", quietly, under the copy column.
      // The ring is now the overview beat rather than the backdrop to a tour,
      // so its whole job is showing all ten at once. They no longer need to
      // recede for a focused one that is not there.
      const active = i === focus ? amt : 0;
      const o = damp(opacity.current[i], ring * (0.62 + active * 0.38), 4, dt);
      opacity.current[i] = o;
      t.fillOpacity = o;
      t.outlineOpacity = o;
      t.visible = o > 0.01;
    }
  });

  return (
    <>
      {MODULES.map((m, i) => (
        <Billboard
          key={m.id}
          position={[NODES[i].x * 1.235, NODES[i].y * 1.235, NODES[i].z]}
        >
          <Text
            ref={(el) => {
              refs.current[i] = el as unknown as TroikaText;
            }}
            visible={false}
            fillOpacity={0}
            outlineOpacity={0}
            fontSize={0.17}
            // Wrapped rather than shrunk: at full width "Inventory &
            // Procurement" is wider than the 3.4 units between neighbours.
            maxWidth={2.5}
            textAlign="center"
            lineHeight={1.25}
            color={MODULE_HUES[m.id]}
            anchorX="center"
            anchorY="middle"
            // troika's own face has no Arabic; without this the ten labels
            // come out as empty boxes on /ar.
            font={arabicFontUrl(locale)}
            letterSpacing={displayTracking(locale)}
            outlineWidth={0.012}
            // A halo of the ground, so the label knocks out of whatever
            // cluster it happens to be standing in front of.
            outlineColor={SCENE.outline}
          >
            {displayCase(moduleCopy(locale, m.id).label, locale)}
          </Text>
        </Billboard>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ rig */

function Field({ reduced, locale }: SceneEnv) {
  // Built here, not at module scope: sampling the logotype needs a canvas.
  const field = useMemo(() => buildField(), []);
  // The field and the labels share one transform, so a label cannot drift off
  // the cluster it names.
  const points = useRef<THREE.Group>(null);
  // Formations never change; only the measured centres do. Beat *ids* are the
  // same in every language, so this list is locale-independent.
  const list = useRef<Anchor[]>(
    buildBeats(locale).map((b) => ({
      at: 0,
      form: formationOf(b.id),
      id: b.id,
      mod: MODULES.findIndex((m) => b.id === `mod-${m.id}`),
    })),
  );
  const look = useRef(new THREE.Vector3());
  const modOffset = useMemo(() => moduleBeatOffset(), []);

  useLayoutEffect(() => {
    UNIFORMS.uModTex.value = field.moduleTex;
    UNIFORMS.uModTexel.value.set(
      1 / field.moduleTex.image.width,
      1 / field.moduleTex.image.height,
    );
    return () => {
      field.moduleTex.dispose();
    };
  }, [field]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const w = UNIFORMS.uW.value;

    if (scroll.measured) {
      weightsAt(p, anchors(list.current), w);
    } else {
      // The opening formation, so the very first paint — before <StoryOverlay>
      // has measured anything — is already the thing the hero is meant to show.
      w.fill(0);
      w[ICONS] = 1;
    }

    // Which module owns the frame. Only the ring and weave show hues, so this
    // is wasted work outside them — but it is ten cheap range tests.
    let focus = -1;
    let amt = 0;
    for (let i = 0; i < MODULES.length; i++) {
      const o = owns(p, `mod-${MODULES[i].id}`, 0.3);
      if (o > amt) {
        amt = o;
        focus = i;
      }
    }
    /**
     * The scatter's two live values, normalised across the pair of beats that
     * use it so the tumble runs at the same rate whatever height those
     * sections end up being.
     *
     * A plain function of scroll, deliberately — not damped. Damping would
     * make it a state machine and break the one property the whole scene is
     * built on: scrubbing backwards is the same evaluation at a smaller
     * number, not a reversal that has to be computed.
     */
    const [scatterFrom, scatterMid] = rangeOf("problems");
    const [scatterMid2, scatterTo] = rangeOf("problems-2");
    const span = Math.max(scatterTo - scatterFrom, 1e-4);

    // Tumble and drift run across both beats, continuously.
    const spun = range(p, scatterFrom - 0.03, scatterTo + 0.02);
    UNIFORMS.uSpin.value = spun * 2.4;
    UNIFORMS.uSpread.value = 0.84 + spun * (SCATTER_SPREAD_END - 0.84);

    /**
     * The crossing, though, happens *between* the two beats rather than over
     * the pair of them.
     *
     * Spread across both, the cloud is already a third of the way over while
     * the first list is still being read — which put a glyph on the headline,
     * the exact thing the sweep exists to avoid. It holds clear on one side,
     * crosses while both columns are mid-fade, and holds clear on the other.
     *
     * The window is a fraction of the beats' own measured span, not a literal
     * scroll delta, so it survives those sections changing height.
     */
    const sweep = smooth(
      range(p, scatterMid - span * 0.14, scatterMid2 + span * 0.2),
    );
    UNIFORMS.uMirror.value = sideSign();
    UNIFORMS.uShift.value = sweep * SCATTER_SWEEP * sideSign();

    UNIFORMS.uFocus.value = focus;
    // The focus highlight lights one cluster in ten by `aCluster`, which is
    // meaningful on the ring and meaningless inside a module scene — there it
    // would brighten a random tenth of a drawing.
    UNIFORMS.uFocusAmt.value = damp(
      UNIFORMS.uFocusAmt.value,
      amt * (1 - w[MODULE]),
      4,
      dt,
    );

    UNIFORMS.uModA.value = MOD_BLEND.a;
    UNIFORMS.uModB.value = MOD_BLEND.b;
    UNIFORMS.uModMix.value = MOD_BLEND.t;
    if (!reduced) UNIFORMS.uTime.value = state.clock.elapsedTime;

    const g = points.current;
    if (g) {
      const face = w[MARK];
      const ring = w[RING];
      const scene = w[MODULE];
      const icons = w[ICONS];

      /**
       * During the tour the ring turns to bring the active cluster to twelve
       * o'clock, so every module gets the same, composed presentation instead
       * of glowing wherever the free spin happened to leave it.
       *
       * Cluster i sits at `i/10 · 2π − π/2`, so the target is a constant −36°
       * step per module: the ring rolls steadily through most of a full turn
       * across the ten beats rather than snapping between them.
       *
       * Twelve o'clock and not the side away from the copy, which was the
       * first instinct: <StoryOverlay> alternates the column every beat, so
       * "opposite the copy" would have flipped the ring 180° ten times.
       */
      const spoke =
        focus >= 0
          ? Math.PI / 2 - ((focus / CLUSTERS) * Math.PI * 2 - Math.PI / 2)
          : 0;
      g.rotation.z = damp(g.rotation.z, spoke * ring, 2, dt);

      // Free spin everywhere else — but not under the ring, where it would
      // tilt the clusters out of plane, not at the finale, where the logotype
      // has to be square to camera to be readable at all, and not on a module
      // scene or the icons, for the same reason as the logotype: a person
      // turned far enough stops reading as one, and a flat glyph turned far
      // enough goes edge-on and disappears. Depiction has a correct viewing
      // angle; abstraction does not.
      // Held to about a half-turn across the whole page. At 1.9 radians the
      // weave arrived nearly edge-on and its radial structure — the one thing
      // that beat is about — collapsed into a vertical band.
      const free = (1 - face) * (1 - ring) * (1 - scene) * (1 - icons);
      g.rotation.y = damp(g.rotation.y, free * (0.2 + p * 0.85), 1.6, dt);
      g.rotation.x = damp(g.rotation.x, free * 0.12, 1.6, dt);
    }

    // Camera distance and height are the same weighted sum as the positions,
    // so the move and the morph are guaranteed to be in step.
    let dist = 0;
    let high = 0;
    let alpha = 0;
    let size = 0;
    let turb = 0;
    for (let f = 0; f < FORMS; f++) {
      dist += w[f] * DISTANCE[f];
      high += w[f] * HEIGHT[f];
      alpha += w[f] * ALPHA[f];
      size += w[f] * SIZE[f];
      turb += w[f] * TURB[f];
    }
    UNIFORMS.uAlpha.value = alpha;
    UNIFORMS.uSizeMul.value = size;
    // Damped toward the *scaled* target, not scaled after damping — the latter
    // feeds the damp its own output and the breath winds itself down to zero
    // over a few frames.
    UNIFORMS.uTurb.value = damp(
      UNIFORMS.uTurb.value,
      reduced ? 0 : 0.12 * turb,
      2,
      dt,
    );

    /**
     * Park the field opposite its copy column during the module tour.
     * <StoryOverlay> alternates by beat index, and module i is beat
     * `moduleBeatOffset() + i`, so even indices put their copy left.
     */
    let side = 0;
    if (focus >= 0 && modOffset >= 0) {
      side = (modOffset + focus) % 2 === 0 ? 1 : -1;
    }
    // `flex-start` is the right-hand side under Arabic, so the whole
    // alternation is mirrored and the field would park *on* the copy it is
    // meant to stand opposite.
    const shift = side * sideSign() * amt * 2.6;

    const { camera } = state;
    camera.position.x = damp(camera.position.x, shift * 0.35, 2.2, dt);
    camera.position.y = damp(camera.position.y, high, 2.2, dt);
    camera.position.z = damp(camera.position.z, dist, 2.2, dt);

    look.current.set(-shift * 0.65, 0, 0);
    camera.lookAt(look.current);
  });

  return (
    <group ref={points}>
      <points geometry={field.geometry} material={MATERIAL} frustumCulled={false} />
      <RingLabels locale={locale} />
    </group>
  );
}

export function HomeScene(env: SceneEnv) {
  return (
    <>
      <Starfield reduced={env.reduced} />
      <Field {...env} />
    </>
  );
}
