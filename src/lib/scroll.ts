"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Scroll progress lives in a module-level mutable object, NOT React state.
 *
 * This is the single most important decision in the whole scene. Scroll fires
 * at display rate; calling setState on every event would re-render the React
 * tree ~120×/second and the animation would stutter under its own weight.
 * Instead the scene reads `scroll.progress` inside useFrame, which is already
 * running on the render loop. Zero React renders while scrolling.
 */
export const scroll = {
  /** 0 → 1 across the whole document. */
  progress: 0,
  /** Signed velocity, used to lean the camera into the direction of travel. */
  velocity: 0,
  /**
   * Measured scroll range of each beat section, keyed by its id.
   *
   * The scene used to key off hardcoded fractions, which silently desynced the
   * moment a section grew past 100vh (any beat with content cards does). These
   * are measured from the real layout by <StoryOverlay> on mount and resize,
   * so the 3D and the copy cannot drift apart.
   */
  ranges: {} as Record<string, [number, number]>,
  /**
   * False until <StoryOverlay> has measured the layout.
   *
   * Scenes must check this before deriving per-beat state: while ranges are
   * empty, every id resolves to the same fallback window, so every module card
   * would believe it was the focused one at once.
   */
  measured: false,
};

/** Measured [from, to] for a beat, or the whole page if not measured yet. */
export const rangeOf = (id: string): [number, number] =>
  scroll.ranges[id] ?? [0, 1];

/** Progress inside a beat's own range, 0 → 1. */
export const within = (p: number, id: string) => {
  const [from, to] = rangeOf(id);
  return range(p, from, to);
};

/**
 * 1 while a beat owns the frame, ramping in and out over `edge` of its span.
 * Two-sided by construction — a one-sided ramp would latch at 1 forever.
 */
export const owns = (p: number, id: string, edge = 0.3) => {
  if (!scroll.measured) return 0;
  const [from, to] = rangeOf(id);
  const span = Math.max(to - from, 1e-4);
  const e = span * edge;
  return beat(p, from - e, from + e) * (1 - beat(p, to - e, to + e));
};

export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled) {
      // Reduced motion: no smoothing, but progress still has to track scroll
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        scroll.progress = max > 0 ? window.scrollY / max : 0;
        scroll.velocity = 0;
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    const lenis = new Lenis({
      // Long, heavy feel — this is a cinematic page, not a UI surface.
      lerp: 0.085,
      wheelMultiplier: 0.9,
      syncTouch: true,
    });

    lenis.on("scroll", (e: { progress: number; velocity: number }) => {
      scroll.progress = e.progress;
      scroll.velocity = e.velocity;
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [enabled]);
}

/* ---------------------------------------------------------------- helpers */

export const clamp = (v: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, v));

/** Normalised progress within [start, end], clamped outside it. */
export const range = (p: number, start: number, end: number) =>
  clamp((p - start) / (end - start));

/** Smoothstep — removes the velocity discontinuity at both ends of a range. */
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Ranged + smoothed, the combination almost every beat wants. */
export const beat = (p: number, start: number, end: number) =>
  smooth(range(p, start, end));

/**
 * Frame-rate independent damping.
 *
 * Every scroll-linked value goes through this rather than being assigned
 * directly. That means the scene always animates *from its current on-screen
 * value*, so reversing scroll mid-beat reverses the motion smoothly instead of
 * snapping — the interruptibility principle, applied to a scroll timeline.
 */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));
