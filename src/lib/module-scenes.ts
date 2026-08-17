import * as THREE from "three";

import type { MarkSample } from "@/lib/raster";

/**
 * One scene per ERP module — ten of them, drawn as points.
 *
 * The finance beat proved the idea: a beat that *depicts* its module lands far
 * harder than the same ten coloured clouds ten times over. These are the other
 * nine, built to the same rules the accountant taught us.
 *
 * **Not everything gets a person.** A figure is the right image for the
 * modules that are about people doing something — finance, sales, HR, support
 * — and the wrong one for the modules that are about *things*. A person
 * standing next to a warehouse says less about inventory than the warehouse
 * does, and ten figures in a row would flatten the tour into one repeated
 * silhouette. Six of the ten are objects.
 *
 * ## Colour
 *
 * Scenes return a palette *slot*, not a colour. The accent resolves to the
 * module's own hue in the shader, so each scene is automatically in the colour
 * the ring and the copy already use for that module — and none of these
 * functions has to know which module it is.
 */

export const SLOT = {
  /** The field's own ink. Bodies, structure, anything unemphasised. */
  ink: 0,
  /** This module's hue. The thing the beat is about. */
  accent: 1,
  /** Half-way back toward the ink — surfaces the accent sits on. */
  soft: 2,
  /** Odoo magenta, for the leading "o" of the wordmark. */
  odooA: 3,
  /** Odoo's neutral letters. */
  odooB: 4,
  /** A warm secondary, for the one or two things that need to differ. */
  warm: 5,
} as const;

/* ---------------------------------------------------------------- samplers */

/**
 * A point inside a capsule — a swept sphere from `a` to `b`.
 *
 * `pow(rand, 0.42)` biases outward: uniform volume sampling puts too many
 * points down the centre line and a limb comes out as a fog with a hot core.
 */
function capsule(
  rand: () => number,
  out: THREE.Vector3,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  r: number,
) {
  const t = rand();
  const u = rand() * 2 - 1;
  const th = rand() * Math.PI * 2;
  const s = Math.sqrt(Math.max(0, 1 - u * u));
  const rr = r * Math.pow(rand(), 0.42);
  out.set(
    ax + (bx - ax) * t + Math.cos(th) * s * rr,
    ay + (by - ay) * t + u * rr,
    az + (bz - az) * t + Math.sin(th) * s * rr,
  );
}

function box(
  rand: () => number,
  out: THREE.Vector3,
  cx: number, cy: number, cz: number,
  sx: number, sy: number, sz: number,
) {
  out.set(
    cx + (rand() - 0.5) * sx,
    cy + (rand() - 0.5) * sy,
    cz + (rand() - 0.5) * sz,
  );
}

/** The four edges of an upright rectangle, walked by length. */
function rimXY(
  rand: () => number,
  out: THREE.Vector3,
  cx: number, cy: number, cz: number,
  w: number, h: number, t: number,
) {
  const side = Math.max(h - t * 2, 0.001);
  let r = rand() * (w * 2 + side * 2);
  if (r < w) box(rand, out, cx - w / 2 + r, cy + h / 2 - t / 2, cz, 0.001, t, t);
  else if ((r -= w) < w)
    box(rand, out, cx - w / 2 + r, cy - h / 2 + t / 2, cz, 0.001, t, t);
  else if ((r -= w) < side)
    box(rand, out, cx - w / 2 + t / 2, cy - h / 2 + t + r, cz, t, 0.001, t);
  else
    box(rand, out, cx + w / 2 - t / 2, cy - h / 2 + t + (r - side), cz, t, 0.001, t);
}

/** An annular sector in the XY plane. `sqrt` on the radius, or it clumps. */
function ringXY(
  rand: () => number,
  out: THREE.Vector3,
  cx: number, cy: number, cz: number,
  r0: number, r1: number,
  a0 = 0, a1 = Math.PI * 2,
  depth = 0.06,
) {
  const a = a0 + rand() * (a1 - a0);
  const r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));
  out.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz + (rand() - 0.5) * depth);
}

/**
 * Cumulative pick over relative weights.
 *
 * Normalised rather than trusted to add up: a hand-written table summing to
 * 0.96 does not fail loudly, it silently dumps the remainder into whichever
 * part is last. That bug cost a chart a fifth more points than it asked for.
 */
function pick(u: number, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i] / total;
    if (u <= acc) return i;
  }
  return weights.length - 1;
}

/** Remaps `u` from a sub-range back to 0..1, for nesting pickers. */
const sub = (u: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (u - from) / Math.max(to - from, 1e-6)));

/* ------------------------------------------------------------------- body */

/**
 * A person, about 6.2 units tall, feet at −3.
 *
 * Stylised at roughly seven heads rather than a realistic seven and a half:
 * the head is what says "person" fastest and at this point count it needs the
 * extra size to survive. Arms are posed to `hold` when given — every prop in
 * these scenes is placed first and the arms follow it, never the reverse.
 */
export type Hold = { x: number; y: number; z: number };

export function human(
  rand: () => number,
  out: THREE.Vector3,
  u: number,
  hold?: Hold,
) {
  const sx = rand() < 0.5 ? 1 : -1;
  const part = pick(u, [0.08, 0.02, 0.21, 0.17, 0.25, 0.04]);

  switch (part) {
    case 0: {
      // Head: taller than wide and pushed a touch forward. A perfect sphere on
      // a neck reads as a ball.
      const v = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(Math.max(0, 1 - v * v));
      const rr = 0.4 * Math.pow(rand(), 0.4);
      out.set(
        Math.cos(th) * s * rr,
        2.72 + v * rr * 1.12,
        0.03 + Math.sin(th) * s * rr * 0.92,
      );
      return;
    }
    case 1:
      // Long enough to leave air between a 0.8-wide head and 1.44-wide
      // shoulders; too short and the two masses merge into one blob.
      capsule(rand, out, 0, 1.9, 0, 0, 2.36, 0.02, 0.14);
      return;
    case 2: {
      // Tapered and elliptical in section. A cylinder reads as a barrel, and
      // the shoulders are what tell you which way the figure faces.
      const t = rand();
      const hw = 0.5 + t * 0.22;
      const hd = 0.26 + t * 0.06;
      const th = rand() * Math.PI * 2;
      const rr = Math.pow(rand(), 0.45);
      out.set(Math.cos(th) * hw * rr, 0.05 + t * 1.9, Math.sin(th) * hd * rr);
      return;
    }
    case 3: {
      const seg = rand();
      if (!hold) {
        // Hanging. Held just clear of the ribs — flush against the torso the
        // arms merge into the silhouette and the figure looks armless.
        if (seg < 0.55)
          capsule(rand, out, 0.84 * sx, 1.84, 0, 0.92 * sx, 0.86, 0.06, 0.145);
        else capsule(rand, out, 0.92 * sx, 0.86, 0.06, 0.9 * sx, 0.0, 0.12, 0.125);
        return;
      }
      if (seg < 0.45)
        capsule(rand, out, 0.82 * sx, 1.84, 0, 0.88 * sx, 0.98, 0.1, 0.145);
      else if (seg < 0.86)
        capsule(rand, out, 0.88 * sx, 0.98, 0.1, hold.x * sx, hold.y, hold.z, 0.125);
      else
        capsule(rand, out, hold.x * sx, hold.y, hold.z, hold.x * 0.9 * sx, hold.y - 0.02, hold.z + 0.08, 0.13);
      return;
    }
    case 4:
      if (rand() < 0.55)
        capsule(rand, out, 0.32 * sx, 0.05, 0, 0.35 * sx, -1.45, 0.03, 0.2);
      else capsule(rand, out, 0.35 * sx, -1.45, 0.03, 0.32 * sx, -2.8, -0.03, 0.15);
      return;
    default:
      // Forward of the ankle, which is what stops the legs ending in stumps.
      box(rand, out, 0.32 * sx, -2.9, 0.16, 0.34, 0.18, 0.66);
      return;
  }
}

/** Scales and moves whatever was just written. */
function place(out: THREE.Vector3, s: number, dx: number, dy: number, dz = 0) {
  out.multiplyScalar(s);
  out.x += dx;
  out.y += dy;
  out.z += dz;
}

/* ------------------------------------------------------------ the screen */

/**
 * The Odoo-branded screen the accountant holds, reused by every scene that
 * needs one.
 *
 * Drawn flat and rotated about X so the top edge leans away — the angle a
 * screen sits at when it is being read, and the only angle at which a level
 * camera sees its face rather than its edge. Kept shallow: at 26° the page was
 * foreshortened enough to cost the wordmark a fifth of its height.
 */
const SCREEN = { w: 1.72, h: 1.15, t: 0.07, tilt: -0.3 };
const ODOO = { halfW: 0.66, y: 0.1 };
const RIM = 0.07;

function onScreen(
  out: THREE.Vector3,
  cx: number, cy: number, cz: number,
  x: number, y: number, z: number,
) {
  const c = Math.cos(SCREEN.tilt);
  const s = Math.sin(SCREEN.tilt);
  out.set(cx + x, cy + y * c - z * s, cz + y * s + z * c);
}

/**
 * A screen showing the Odoo wordmark, plus whatever the caller draws under it.
 *
 * Returns the palette slot. `extra` gets local page coordinates and draws the
 * module-specific content in the lower two thirds.
 */
export type ScreenOpts = {
  /** 1 is the size a figure can hold. A panel standing on its own wants more. */
  scale?: number;
  /** Where the mark sits in page coordinates, and how wide it is. */
  markY?: number;
  markHalfW?: number;
  extra?: (rand: () => number, out: THREE.Vector3, put: PutOnScreen) => number;
};

export function odooScreen(
  rand: () => number,
  out: THREE.Vector3,
  u: number,
  odoo: MarkSample,
  at: { x: number; y: number; z: number },
  opts: ScreenOpts = {},
): number {
  const k = opts.scale ?? 1;
  const markY = opts.markY ?? ODOO.y;
  const markHalfW = opts.markHalfW ?? ODOO.halfW;
  const extra = opts.extra;
  const put: PutOnScreen = (x, y, z) =>
    onScreen(out, at.x, at.y, at.z, x * k, y * k, z * k);
  const part = pick(u, extra ? [0.22, 0.52, 0.26] : [0.28, 0.72]);

  if (part === 0) {
    // The page, as a rim. Filled, it and its contents were one lozenge —
    // 2,500 points over 138×86 screen pixels is solid whatever the density.
    const hw = SCREEN.w / 2;
    const hh = SCREEN.h / 2;
    const side = SCREEN.h - RIM * 2;
    let r = rand() * (SCREEN.w * 2 + side * 2);
    let x: number;
    let y: number;
    if (r < SCREEN.w) { x = -hw + r; y = hh - RIM * rand(); }
    else if ((r -= SCREEN.w) < SCREEN.w) { x = -hw + r; y = -hh + RIM * rand(); }
    else if ((r -= SCREEN.w) < side) { x = -hw + RIM * rand(); y = -hh + RIM + r; }
    else { r -= side; x = hw - RIM * rand(); y = -hh + RIM + r; }
    put(x, y, (rand() - 0.5) * SCREEN.t);
    return SLOT.soft;
  }

  if (part === 1) {
    // Sampled by area, not by a fixed split: the accent is one letter of four,
    // so a coin-weighted pick would give it three times the density of its
    // neighbours and the "o" would burn out.
    const total = odoo.accent.length + odoo.plain.length;
    const useAccent = total > 0 && rand() * total < odoo.accent.length;
    const src = useAccent ? odoo.accent : odoo.plain;
    if (!src.length) {
      put(0, ODOO.y, 0.055);
      return SLOT.odooB;
    }
    const [mx, my] = src[Math.floor(rand() * src.length)];
    // Both axes came back normalised against their own dimension, so the
    // height carries the aspect or a mark three times wider than it is tall
    // comes out square.
    put(
      mx * markHalfW * 2,
      markY + my * markHalfW * 2 * odoo.aspect,
      0.055 + (rand() - 0.5) * 0.02,
    );
    return useAccent ? SLOT.odooA : SLOT.odooB;
  }

  return extra ? extra(rand, out, put) : SLOT.soft;
}

export type PutOnScreen = (x: number, y: number, z: number) => void;

/** Five bars along the bottom of a screen — the default "this is a report". */
function screenBars(rand: () => number, put: PutOnScreen): number {
  const heights = [0.08, 0.13, 0.1, 0.17, 0.22];
  if (rand() < 0.12) {
    put((rand() - 0.5) * (SCREEN.w - RIM * 4), -0.53, 0.06);
    return SLOT.accent;
  }
  const b = Math.min(4, Math.floor(rand() * 5));
  put(
    -0.5 + b * 0.25 + (rand() - 0.5) * 0.15,
    -0.5 + heights[b] * rand(),
    0.06 + (rand() - 0.5) * 0.04,
  );
  return SLOT.accent;
}

/* ----------------------------------------------------------------- scenes */

export type Scene = (
  rand: () => number,
  out: THREE.Vector3,
  u: number,
  odoo: MarkSample,
) => number;

const HOLD: Hold = { x: 0.76, y: 0.5, z: 0.86 };
const SCREEN_AT = { x: 0, y: 0.66, z: 1.02 };

/** Finance & Accounting — an accountant reading an Odoo report. */
const finance: Scene = (rand, out, u, odoo) => {
  if (u < 0.62) {
    human(rand, out, sub(u, 0, 0.62), HOLD);
    return SLOT.ink;
  }
  return odooScreen(rand, out, sub(u, 0.62, 1), odoo, SCREEN_AT, {
    extra: (r, _o, put) => screenBars(r, put),
  });
};

/**
 * CRM & Sales — a salesperson beside a pipeline.
 *
 * The funnel is the one diagram everyone in sales already reads without being
 * told, which is why it beats a second figure or a handshake here.
 */
const crm: Scene = (rand, out, u) => {
  if (u < 0.5) {
    human(rand, out, sub(u, 0, 0.5));
    place(out, 0.9, -2.1, -0.1);
    return SLOT.ink;
  }
  const v = sub(u, 0.5, 1);
  const part = pick(v, [0.46, 0.16, 0.18, 0.2]);
  const CX = 1.7;
  // A trapezoid, not three stacked bands. Bands read as three boxes — the
  // slanted sides are the entire reason a funnel is legible as a funnel.
  const TOP_Y = 1.75;
  const BOT_Y = -1.0;
  const TOP_W = 1.4;
  const BOT_W = 0.44;
  /** Half-width at a given height, walking the slant. */
  const widthAt = (y: number) =>
    TOP_W + ((y - TOP_Y) / (BOT_Y - TOP_Y)) * (BOT_W - TOP_W);

  if (part === 0) {
    const edge = rand();
    if (edge < 0.3) capsule(rand, out, CX - TOP_W, TOP_Y, 0, CX + TOP_W, TOP_Y, 0, 0.075);
    else if (edge < 0.65)
      capsule(rand, out, CX - TOP_W, TOP_Y, 0, CX - BOT_W, BOT_Y, 0, 0.075);
    else if (edge < 1.0)
      capsule(rand, out, CX + TOP_W, TOP_Y, 0, CX + BOT_W, BOT_Y, 0, 0.075);
    return SLOT.accent;
  }
  if (part === 1) {
    // Two stage dividers, each cut to the slant it meets.
    const y = rand() < 0.5 ? 0.85 : -0.1;
    const w = widthAt(y);
    capsule(rand, out, CX - w, y, 0.03, CX + w, y, 0.03, 0.055);
    return SLOT.soft;
  }
  if (part === 2) {
    // The spout. Without it the shape is a bucket.
    const sx = rand() < 0.5 ? -1 : 1;
    capsule(rand, out, CX + BOT_W * sx, BOT_Y, 0, CX + 0.3 * sx, BOT_Y - 0.55, 0, 0.07);
    return SLOT.accent;
  }
  // What comes out of the bottom: the won deal.
  box(rand, out, CX, -2.05, 0, 0.78, 0.54, 0.18);
  return SLOT.warm;
};

/**
 * Inventory & Procurement — racking, stock and a barcode.
 *
 * No person: a figure standing next to a warehouse tells you less about
 * inventory than the warehouse does.
 */
const inventory: Scene = (rand, out, u) => {
  const part = pick(u, [0.34, 0.34, 0.18, 0.14]);
  if (part === 0) {
    // Racking — two uprights and three shelves.
    if (rand() < 0.45) {
      const sx = rand() < 0.5 ? -1 : 1;
      capsule(rand, out, 2.6 * sx, -2.6, 0, 2.6 * sx, 2.5, 0, 0.09);
    } else {
      const lvl = Math.floor(rand() * 3);
      capsule(rand, out, -2.6, -2.5 + lvl * 1.7, 0, 2.6, -2.5 + lvl * 1.7, 0, 0.08);
    }
    return SLOT.ink;
  }
  if (part === 1) {
    // Cartons on the shelves, as outlines so the stack stays countable.
    const lvl = Math.floor(rand() * 3);
    const col = Math.floor(rand() * 3);
    rimXY(rand, out, -1.55 + col * 1.55, -1.85 + lvl * 1.7, 0.1, 1.16, 0.92, 0.1);
    return SLOT.accent;
  }
  if (part === 2) {
    // Tape across each carton — the detail that makes an outline a box.
    const lvl = Math.floor(rand() * 3);
    const col = Math.floor(rand() * 3);
    capsule(
      rand, out,
      -1.55 + col * 1.55, -1.85 + lvl * 1.7 + 0.46, 0.12,
      -1.55 + col * 1.55, -1.85 + lvl * 1.7 - 0.46, 0.12,
      0.05,
    );
    return SLOT.soft;
  }
  // Barcode across the base.
  const bar = Math.floor(rand() * 11);
  box(rand, out, -1.9 + bar * 0.38, -3.15, 0.1, 0.06 + (bar % 3) * 0.05, 0.5, 0.05);
  return SLOT.ink;
};

/**
 * Human Resources — three people and the lines between them.
 *
 * The one module where more than one figure is the point. The middle one
 * stands forward and takes the accent; the other two are context.
 */
const hr: Scene = (rand, out, u) => {
  const part = pick(u, [0.3, 0.4, 0.3]);
  if (part === 1) {
    human(rand, out, rand(), undefined);
    place(out, 0.62, 0, 0.35, 0.5);
    return SLOT.accent;
  }
  if (part === 0 || part === 2) {
    const sx = part === 0 ? -1 : 1;
    human(rand, out, rand(), undefined);
    place(out, 0.52, 2.35 * sx, -0.15, -0.4);
    return SLOT.ink;
  }
  return SLOT.ink;
};

/** Attendance & Payroll — a clock and a payslip. */
const payroll: Scene = (rand, out, u) => {
  const CX = -1.55;
  const CY = 0.7;
  const part = pick(u, [0.22, 0.14, 0.06, 0.08, 0.03, 0.28, 0.19]);

  if (part === 0) {
    ringXY(rand, out, CX, CY, 0, 1.12, 1.3);
    return SLOT.accent;
  }
  if (part === 1) {
    // Twelve ticks. A bare ring with two lines on it is a pie chart with a
    // slice missing; the ticks are what make it a dial.
    const k = Math.floor(rand() * 12);
    const a = (k / 12) * Math.PI * 2;
    const long = k % 3 === 0;
    const r = 0.92 + (long ? 0.14 : 0.08) * rand();
    const w = long ? 0.09 : 0.055;
    const px = r;
    const py = (rand() - 0.5) * w;
    out.set(
      CX + px * Math.cos(a) - py * Math.sin(a),
      CY + px * Math.sin(a) + py * Math.cos(a),
      (rand() - 0.5) * 0.05,
    );
    return SLOT.soft;
  }
  if (part === 2) {
    // Hour hand, short and thick, at ten.
    capsule(rand, out, CX, CY, 0.06, CX - 0.42, CY + 0.5, 0.06, 0.075);
    return SLOT.ink;
  }
  if (part === 3) {
    // Minute hand, long and thin, at two. Different lengths are what stop the
    // pair reading as one chevron.
    capsule(rand, out, CX, CY, 0.06, CX + 0.62, CY + 0.5, 0.06, 0.055);
    return SLOT.ink;
  }
  if (part === 4) {
    // The pivot. Two lines crossing without one look like a fold, not a clock.
    ringXY(rand, out, CX, CY, 0.08, 0, 0.13);
    return SLOT.ink;
  }
  if (part === 5) {
    rimXY(rand, out, 1.5, -0.2, 0, 2.0, 2.7, 0.1);
    return SLOT.soft;
  }
  // Ruled lines, the last one short and accented — a total.
  const line = Math.floor(rand() * 5);
  const total = line === 4;
  const w = total ? 0.72 : 1.44;
  const x = total ? 1.5 - 0.33 : 1.5;
  const y = 0.72 - line * 0.4;
  capsule(rand, out, x - w / 2, y, 0.08, x + w / 2, y, 0.08, total ? 0.07 : 0.05);
  return total ? SLOT.accent : SLOT.ink;
};

/** Projects & Tasks — a kanban board, mid-sprint. */
const projects: Scene = (rand, out, u) => {
  const part = pick(u, [0.24, 0.12, 0.5, 0.14]);
  if (part === 0) {
    rimXY(rand, out, 0, 0, 0, 6.4, 4.6, 0.12);
    return SLOT.ink;
  }
  if (part === 1) {
    const col = rand() < 0.5 ? -1 : 1;
    capsule(rand, out, 2.13 * col, -2.2, 0.05, 2.13 * col, 2.2, 0.05, 0.05);
    return SLOT.ink;
  }
  if (part === 2) {
    // Cards, fewer as you move right — the shape of a board being worked
    // through, which is the only thing that separates this from a table.
    const col = pick(rand(), [0.45, 0.33, 0.22]);
    const perCol = [3, 2, 1][col];
    const row = Math.floor(rand() * perCol);
    rimXY(rand, out, -2.13 + col * 2.13, 1.35 - row * 1.15, 0.08, 1.6, 0.82, 0.08);
    return col === 2 ? SLOT.accent : SLOT.soft;
  }
  // A tick on the finished card.
  if (rand() < 0.42) capsule(rand, out, 1.75, 1.32, 0.16, 2.02, 1.08, 0.16, 0.06);
  else capsule(rand, out, 2.02, 1.08, 0.16, 2.55, 1.66, 0.16, 0.06);
  return SLOT.accent;
};

/** Manufacturing — two meshed cogs over a line of work in progress. */
const manufacturing: Scene = (rand, out, u) => {
  const part = pick(u, [0.4, 0.26, 0.16, 0.18]);
  if (part === 0 || part === 1) {
    const big = part === 0;
    const cx = big ? -1.05 : 1.45;
    const cy = big ? 1.15 : -0.05;
    const r0 = big ? 0.72 : 0.36;
    const r1 = big ? 1.5 : 0.82;
    const teeth = big ? 8 : 6;
    if (rand() < 0.66) {
      ringXY(rand, out, cx, cy, 0, r0, r1);
    } else {
      // A tooth, built along +X and rotated into place.
      const k = Math.floor(rand() * teeth);
      const tw = big ? 0.62 : 0.4;
      const th = big ? 0.42 : 0.28;
      const px = r1 - 0.05 + th * rand();
      const py = (rand() - 0.5) * tw;
      const a = (k / teeth) * Math.PI * 2;
      out.set(
        cx + px * Math.cos(a) - py * Math.sin(a),
        cy + px * Math.sin(a) + py * Math.cos(a),
        (rand() - 0.5) * 0.08,
      );
    }
    return big ? SLOT.accent : SLOT.soft;
  }
  if (part === 2) {
    capsule(rand, out, -3.0, -2.3, 0, 3.0, -2.3, 0, 0.09);
    return SLOT.ink;
  }
  const k = Math.floor(rand() * 4);
  rimXY(rand, out, -2.1 + k * 1.4, -1.75, 0.05, 0.86, 0.72, 0.09);
  return SLOT.warm;
};

/** Customer Support — an agent on a headset, mid-conversation. */
const support: Scene = (rand, out, u) => {
  if (u < 0.56) {
    human(rand, out, sub(u, 0, 0.56));
    place(out, 0.94, -1.5, -0.1);
    return SLOT.ink;
  }
  const v = sub(u, 0.56, 1);
  const part = pick(v, [0.14, 0.08, 0.5, 0.28]);
  if (part === 0) {
    // Headset band, over the crown.
    const a = 0.35 + rand() * (Math.PI - 0.7);
    out.set(
      -1.5 + Math.cos(a) * 0.44 * 0.94,
      -0.1 + (2.72 + Math.sin(a) * 0.5) * 0.94,
      (rand() - 0.5) * 0.1,
    );
    return SLOT.accent;
  }
  if (part === 1) {
    // Mic boom, swinging to the mouth.
    capsule(rand, out, -1.09, 2.4, 0.1, -1.35, 2.1, 0.4, 0.06);
    return SLOT.accent;
  }
  if (part === 2) {
    rimXY(rand, out, 2.2, 1.5, 0, 3.0, 1.9, 0.11);
    return SLOT.soft;
  }
  if (rand() < 0.22) {
    // The bubble's tail. Without it this is a rectangle.
    capsule(rand, out, 1.1, 0.6, 0, 0.55, 0.05, 0, 0.09);
    return SLOT.soft;
  }
  const dot = Math.floor(rand() * 3);
  ringXY(rand, out, 1.5 + dot * 0.7, 1.5, 0.08, 0, 0.2);
  return SLOT.accent;
};

/** Business Intelligence — a dashboard, on an Odoo screen. */
const bi: Scene = (rand, out, u, odoo) =>
  odooScreen(rand, out, u, odoo, { x: 0, y: 0.3, z: 0 }, {
    // Standing on its own rather than held, so it gets to be a real panel.
    // At the held size the mark and the dashboard were fighting over 1.7
    // units and landed on top of each other.
    scale: 2.35,
    // Header, not centrepiece: this screen's subject is the dashboard.
    markY: 0.38,
    markHalfW: 0.36,
    extra: (r, _o, put) => {
      const part = pick(r(), [0.3, 0.28, 0.3, 0.12]);
      if (part === 0) {
        // Donut, with a highlighted arc.
        const a = r() * Math.PI * 2;
        const rr = Math.sqrt(0.0055 + r() * (0.0225 - 0.0055));
        put(-0.5 + Math.cos(a) * rr, -0.22 + Math.sin(a) * rr, 0.06);
        return a < Math.PI * 0.8 ? SLOT.accent : SLOT.soft;
      }
      if (part === 1) {
        const b = Math.min(3, Math.floor(r() * 4));
        const h = [0.09, 0.16, 0.12, 0.23][b];
        put(-0.13 + b * 0.1, -0.36 + h * r(), 0.06);
        return SLOT.accent;
      }
      if (part === 2) {
        // Sparkline across the right half.
        const xs = [0.22, 0.36, 0.5, 0.64, 0.78];
        const ys = [-0.3, -0.16, -0.24, -0.06, 0.04];
        const seg = Math.min(3, Math.floor(r() * 4));
        const t = r();
        put(
          xs[seg] + (xs[seg + 1] - xs[seg]) * t,
          ys[seg] + (ys[seg + 1] - ys[seg]) * t + (r() - 0.5) * 0.02,
          0.06,
        );
        return SLOT.warm;
      }
      // A rule under the header, dividing the brand from the data.
      put((r() - 0.5) * 1.5, 0.19, 0.05);
      return SLOT.soft;
    },
  });

/**
 * AI Automation — a network with one node doing the deciding.
 *
 * The only scene with real depth. Everything else here is a drawing held up to
 * camera; this one is a volume, because "it reads across every department" is
 * a statement about connection rather than about any object.
 */
const NODES = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * Math.PI * 2 + 0.4;
  const tilt = Math.sin(i * 2.3) * 0.9;
  return new THREE.Vector3(
    Math.cos(a) * 2.9,
    Math.sin(a) * 2.2 + 0.2,
    tilt * 1.4,
  );
});

const ai: Scene = (rand, out, u) => {
  const part = pick(u, [0.2, 0.28, 0.52]);
  if (part === 0) {
    // The hub.
    const v = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - v * v));
    const rr = 0.66 * Math.pow(rand(), 0.35);
    out.set(Math.cos(th) * s * rr, 0.2 + v * rr, Math.sin(th) * s * rr);
    return SLOT.accent;
  }
  const n = NODES[Math.floor(rand() * NODES.length)];
  if (part === 1) {
    const v = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - v * v));
    const rr = 0.34 * Math.pow(rand(), 0.35);
    out.set(n.x + Math.cos(th) * s * rr, n.y + v * rr, n.z + Math.sin(th) * s * rr);
    return SLOT.soft;
  }
  // Edges, sagging slightly so the graph reads as strung rather than drawn.
  const t = rand();
  const sag = Math.sin(t * Math.PI) * 0.28;
  out.set(
    n.x * t + (rand() - 0.5) * 0.06,
    0.2 + (n.y - 0.2) * t - sag + (rand() - 0.5) * 0.06,
    n.z * t + (rand() - 0.5) * 0.06,
  );
  return SLOT.ink;
};

/**
 * Keyed by module id, in ring order. Anything missing falls back to the ring,
 * so a new module is a missing scene rather than a crash.
 */
export const MODULE_SCENES: Record<string, Scene> = {
  finance,
  crm,
  inventory,
  hr,
  payroll,
  projects,
  manufacturing,
  support,
  bi,
  ai,
};
