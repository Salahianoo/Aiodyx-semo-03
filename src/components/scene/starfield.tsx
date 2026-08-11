"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { damp, scroll } from "@/lib/scroll";

const COUNT = 900;

/** Deterministic PRNG — same field every load, on server and client alike. */
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
 * Built once at module scope, not in a hook. `Math.random()` during render is
 * impure — React may re-run render, and the dust would reshuffle.
 */
const DUST = (() => {
  const rand = mulberry32(0x5eed);
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    // Distributed in a slab well behind the action
    pos[i * 3] = (rand() - 0.5) * 44;
    pos[i * 3 + 1] = (rand() - 0.5) * 30;
    pos[i * 3 + 2] = -rand() * 34 - 2;
  }
  return pos;
})();

/**
 * Dust. Gives the empty space parallax so the camera moves read as travel
 * rather than objects growing.
 *
 * One Points object, not 900 meshes — 900 draw calls would dominate the frame.
 */
export function Starfield({ reduced }: { reduced: boolean }) {
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(DUST, 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);

    if (mat.current) {
      // Fade the dust up once past the cold open, down again at the close
      const p = scroll.progress;
      const visible = Math.min(p / 0.08, 1) * (1 - Math.max(0, (p - 0.94) / 0.06));
      mat.current.opacity = damp(mat.current.opacity, visible * 0.5, 3, dt);
    }

    if (points.current && !reduced) {
      points.current.rotation.y = state.clock.elapsedTime * 0.006;
    }
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={mat}
        size={0.035}
        color="#B9B4D6"
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
