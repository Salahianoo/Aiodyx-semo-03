"use client";

import { Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, Preload } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

/**
 * Fixed full-viewport canvas sitting behind the scrolling copy.
 *
 * `pointer-events: none` so the canvas never eats a scroll or a link click —
 * it is scenery, not a control surface. Each page supplies its own scene as
 * children; only the shell is shared.
 */
export function Stage({
  children,
  fov = 42,
  bloom = 0.72,
}: {
  children: ReactNode;
  fov?: number;
  /** Set to 0 to skip the composer entirely on quiet pages. */
  bloom?: number;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 3.4], fov, near: 0.1, far: 200 }}
        // 1.75 rather than 2: bloom is a full-screen multi-pass effect, so
        // fill cost scales with the square of this and the visible difference
        // above ~1.75 is nil.
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          {children}

          {bloom > 0 && (
            <EffectComposer enableNormalPass={false}>
              <Bloom
                intensity={bloom}
                luminanceThreshold={0.32}
                luminanceSmoothing={0.85}
                mipmapBlur
              />
            </EffectComposer>
          )}

          <AdaptiveDpr pixelated />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
