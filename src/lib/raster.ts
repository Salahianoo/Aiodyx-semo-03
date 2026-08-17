/**
 * Path data to points, by filling it onto a canvas and sampling opaque pixels.
 *
 * Rasterising is the only way to get a *fill*: walking the path data gives the
 * outline, and any logotype sampled that way comes out hollow. It is how the
 * AIODYX finale has always worked, and the Odoo mark on the accountant's
 * ledger needs exactly the same thing.
 *
 * Needs a DOM, so it can only be called from inside the component tree — never
 * at module scope.
 */

export type ViewBox = { x: number; y: number; w: number; h: number };

/**
 * A rasterised wordmark, split by colour.
 *
 * The Odoo mark is only recognisable as *Odoo's* if its leading letter keeps
 * its own magenta, so the two halves are sampled separately — at the same
 * raster width, which is what keeps them in one coordinate system instead of
 * each being re-fitted to its own bounding box.
 */
export type MarkSample = {
  accent: [number, number][];
  plain: [number, number][];
  /** Height ÷ width of the mark's own box, so it can be placed unsquashed. */
  aspect: number;
};

/**
 * Samples `paths` and returns points normalised to ±0.5 against **their own**
 * dimension, so a caller scaling both axes by the same number squares up a
 * mark that is wider than it is tall. Whoever places them supplies the aspect.
 *
 * `width` is the raster width in pixels — it sets how fine the sampling is,
 * not how big the result ends up.
 */
export function rasterize(
  paths: readonly string[],
  viewBox: ViewBox,
  width: number,
): [number, number][] {
  const W = Math.max(1, Math.round(width));
  const H = Math.max(1, Math.round((W * viewBox.h) / viewBox.w));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  const s = W / viewBox.w;
  ctx.setTransform(s, 0, 0, s, -viewBox.x * s, -viewBox.y * s);
  ctx.fillStyle = "#fff";
  for (const d of paths) ctx.fill(new Path2D(d));

  const { data } = ctx.getImageData(0, 0, W, H);
  const hits: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 128) hits.push([x / W - 0.5, 0.5 - y / H]);
    }
  }
  return hits;
}

/**
 * Fisher-Yates, so taking the first N later is an even sample of the glyphs
 * rather than a slab of whatever the scanline order reached first.
 */
export function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
