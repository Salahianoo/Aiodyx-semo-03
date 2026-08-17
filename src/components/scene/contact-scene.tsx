"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

import type { SceneEnv } from "@/components/story-page";
import { t } from "@/lib/content";
import { arabicFontUrl, displayCase } from "@/lib/fonts";
import { isRtl, type Locale } from "@/lib/i18n";
import { damp, scroll } from "@/lib/scroll";
import { ACCENT, CITY_COLORS, PEAK, SCENE } from "@/lib/theme";
import { Starfield } from "./starfield";

/**
 * The quiet one, on purpose.
 *
 * A contact form is a functional surface people use deliberately — they are
 * reading labels, typing, and checking what they typed. Animation competing
 * with that is decoration that costs comprehension, so this scene has no
 * scroll choreography at all: two office nodes, an arc between them, and a
 * very slow travelling pulse. It sits far back and stays out of the way.
 */

/**
 * Placed in the upper-*trailing* corner of the frame, which is the one region
 * the copy and the panels leave empty. Centred, the markers sat directly
 * behind the opaque form panel and were invisible.
 *
 * "Trailing" and not "right": under Arabic the whole page mirrors, so the
 * upper right is where the headline now is — these coordinates have to mirror
 * with it or the scene lands on top of the copy it was placed to avoid.
 */
const AMMAN = new THREE.Vector3(1.5, 1.05, -0.9);
const RIYADH = new THREE.Vector3(3.4, 0.05, -1.5);

/** The same point, mirrored across the vertical axis when the page is RTL. */
const mirrored = (v: THREE.Vector3, rtl: boolean) =>
  rtl ? new THREE.Vector3(-v.x, v.y, v.z) : v;

const ARC_VERTEX = /* glsl */ `
  attribute float aDist;
  varying float vDist;
  void main() {
    vDist = aDist;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_FRAGMENT = /* glsl */ `
  uniform float uPulse;
  uniform vec3 uColor;
  /** What the pulse brightens *toward*: white on black, ink on paper. */
  uniform vec3 uPeak;
  uniform float uAlpha;
  varying float vDist;
  void main() {
    float pulse = smoothstep(0.11, 0.0, abs(vDist - uPulse));
    float alpha = (0.13 + pulse * 0.7) * uAlpha;
    gl_FragColor = vec4(mix(uColor, uPeak, pulse * 0.6), alpha);
  }
`;

/**
 * Built as a THREE.Line and mounted with <primitive> rather than as a
 * <line> element: in JSX, `line` resolves to the SVG intrinsic, not R3F's.
 */
/**
 * Built once at module scope. The arc is entirely static and there is exactly
 * one on the page, so there is nothing for a hook to memoise — and building it
 * outside the component keeps both the geometry and its mutable uniforms clear
 * of the compiler's render-purity and ref rules.
 */
const ARC_UNIFORMS = {
  uPulse: { value: 0 },
  uColor: { value: new THREE.Color(CITY_COLORS.amman) },
  uPeak: { value: new THREE.Color(PEAK) },
  /**
   * The line was tuned as an additive glow. Read as coverage instead, the same
   * alphas produce a washed-out grey thread, so it leans on this.
   */
  uAlpha: { value: 1.5 },
};

const ARC_LINE = (() => {
  // A gentle bow between the two offices, lifted on Y
  const mid = AMMAN.clone().lerp(RIYADH, 0.5);
  mid.y += 1.1;
  mid.z += 0.6;
  const curve = new THREE.QuadraticBezierCurve3(AMMAN, mid, RIYADH);
  const pts = curve.getPoints(120);

  const positions: number[] = [];
  const dists: number[] = [];
  pts.forEach((pt, i) => {
    positions.push(pt.x, pt.y, pt.z);
    dists.push(i / (pts.length - 1));
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aDist", new THREE.Float32BufferAttribute(dists, 1));

  const m = new THREE.ShaderMaterial({
    vertexShader: ARC_VERTEX,
    fragmentShader: ARC_FRAGMENT,
    uniforms: ARC_UNIFORMS,
    transparent: true,
    depthWrite: false,
    // Additive would add its colour to the paper behind it, which is nothing.
    blending: THREE.NormalBlending,
  });

  const line = new THREE.Line(g, m);
  line.frustumCulled = false;
  return line;
})();

function Arc({ rtl }: { rtl: boolean }) {
  useFrame((state) => {
    // Slow enough to read as a signal travelling, not a loading bar
    ARC_UNIFORMS.uPulse.value = (state.clock.elapsedTime * 0.16) % 1.35;
  });

  // The arc is one static line with no text on it, so mirroring the whole
  // object is safe here in a way it would not be for the markers — their
  // labels would come out backwards.
  return (
    <group scale={[rtl ? -1 : 1, 1, 1]}>
      <primitive object={ARC_LINE} />
    </group>
  );
}

function Marker({
  at,
  label,
  color,
  locale,
}: {
  at: THREE.Vector3;
  label: string;
  color: string;
  locale: Locale;
}) {
  const halo = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    if (!halo.current) return;
    // A slow breath, well under the rate that pulls the eye off the form
    const s = 1 + Math.sin(state.clock.elapsedTime * 0.7) * 0.12;
    halo.current.scale.setScalar(damp(halo.current.scale.x, s, 2, dt));
  });

  return (
    <group position={at}>
      {/* Bloom is off on this page, so the markers carry their own brightness
          rather than relying on the composer to make them glow. */}
      <mesh>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.17, 20, 20]} />
        {/* A normal-blended wash rather than an additive glow, which needs
            more alpha to register the same softness. */}
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.24}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[0, 0.36, 0]}
        fontSize={0.15}
        color={SCENE.muted}
        anchorX="center"
        font={arabicFontUrl(locale)}
        letterSpacing={locale === "ar" ? 0 : 0.1}
      >
        {displayCase(label, locale)}
      </Text>
    </group>
  );
}

/** Almost stationary — a hair of parallax so it isn't a flat backdrop. */
function CalmRig({ reduced }: { reduced: boolean }) {
  const pointer = useRef({ x: 0, y: 0 });
  const look = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { camera } = state;

    let x = 0;
    let y = 0;
    if (!reduced) {
      pointer.current.x = damp(pointer.current.x, state.pointer.x, 1.6, dt);
      pointer.current.y = damp(pointer.current.y, state.pointer.y, 1.6, dt);
      x = pointer.current.x * 0.22;
      y = pointer.current.y * 0.14;
    }

    // A very small scroll response only — enough to feel alive, not enough
    // to move anything while someone is typing.
    const drift = scroll.progress * 0.5;

    camera.position.x = damp(camera.position.x, x, 1.8, dt);
    camera.position.y = damp(camera.position.y, y - drift, 1.8, dt);
    camera.position.z = damp(camera.position.z, 5.2, 1.8, dt);
    camera.lookAt(look.current);
  });

  return null;
}

export function ContactScene({ reduced, locale }: SceneEnv) {
  // Derived from the locale rather than read from `scroll.rtl`, which is
  // published by an effect and is therefore still stale on first render — the
  // one render where these positions are decided.
  const rtl = isRtl(locale);

  return (
    <>
      <ambientLight intensity={0.85} />
      <pointLight position={[0, 1, 3]} intensity={0.9} color={ACCENT} />

      <Starfield reduced={reduced} />
      <Arc rtl={rtl} />
      <Marker
        at={mirrored(AMMAN, rtl)}
        label={t(locale, "about.locations.jordan.city")}
        color={CITY_COLORS.amman}
        locale={locale}
      />
      <Marker
        at={mirrored(RIYADH, rtl)}
        label={t(locale, "about.locations.saudi.city")}
        color={CITY_COLORS.riyadh}
        locale={locale}
      />
      <CalmRig reduced={reduced} />
    </>
  );
}
