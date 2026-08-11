"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { MODULES } from "@/lib/story";
import { beat, damp, owns, rangeOf, scroll } from "@/lib/scroll";

/**
 * Lines from every module into the core, plus a pulse that travels the
 * Sales → Purchases → Inventory chain in beat 7.
 *
 * The lines draw themselves on with a shader `uProgress` rather than by
 * rebuilding geometry — geometry churn every frame would allocate constantly
 * and stutter under GC.
 */

const vertex = /* glsl */ `
  attribute float aDist;      // 0 at core, 1 at module
  attribute vec3  aColor;
  varying float vDist;
  varying vec3  vColor;
  void main() {
    vDist = aDist;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uProgress;   // how far the wiring has drawn on
  uniform float uPulse;      // travelling highlight position
  uniform float uPulseAmt;
  varying float vDist;
  varying vec3  vColor;

  void main() {
    // Draw on from the core outwards
    float drawn = smoothstep(uProgress, uProgress - 0.28, vDist);

    // A soft travelling band along the line
    float d = abs(vDist - uPulse);
    float pulse = smoothstep(0.16, 0.0, d) * uPulseAmt;

    float alpha = drawn * (0.16 + pulse * 0.85);
    if (alpha < 0.002) discard;

    vec3 col = mix(vColor, vec3(1.0), pulse * 0.65);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function Connections() {
  const mat = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions: number[] = [];
    const dists: number[] = [];
    const colors: number[] = [];
    const c = new THREE.Color();

    // Each module gets a straight run to the core, subdivided so the shader
    // has resolution to animate along.
    const SEGMENTS = 24;
    for (const m of MODULES) {
      c.set(m.color);
      const [mx, my, mz] = m.assembled;
      for (let s = 0; s < SEGMENTS; s++) {
        const t0 = s / SEGMENTS;
        const t1 = (s + 1) / SEGMENTS;
        for (const t of [t0, t1]) {
          positions.push(mx * t, my * t, mz * t);
          dists.push(t);
          colors.push(c.r, c.g, c.b);
        }
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("aDist", new THREE.Float32BufferAttribute(dists, 1));
    g.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uPulse: { value: 0 },
      uPulseAmt: { value: 0 },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!mat.current) return;
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const u = mat.current.uniforms;

    // Draws on just behind the modules' convergence (0.36–0.54), so the lines
    // meet panels that have arrived rather than reaching into empty space.
    const [aFrom, aTo] = rangeOf("assembly");
    u.uProgress.value = damp(u.uProgress.value, beat(p, aFrom, aTo), 3, dt);

    // Beat 7 sends a value down the chain, looping while that beat is on screen
    const chainOn = owns(p, "ai", 0.3);
    u.uPulseAmt.value = damp(u.uPulseAmt.value, chainOn, 4, dt);
    u.uPulse.value = (state.clock.elapsedTime * 0.42) % 1;
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/** The unified core the modules resolve around. */
export function Core({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const innerMat = useRef<THREE.MeshStandardMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;

    // Appears with the wiring, strengthens through assembly
    const [aFrom, aTo] = rangeOf("assembly");
    const presence = beat(p, aFrom, aTo);

    if (inner.current && innerMat.current) {
      // Small on purpose: the core is the thing the ring points at, not the
      // subject. At 0.52 it filled the frame during the dive.
      const s = 0.06 + presence * 0.2;
      inner.current.scale.setScalar(damp(inner.current.scale.x, s, 3, dt));
      innerMat.current.opacity = damp(innerMat.current.opacity, presence, 3, dt);
      innerMat.current.emissiveIntensity = damp(
        innerMat.current.emissiveIntensity,
        presence * 2.4,
        3,
        dt,
      );
    }

    if (halo.current && haloMat.current) {
      // Breathing halo — slow, and only when motion is allowed
      const breathe = reduced
        ? 1
        : 1 + Math.sin(state.clock.elapsedTime * 0.9) * 0.06;
      const s = (0.16 + presence * 0.34) * breathe;
      halo.current.scale.setScalar(damp(halo.current.scale.x, s, 3, dt));
      // Very low — additive blending over bloom compounds fast, and this
      // sits directly behind body copy.
      haloMat.current.opacity = damp(
        haloMat.current.opacity,
        presence * 0.055,
        3,
        dt,
      );
    }

    if (group.current && !reduced) {
      group.current.rotation.z += dt * 0.12 * presence;
    }
  });

  return (
    <group ref={group}>
      <mesh ref={inner}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          ref={innerMat}
          color="#1A1030"
          emissive="#8B5CF6"
          emissiveIntensity={0}
          roughness={0.22}
          metalness={0.6}
          transparent
          opacity={0}
        />
      </mesh>

      <mesh ref={halo}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          ref={haloMat}
          color="#8B5CF6"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

