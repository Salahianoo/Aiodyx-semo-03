"use client";

import * as THREE from "three";

import type { AuthorityMark } from "@/lib/authority-marks";
import { rasterize } from "@/lib/raster";

/**
 * A logo, drawn as a point cloud.
 *
 * Lifted out of the integrations scene so the home page can draw AIODYX and
 * Odoo the *same way* rather than a similar way. Two renderers for one mark
 * are two things to keep in step, and they had already drifted: the same
 * logotype came out crisp on one page and soft on the other, because one was a
 * dedicated points object and the other was twelve thousand shared particles
 * wearing a per-formation size.
 *
 * Needs a DOM — `rasterize` fills onto a canvas — so it can only be called
 * from inside the component tree, never at module scope.
 */

/**
 * The size a mark is drawn at, in the material that draws it.
 *
 * Exported because it is half the look: with `sizeAttenuation` the on-screen
 * dot is this over the camera distance, so a scene that stands further back
 * has to scale it or the same mark arrives as a fainter one.
 */
export const MARK_DOT = 0.052;

/**
 * The box a mark is fitted into, rather than a width to stretch it to.
 *
 * Fitting by width alone works for a wordmark and fails for a symbol: GOSI is
 * two and a half times wider than it is tall and wants the width, while
 * ZATCA's shield is nearly square, so the same width made it 4.6 units tall in
 * a frame 5.9 units high — it overflowed the viewport and stopped reading as a
 * shield at all. Contain-fit lets one rule serve both shapes.
 */
export const MARK_BOX_W = 4.8;
/* Contain-fit, so a wordmark two and a half times wider than it is tall and a
   near-square shield are the same weight on the ring rather than the same
   width. Tight enough that three of them and the hub hold one frame. */
export const MARK_BOX_H = 2.0;
const MARK_POINTS = 3800;

/** A built mark, and the box it actually occupies. */
export type MarkCloud = {
  geometry: THREE.BufferGeometry;
  halfW: number;
  halfH: number;
};

/**
 * An authority's own logo, as a point cloud.
 *
 * The gates were rings — and a ring is a diagram of a gate, not a statement
 * about who is on the other side of it. A visitor recognises the mark of the
 * body they file with long before they read a heading, so the mark *is* the
 * gate.
 *
 * Colour is baked into a vertex attribute rather than resolved in a shader.
 * ZATCA's shield is twenty-four stripes running green through teal to blue,
 * and the gradient is the thing that makes it recognisable; a flat fill would
 * be the mark with its one identifying feature removed. Sampling the gradient
 * by each point's position across the emblem reproduces it with one pass
 * instead of twenty-four.
 */
export function buildMark(mark: AuthorityMark): MarkCloud | null {
  const emblem = rasterize(mark.emblem, mark.viewBox, 400, mark.transform);
  const word = mark.emblemOnly
    ? []
    : rasterize(mark.word, mark.viewBox, 400, mark.transform);
  if (!emblem.length && !word.length) return null;

  // Both halves were rasterised at one width, so they already share a
  // coordinate system — the wordmark sits where it belongs beside the emblem
  // rather than being re-fitted to its own bounding box.
  const aspect = mark.viewBox.h / mark.viewBox.w;

  /**
   * Fitted to what is actually drawn, not to the source viewBox.
   *
   * A logo's file is mostly empty space around the artwork, and drawing the
   * symbol alone leaves the hole where its wordmark used to be. Measuring the
   * sampled points and fitting those centres the mark and gives it the whole
   * width, whichever half of the lockup ended up being used.
   */
  let lo = Infinity;
  let hi = -Infinity;
  let bot = Infinity;
  let top = -Infinity;
  for (const [x, y] of emblem) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
    if (y < bot) bot = y;
    if (y > top) top = y;
  }
  const emblemLo = lo;
  const emblemSpan = Math.max(hi - lo, 1e-6);
  for (const [x, y] of word) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
    if (y < bot) bot = y;
    if (y > top) top = y;
  }

  const cx = (lo + hi) / 2;
  const cy = (bot + top) / 2;
  // One scale for both axes — the smaller of the two fits — so the mark is
  // contained rather than stretched or cropped.
  const srcW = Math.max(hi - lo, 1e-6);
  const srcH = Math.max((top - bot) * aspect, 1e-6);
  const k = Math.min(MARK_BOX_W / srcW, MARK_BOX_H / srcH);
  const halfW = (srcW * k) / 2;
  const halfH = (srcH * k) / 2;

  const stops = mark.gradient.map((c) => new THREE.Color(c));
  const wordCol = new THREE.Color(mark.wordColor);
  const mixed = new THREE.Color();

  const pos = new Float32Array(MARK_POINTS * 3);
  const col = new Float32Array(MARK_POINTS * 3);

  // Deterministic: the mark must be identical on every load.
  let seed = 0x9e37;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Drawn from the two lists concatenated, so density follows ink area and
  // neither half comes out heavier than it is drawn.
  const total = emblem.length + word.length;
  for (let i = 0; i < MARK_POINTS; i++) {
    const pickIdx = Math.floor(rand() * total);
    const isEmblem = pickIdx < emblem.length;
    const [px, py] = isEmblem ? emblem[pickIdx] : word[pickIdx - emblem.length];

    const j = i * 3;
    pos[j] = (px - cx) * k;
    // The height carries the aspect, or a mark twice as wide as it is tall
    // comes out square.
    pos[j + 1] = (py - cy) * aspect * k;
    pos[j + 2] = 0;

    if (isEmblem && stops.length > 1) {
      // Sampled across the *emblem's* own width, not the fitted box, so the
      // gradient runs the way it was drawn even when a wordmark widens the box.
      const t = ((px - emblemLo) / emblemSpan) * (stops.length - 1);
      const a = Math.min(stops.length - 2, Math.max(0, Math.floor(t)));
      mixed.copy(stops[a]).lerp(stops[a + 1], Math.min(1, Math.max(0, t - a)));
    } else if (isEmblem) {
      mixed.copy(stops[0]);
    } else {
      mixed.copy(wordCol);
    }
    col[j] = mixed.r;
    col[j + 1] = mixed.g;
    col[j + 2] = mixed.b;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return { geometry: g, halfW, halfH };
}
