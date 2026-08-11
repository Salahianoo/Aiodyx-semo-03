"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import { StoryOverlay } from "@/components/story-overlay";
import { Nav } from "@/components/nav";
import { useLenis } from "@/lib/scroll";
import type { Beat } from "@/lib/story";

/**
 * The WebGL bundle is heavy and useless on the server, so it loads client-side
 * only. Nothing in any story depends on it for meaning — every beat is real
 * DOM text that reads fine before, and without, the canvas.
 */
const Stage = dynamic(
  () => import("@/components/scene/stage").then((m) => m.Stage),
  { ssr: false },
);

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

export function StoryPage({
  beats,
  scene,
  align = "alternate",
  fov = 42,
  bloom = 0.72,
  showHint = false,
  children,
}: {
  beats: Beat[];
  /** Receives the reduced-motion flag so scenes can drop idle motion. */
  scene: (reduced: boolean) => ReactNode;
  align?: "alternate" | "center";
  fov?: number;
  bloom?: number;
  showHint?: boolean;
  children?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const [hintVisible, setHintVisible] = useState(true);

  // Smooth scrolling is disabled outright under reduced motion
  useLenis(!reduced);

  useEffect(() => {
    if (!showHint) return;
    // Single threshold crossing, not a per-frame subscription
    const onScroll = () => setHintVisible(window.scrollY < 120);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showHint]);

  return (
    <>
      <Nav />
      <Stage fov={fov} bloom={bloom}>
        {scene(reduced)}
      </Stage>
      <StoryOverlay beats={beats} align={align}>
        {children}
      </StoryOverlay>
      {showHint && (
        <p className="hint" style={{ opacity: hintVisible ? 1 : 0 }}>
          Scroll
        </p>
      )}
    </>
  );
}
