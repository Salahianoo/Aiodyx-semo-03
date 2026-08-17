"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";

import { StoryOverlay } from "@/components/story-overlay";
import { Nav } from "@/components/nav";
import { useLocale } from "@/components/providers";
import { t } from "@/lib/content";
import { type Locale } from "@/lib/i18n";
import { useLenis } from "@/lib/scroll";
import type { Beat } from "@/lib/story";
import { SCENE } from "@/lib/theme";

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

/**
 * Everything a scene needs from the page around it.
 *
 * Passed down rather than read from context inside the scene, because R3F
 * children live in their own reconciler: a context provider mounted outside
 * the <Canvas> is not visible to components rendered inside it.
 *
 * The palette is not in here. There is exactly one, so the scenes import
 * `SCENE` directly rather than having a constant threaded through every
 * component boundary between the page and the material that needs it.
 */
export type SceneEnv = {
  reduced: boolean;
  locale: Locale;
};

export function StoryPage({
  beats,
  scene,
  align = "alternate",
  fov = 42,
  bloom = 0.72,
  showHint = false,
  signed = false,
  intro,
  children,
}: {
  beats: Beat[];
  /** Receives the theme, locale and reduced-motion flag. */
  scene: (env: SceneEnv) => ReactNode;
  align?: "alternate" | "center";
  fov?: number;
  bloom?: number;
  showHint?: boolean;
  /**
   * The final beat has a logotype resolving underneath it.
   *
   * A centred closing block leaves equal air above and below, and the mark
   * needs the lower band — so on a signed page the last beat gives up some of
   * its bottom padding and rides higher.
   */
  signed?: boolean;
  /** Rendered inside the opening beat. */
  intro?: ReactNode;
  children?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const locale = useLocale();
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
      {/* Bloom is a luminance-threshold effect: on this ground the whole frame
          clears the threshold, so it stops picking anything out and just lays
          milk over the page. `SCENE.bloom` is 0, which switches the composer
          off entirely rather than running a full-screen pass for nothing. */}
      <Stage fov={fov} bloom={bloom * SCENE.bloom}>
        {scene({ reduced, locale })}
      </Stage>
      <StoryOverlay
        beats={beats}
        align={align}
        className={signed ? "story--signed" : ""}
        intro={intro}
      >
        {children}
      </StoryOverlay>
      {showHint && (
        <p className="hint" style={{ opacity: hintVisible ? 1 : 0 }}>
          {t(locale, "ui.scroll", "Scroll")}
        </p>
      )}
    </>
  );
}
