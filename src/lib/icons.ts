/**
 * Six ERP glyphs, as points — the opening formation.
 *
 * The page used to open on a formless haze, deliberately faint so the hero
 * headline could win. This says what the product *is* before a word has been
 * read, which the haze never did.
 *
 * They are laid out as a ring with the copy in the hub, which is the same
 * shape as every ERP diagram ever drawn and, more usefully, the one
 * arrangement that puts a lot of imagery on screen without putting any of it
 * behind the headline. A grid or a scatter would have to sit under the copy.
 *
 * Each glyph is authored flat in a ±0.5 box and placed on the ring afterwards,
 * so the drawing code never has to think about where it ends up.
 */

/** A point in glyph space. Mutated in place — this runs 12,000 times. */
export type P = { x: number; y: number };

export const ICON_COUNT = 6;

/* ---------------------------------------------------------------- shapes */

/** `sqrt` for the radius, or the samples pile up in the middle. */
const discR = (rand: () => number, r0: number, r1: number) =>
  Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0));

function ringSector(
  rand: () => number,
  out: P,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
) {
  const a = a0 + rand() * (a1 - a0);
  const r = discR(rand, r0, r1);
  out.x = Math.cos(a) * r;
  out.y = Math.sin(a) * r;
}

/** A thick line from (x0,y0) to (x1,y1) — the workhorse for every glyph. */
function bar(
  rand: () => number,
  out: P,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
) {
  const u = rand();
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular, so the stroke has an even width along its whole run
  const nx = -dy / len;
  const ny = dx / len;
  const off = (rand() - 0.5) * t;
  out.x = x0 + dx * u + nx * off;
  out.y = y0 + dy * u + ny * off;
}

function rect(rand: () => number, out: P, cx: number, cy: number, w: number, h: number) {
  out.x = cx + (rand() - 0.5) * w;
  out.y = cy + (rand() - 0.5) * h;
}

/** The four edges of a rectangle, walked by length so corners don't bunch. */
function rectRim(
  rand: () => number,
  out: P,
  w: number,
  h: number,
  t: number,
) {
  const hw = w / 2;
  const hh = h / 2;
  const side = h - t * 2;
  let r = rand() * (w * 2 + side * 2);
  if (r < w) rect(rand, out, -hw + r, hh - t / 2, 0.001, t);
  else if ((r -= w) < w) rect(rand, out, -hw + r, -hh + t / 2, 0.001, t);
  else if ((r -= w) < side) rect(rand, out, -hw + t / 2, -hh + t + r, t, 0.001);
  else rect(rand, out, hw - t / 2, -hh + t + (r - side), t, 0.001);
}

function rotate(out: P, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = out.x;
  out.x = x * c - out.y * s;
  out.y = x * s + out.y * c;
}

/* ----------------------------------------------------------------- glyphs */

/**
 * Everything below is drawn far bolder than it looks like it needs to be.
 *
 * The first pass used hairline strokes and fine detail — a pie with a 2°
 * separation, an axis on the bar chart, small operator glyphs — and at ~170
 * screen pixels with 2,000 points every one of them collapsed into a coloured
 * blob. Only the envelope survived, because it was the only glyph that was an
 * outline plus one unmistakable feature. The rest are rebuilt to that rule:
 * few elements, fat strokes, big gaps.
 */

/** Analytics — a pie with one slice pulled well clear. */
function pie(rand: () => number, out: P) {
  if (rand() < 0.24) {
    ringSector(rand, out, 0, 0.44, 0.5, 1.42);
    // Offset along the slice's own bisector. At 0.09 the gap read as a crack
    // in a disc; it has to be a visible wedge of empty space or the pie is a
    // circle.
    out.x += Math.cos(0.96) * 0.17;
    out.y += Math.sin(0.96) * 0.17;
  } else {
    ringSector(rand, out, 0, 0.44, 1.6, Math.PI * 2 + 0.32);
  }
}

/** Reporting — three fat bars on a baseline. */
function bars(rand: () => number, out: P) {
  if (rand() < 0.16) {
    // Baseline only. The first pass had an L-shaped axis, and the vertical
    // arm sat close enough to the first bar to read as a fourth one.
    bar(rand, out, -0.44, -0.44, 0.44, -0.44, 0.085);
    return;
  }
  const b = Math.min(2, Math.floor(rand() * 3));
  const h = [0.34, 0.58, 0.8][b];
  rect(rand, out, -0.27 + b * 0.27, -0.4 + h / 2, 0.2, h);
}

/** Growth — a trend line with an arrowhead, and no bars. */
function growth(rand: () => number, out: P) {
  // Bars *and* an arrow made this the bar chart with extra marks on it; the
  // two glyphs were indistinguishable at size. The line alone is the one
  // shape nothing else on the ring shares.
  const r = rand();
  if (r < 0.3) bar(rand, out, -0.44, -0.2, -0.13, 0.1, 0.095);
  else if (r < 0.52) bar(rand, out, -0.13, 0.1, 0.05, -0.1, 0.095);
  else if (r < 0.82) bar(rand, out, 0.05, -0.1, 0.3, 0.24, 0.095);
  else {
    // Arrowhead, sampled as a triangle from its tip
    const u = rand();
    const v = rand() * (1 - u);
    out.x = 0.44 + -0.26 * u + -0.02 * v;
    out.y = 0.4 + -0.06 * u + -0.28 * v;
  }
}

/** Accounting — a calculator, with the four operators on its keys. */
function calc(rand: () => number, out: P) {
  const r = rand();
  if (r < 0.3) {
    rectRim(rand, out, 0.68, 0.84, 0.1);
    return;
  }
  if (r < 0.42) {
    // The display. One solid bar across the top is what stops this reading as
    // a plain box with four marks in it.
    rect(rand, out, 0, 0.26, 0.42, 0.13);
    return;
  }
  const k = Math.min(3, Math.floor(rand() * 4));
  const cx = k % 2 === 0 ? -0.14 : 0.14;
  const cy = k < 2 ? -0.02 : -0.26;
  const s = 0.2;
  const t = 0.075;
  switch (k) {
    case 0: // plus
      if (rand() < 0.5) bar(rand, out, cx - s / 2, cy, cx + s / 2, cy, t);
      else bar(rand, out, cx, cy - s / 2, cx, cy + s / 2, t);
      return;
    case 1: // times
      if (rand() < 0.5)
        bar(rand, out, cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2, t);
      else bar(rand, out, cx - s / 2, cy + s / 2, cx + s / 2, cy - s / 2, t);
      return;
    case 2: // minus
      bar(rand, out, cx - s / 2, cy, cx + s / 2, cy, t + 0.015);
      return;
    default: {
      // divide
      const q = rand();
      if (q < 0.5) bar(rand, out, cx - s / 2, cy, cx + s / 2, cy, t);
      else rect(rand, out, cx, cy + (q < 0.75 ? 0.08 : -0.08), 0.07, 0.07);
      return;
    }
  }
}

/** Communication — an envelope. The glyph the others are modelled on. */
function mail(rand: () => number, out: P) {
  if (rand() < 0.52) {
    rectRim(rand, out, 0.84, 0.58, 0.085);
    return;
  }
  if (rand() < 0.5) bar(rand, out, -0.42, 0.29, 0, -0.03, 0.075);
  else bar(rand, out, 0.42, 0.29, 0, -0.03, 0.075);
}

/** Operations — two meshed cogs. */
function gears(rand: () => number, out: P) {
  const big = rand() < 0.62;
  const cx = big ? -0.1 : 0.27;
  const cy = big ? 0.07 : -0.26;
  const r0 = big ? 0.14 : 0.06;
  const r1 = big ? 0.27 : 0.14;
  // Six teeth, not eight, and each nearly twice as wide. Eight fine teeth on a
  // 170px cog is a fuzzy edge, which is a circle.
  const teeth = big ? 6 : 5;

  if (rand() < 0.62) {
    ringSector(rand, out, r0, r1, 0, Math.PI * 2);
  } else {
    const k = Math.floor(rand() * teeth);
    const tw = big ? 0.15 : 0.1;
    const th = big ? 0.12 : 0.08;
    out.x = r1 - 0.02 + th * rand();
    out.y = (rand() - 0.5) * tw;
    rotate(out, (k / teeth) * Math.PI * 2);
  }
  out.x += cx;
  out.y += cy;
}

const GLYPHS = [pie, bars, growth, calc, mail, gears];

/**
 * Writes glyph `icon` into `out`, in a ±0.5 box.
 *
 * The caller decides where it lands and how big it is; nothing in here knows
 * about the ring.
 */
export function iconPoint(rand: () => number, out: P, icon: number) {
  GLYPHS[icon % ICON_COUNT](rand, out);
}
