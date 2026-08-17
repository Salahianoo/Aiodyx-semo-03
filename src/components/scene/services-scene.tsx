"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import type { SceneEnv } from "@/components/story-page";
import { STAGES, TIER_GAP, TOP_Y, tierY } from "@/lib/services-story";
import { t } from "@/lib/content";
import { arabicFontUrl, displayCase } from "@/lib/fonts";
import { isRtl, type Locale } from "@/lib/i18n";
import { beat, clamp, damp, rangeOf, scroll } from "@/lib/scroll";
import { SCENE, STATION_COLORS } from "@/lib/theme";

/**
 * A system building itself, one stage per tier, with the camera climbing it.
 *
 * The page's own copy is "Seven Stages — From Idea to a Working System … clear
 * building, no surprises". That is a story about something being *made*, so the
 * scene makes it: the full seven-tier blueprint stands from the first frame,
 * and each tier turns from drawing into structure as its stage takes the frame.
 * You are always at the frontier — finished, lit structure below you, drawing
 * still to be built above.
 *
 * This replaced a corridor of rings the camera flew through. Flying past seven
 * near-identical gates showed the *count* of the stages and nothing else:
 * stage two and stage six looked the same, and the screen at the end of the
 * page looked like the screen at the start. Nothing was ever built.
 *
 * Motion is ascent, which is also what keeps this page distinct from the other
 * three: home converges, about rotates, contact barely moves.
 */

const SIDES = 6;
const R_TIER = 2.0;
const HUB_R = 0.34;
const SPINE_BASE = -1.1;
const SPINE_TOP = TOP_Y + 1.0;
/** How far off the axis the stage caption sits. */
const CAPTION_OUT = 2.9;

/** The six corners of a tier, in the XZ plane. */
const CORNERS = Array.from({ length: SIDES }, (_, i) => {
  const a = (i / SIDES) * Math.PI * 2 + Math.PI / 6;
  return new THREE.Vector2(Math.cos(a) * R_TIER, Math.sin(a) * R_TIER);
});

/**
 * Each edge as a placed box: midpoint and the turn about Y that aims a box's
 * local +X down the edge. A box's +X maps to (cos, 0, −sin) under a Y rotation,
 * so the angle is atan2(−dz, dx). A regular hexagon means one shared length.
 */
const EDGE_LEN = CORNERS[0].distanceTo(CORNERS[1]);
const EDGES = CORNERS.map((a, i) => {
  const b = CORNERS[(i + 1) % SIDES];
  return {
    mid: [(a.x + b.x) / 2, 0, (a.y + b.y) / 2] as [number, number, number],
    rot: Math.atan2(-(b.y - a.y), b.x - a.x),
  };
});

/** Spokes from the hub collar out to each corner. */
const SPOKE_LEN = R_TIER - HUB_R;
const SPOKES = CORNERS.map((c) => {
  const inner = HUB_R / R_TIER;
  return {
    mid: [(c.x * (1 + inner)) / 2, 0, (c.y * (1 + inner)) / 2] as [
      number,
      number,
      number,
    ],
    rot: Math.atan2(-c.y, c.x),
  };
});

/* Geometry is shared across all seven tiers — the tiers differ by colour and
   build state, never by shape. */
const EDGE_GEO = new THREE.BoxGeometry(EDGE_LEN, 0.055, 0.055);
const SPOKE_GEO = new THREE.BoxGeometry(SPOKE_LEN, 0.03, 0.03);
const MODULE_GEO = new THREE.BoxGeometry(0.26, 0.3, 0.34);
const HUB_GEO = new THREE.TorusGeometry(HUB_R, 0.032, 8, 24);
const SWEEP_GEO = new THREE.TorusGeometry(R_TIER, 0.02, 6, 48);

/**
 * The blueprint: every tier's outline and the columns between them, drawn once
 * as a single lineSegments.
 *
 * It stands complete from the first frame on purpose — "the same sequence on
 * every project, no surprises" is the claim the copy makes, and a plan you can
 * see the whole of before anything is built is what that claim looks like.
 */
const BLUEPRINT = (() => {
  const pts: number[] = [];
  for (let i = 0; i < STAGES.length; i++) {
    const y = tierY(i);
    for (let s = 0; s < SIDES; s++) {
      const a = CORNERS[s];
      const b = CORNERS[(s + 1) % SIDES];
      pts.push(a.x, y, a.y, b.x, y, b.y);
      if (i < STAGES.length - 1) {
        pts.push(a.x, y, a.y, a.x, tierY(i + 1), a.y);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
})();

/**
 * How far tier `i` has been built, 0 → 1.
 *
 * `beat()` latches at 1 and stays there. Everywhere else in this codebase that
 * is the trap that parks a camera forever; here it is exactly right, because a
 * stage that is finished does not un-finish as you scroll past it and the
 * structure below you has to stay standing.
 *
 * The tier finishes before its beat does, so its copy is still on screen while
 * the thing it describes is standing rather than still going up.
 */
function buildOf(p: number, i: number) {
  if (!scroll.measured) return 0;
  const [from, to] = rangeOf(STAGES[i]);
  const span = Math.max(to - from, 1e-4);
  return beat(p, from - span * 0.28, to - span * 0.34);
}

/** Height of the build frontier, in tiers. Drives the tiers and the camera. */
function frontierOf(p: number) {
  let f = 0;
  for (let i = 0; i < STAGES.length; i++) f += buildOf(p, i);
  return f;
}

/**
 * One material per tier per role, module scope rather than `useMemo` — these
 * are mutated every frame, and a memoised value may not be modified after
 * render. Fetched from the table inside the frame loop for the same reason.
 */
const FRAMES = new Map<number, THREE.MeshBasicMaterial>();
const MODULES = new Map<number, THREE.MeshStandardMaterial>();
const SWEEPS = new Map<number, THREE.MeshBasicMaterial>();

/** Structure: flat and emissive, so the rig reads as drawn rather than lit. */
function frameMat(i: number) {
  let m = FRAMES.get(i);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: STATION_COLORS[i],
      transparent: true,
      opacity: 0,
    });
    FRAMES.set(i, m);
  }
  return m;
}

/**
 * Modules are the one part that is *lit* rather than drawn — they are the
 * solid thing the drawing turns into, and a flat basic material made them
 * read as cardboard cutouts pinned to the frame. Emissive stays low for the
 * same reason it does on the about skyline: let it dominate and every face
 * lands on the same value, which is the flatness this is meant to fix.
 */
function moduleMat(i: number) {
  let m = MODULES.get(i);
  if (!m) {
    const c = new THREE.Color(STATION_COLORS[i]);
    m = new THREE.MeshStandardMaterial({
      // Near its own hue rather than a fifth of it: on paper a body at 0.42 of
      // an already-deep colour is nearly black, and the modules read as holes
      // punched in the tier instead of the solid thing the drawing becomes.
      color: c.clone().multiplyScalar(0.94),
      emissive: c,
      emissiveIntensity: SCENE.emissive,
      roughness: 0.45,
      metalness: 0.3,
      transparent: true,
      opacity: 0,
    });
    MODULES.set(i, m);
  }
  return m;
}

/**
 * The completion flash.
 *
 * Not additive, however much it wants to be: additive adds its colour to the
 * paper behind it, which produces nothing at all.
 */
function sweepMat(i: number) {
  let m = SWEEPS.get(i);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: STATION_COLORS[i],
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    SWEEPS.set(i, m);
  }
  return m;
}

/* ------------------------------------------------------------- structure */

/**
 * Shared by the spine and the ground. The colour tracks the stage being built,
 * so the whole rig takes the hue of the work in progress.
 */
const RIG_UNIFORMS = {
  uTime: { value: 0 },
  uShow: { value: 0 },
  /** World height the build has reached: the spine is live below, inert above. */
  uBuilt: { value: 0 },
  uColor: { value: new THREE.Color(STATION_COLORS[0]) },
  /**
   * The colour of spine that has not been built yet.
   *
   * Was a literal near-black in the fragment shader, which reads as "barely
   * there" only against a near-black page. On paper it has to be a pale grey,
   * or the unbuilt section is the single darkest thing in frame — a solid bar
   * running up the middle of the copy column.
   */
  uInert: { value: new THREE.Color("#c9ccdb") },
};

const SPINE_MATERIAL = new THREE.ShaderMaterial({
  uniforms: { ...RIG_UNIFORMS, uBase: { value: SPINE_BASE } },
  transparent: true,
  depthWrite: false,
  vertexShader: /* glsl */ `
    uniform float uBase;
    varying float vY;
    varying vec3 vNrmView;
    varying vec3 vToCam;
    void main() {
      vY = position.y + uBase;
      vNrmView = normalMatrix * normal;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vToCam = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uInert;
    uniform float uTime;
    uniform float uShow;
    uniform float uBuilt;
    varying float vY;
    varying vec3 vNrmView;
    varying vec3 vToCam;

    void main() {
      // Live below the frontier, inert above it — the spine grows with the build
      float live = smoothstep(uBuilt + 0.25, uBuilt - 0.25, vY);

      vec3 col = mix(uInert, uColor * 0.5, live);

      // Data running up the finished section
      float ph = fract(vY * 0.16 - uTime * 0.19);
      col += uColor * smoothstep(0.82, 1.0, ph) * live * 1.7;

      float fres = pow(1.0 - clamp(dot(normalize(vNrmView), normalize(vToCam)), 0.0, 1.0), 2.0);
      col += uColor * fres * live * 0.5;

      // The unbuilt section is barely there — at 0.4 it was a grey bar running
      // up the middle of the frame, which is the one place the copy sits.
      gl_FragColor = vec4(col, uShow * (0.12 + live * 0.88));

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});

const SPINE_GEO = (() => {
  const h = SPINE_TOP - SPINE_BASE;
  const g = new THREE.CylinderGeometry(0.058, 0.058, h, 8, 1, true);
  g.translate(0, h / 2, 0);
  return g;
})();

/**
 * The site the rig stands on. Without a floor the climb has no reference and
 * the tiers merely drift upward; with one, the ground falling away *is* the
 * ascent.
 */
const GROUND_MATERIAL = new THREE.ShaderMaterial({
  uniforms: { ...RIG_UNIFORMS },
  transparent: true,
  depthWrite: false,
  vertexShader: /* glsl */ `
    varying vec2 vGrid;
    void main() {
      // Local XY, before the mesh is laid flat — the plane's own ground coords
      vGrid = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uShow;
    varying vec2 vGrid;

    void main() {
      vec2 c = vGrid * 0.5;
      // Derivative-width lines. A fixed width moirés into noise at the grazing
      // angles this plane is nearly always seen at.
      vec2 d = abs(fract(c) - 0.5) / fwidth(c);
      float line = 1.0 - min(min(d.x, d.y), 1.0);

      // Tight and faint. The camera looks along the ground for most of the
      // climb, so a grid with any reach fills the lower half of the frame and
      // becomes the loudest thing on the page — it is a reference, not scenery.
      float fade = 1.0 - smoothstep(3.0, 15.0, length(vGrid));
      float a = line * fade * 0.16 * uShow;
      if (a < 0.003) discard;

      gl_FragColor = vec4(uColor * 0.55, a);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});

/* ------------------------------------------------------------------ tiers */

function Tier({ index, locale }: { index: number; locale: Locale }) {
  // From the locale, not `scroll.rtl`: that flag is published by an effect, so
  // on the first render — the one that decides this side — it is still stale.
  const flip = isRtl(locale) ? -1 : 1;
  const color = STATION_COLORS[index];
  const y = tierY(index);
  const mods = useRef<(THREE.Group | null)[]>([]);
  const sweep = useRef<THREE.Mesh>(null);
  const caption = useRef<THREE.Group>(null);

  /**
   * The caption stands opposite its own copy column. <StoryOverlay> alternates
   * the text by beat index, and tier `i` is beat `i + 1`, so odd beats put
   * their copy right and even ones left.
   */
  // Mirrored under Arabic: `flex-start` is the right-hand side there, so the
  // whole alternation flips and every caption would land on its own copy.
  const side = (index % 2 === 0 ? -1 : 1) * flip;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const b = buildOf(scroll.progress, index);

    const frame = FRAMES.get(index);
    if (frame) frame.opacity = damp(frame.opacity, b, 4, dt);
    const mod = MODULES.get(index);
    if (mod) mod.opacity = damp(mod.opacity, b, 4, dt);

    // The tier assembles piece by piece rather than fading in as a unit — six
    // modules landing in sequence is what reads as construction.
    for (let j = 0; j < mods.current.length; j++) {
      const g = mods.current[j];
      if (!g) continue;
      g.scale.setScalar(Math.max(clamp((b - j * 0.075) / 0.5), 0.001));
    }

    // A ring that expands past the tier and fades through the middle of the
    // build: the stage completing, rather than a state you happen to scroll
    // past. Additive, so it passes over the structure as light.
    const flash = b * (1 - b) * 4;
    if (sweep.current) sweep.current.scale.setScalar(0.8 + b * 0.62);
    const sw = SWEEPS.get(index);
    if (sw) sw.opacity = flash * 0.85;

    // Caption offset along the camera's own right. The tier carries no
    // rotation of its own, so the camera's world right is already the right
    // direction here — no change of basis needed.
    const c = caption.current;
    if (c) {
      const m = state.camera.matrixWorld.elements;
      const rx = m[0];
      const rz = m[2];
      const len = Math.hypot(rx, rz) || 1;
      c.position.set((rx / len) * CAPTION_OUT * side, 0.1, (rz / len) * CAPTION_OUT * side);
      // Gone by the close: that beat is centred copy with pills and buttons,
      // and seven captions ringing the rig land straight on top of it.
      const [closeFrom] = rangeOf("close");
      const vis = b * (1 - beat(scroll.progress, closeFrom - 0.04, closeFrom + 0.03));
      c.scale.setScalar(damp(c.scale.x, Math.max(vis, 0.001), 4, dt));
    }
  });

  return (
    <group position={[0, y, 0]}>
      {EDGES.map((e, i) => (
        <mesh
          key={`e${i}`}
          geometry={EDGE_GEO}
          material={frameMat(index)}
          position={e.mid}
          rotation={[0, e.rot, 0]}
        />
      ))}

      {SPOKES.map((s, i) => (
        <mesh
          key={`s${i}`}
          geometry={SPOKE_GEO}
          material={frameMat(index)}
          position={s.mid}
          rotation={[0, s.rot, 0]}
        />
      ))}

      {/* Hub collar where the spine passes through the deck */}
      <mesh geometry={HUB_GEO} material={frameMat(index)} rotation={[-Math.PI / 2, 0, 0]} />

      {CORNERS.map((c, i) => (
        <group
          key={`m${i}`}
          position={[c.x, 0.16, c.y]}
          rotation={[0, Math.atan2(-c.y, c.x), 0]}
          scale={0.001}
          ref={(el) => {
            mods.current[i] = el;
          }}
        >
          <mesh geometry={MODULE_GEO} material={moduleMat(index)} />
        </group>
      ))}

      <mesh
        ref={sweep}
        geometry={SWEEP_GEO}
        material={sweepMat(index)}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      <group ref={caption} scale={0.001}>
        <Billboard>
          {/* The big ghost numeral. It is meant to sit just above the ground
              — which means it has to move with the ground, not stay slate. */}
          <Text
            fontSize={0.66}
            color={SCENE.muted}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.02}
          >
            {String(index + 1).padStart(2, "0")}
          </Text>
          <Text
            position={[0, -0.46, 0]}
            fontSize={0.15}
            color={color}
            anchorX="center"
            anchorY="middle"
            font={arabicFontUrl(locale)}
            // 0.16 is wide even for Latin caps; for Arabic it would pull the
            // cursive joins apart entirely.
            letterSpacing={locale === "ar" ? 0 : 0.16}
            outlineWidth={0.008}
            outlineColor={SCENE.outline}
          >
            {displayCase(t(locale, `home.process.${STAGES[index]}.title`), locale)}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- rig */

function Scaffold({ reduced }: { reduced: boolean }) {
  const blueprint = useRef<THREE.LineBasicMaterial>(null);
  const accent = useRef(new THREE.Color(STATION_COLORS[0]));
  const target = useRef(new THREE.Color());

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const front = frontierOf(p);

    // Everything on the rig takes the hue of the stage being built
    const stage = Math.min(STAGES.length - 1, Math.floor(front));
    target.current.set(STATION_COLORS[stage]);
    accent.current.lerp(target.current, 1 - Math.exp(-2.5 * dt));
    RIG_UNIFORMS.uColor.value.copy(accent.current);

    RIG_UNIFORMS.uBuilt.value = damp(
      RIG_UNIFORMS.uBuilt.value,
      (front - 0.5) * TIER_GAP,
      3.5,
      dt,
    );
    // The plan is up from the first frame, not faded in over the cold open.
    // Gating it on scroll left the hero completely black, which threw away the
    // one image that makes the whole page's argument: the shape of the finished
    // thing, drawn, before any of it exists. The damp from zero is the entrance.
    RIG_UNIFORMS.uShow.value = damp(RIG_UNIFORMS.uShow.value, 1, 2.2, dt);
    if (!reduced) RIG_UNIFORMS.uTime.value = state.clock.elapsedTime;

    if (blueprint.current) {
      blueprint.current.opacity = damp(
        blueprint.current.opacity,
        RIG_UNIFORMS.uShow.value * 0.2,
        3,
        dt,
      );
    }
  });

  return (
    <>
      <lineSegments geometry={BLUEPRINT} frustumCulled={false}>
        <lineBasicMaterial
          ref={blueprint}
          color={SCENE.draft}
          transparent
          opacity={0}
        />
      </lineSegments>

      <mesh geometry={SPINE_GEO} material={SPINE_MATERIAL} position={[0, SPINE_BASE, 0]} />

      <mesh material={GROUND_MATERIAL} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <planeGeometry args={[56, 56]} />
      </mesh>
    </>
  );
}

/** Camera: climbs the build, holding the tier currently going up in frame. */
function BuildRig({ reduced }: { reduced: boolean }) {
  const pointer = useRef({ x: 0, y: 0 });
  const look = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { camera } = state;
    const p = scroll.progress;

    const front = frontierOf(p);
    const [closeFrom] = rangeOf("close");
    const close = beat(p, closeFrom - 0.03, 1);

    // Half a tier below the frontier puts the tier currently going up in the
    // middle of the frame. The close pulls out to the whole finished rig.
    const focusY = THREE.MathUtils.lerp((front - 0.5) * TIER_GAP, TOP_Y * 0.5, close);
    // Far enough at the close to hold all seven tiers at once — the finished
    // rig is the payoff of the page and a cropped one is just more structure.
    const radius = THREE.MathUtils.lerp(6.9, 14.5, close);
    const lift = THREE.MathUtils.lerp(1.1, 1.3, close);

    // Roughly a fifth of a turn per tier: enough to read the structure as a
    // solid rather than a flat elevation, slow enough not to be a carousel.
    const a = 0.7 + front * 0.34 + close * 0.45;

    let x = Math.cos(a) * radius;
    let cy = focusY + lift;
    const z = Math.sin(a) * radius;

    if (!reduced) {
      pointer.current.x = damp(pointer.current.x, state.pointer.x, 2.2, dt);
      pointer.current.y = damp(pointer.current.y, state.pointer.y, 2.2, dt);
      x += pointer.current.x * 0.5;
      cy += pointer.current.y * 0.4;
    }

    camera.position.x = damp(camera.position.x, x, 2.6, dt);
    camera.position.z = damp(camera.position.z, z, 2.6, dt);
    // Faster on Y: the sense of climbing depends on this tracking scroll closely
    camera.position.y = damp(camera.position.y, cy, 3.6, dt);

    /**
     * At the close the copy is centred and dense — headline, six pills, two
     * buttons — so the rig steps out of the middle rather than standing behind
     * it. Aiming left of the axis is what puts the axis right of frame.
     *
     * The camera's own right vector isn't available yet (lookAt hasn't run),
     * but on a circle it is knowable: looking inward from angle `a`, right is
     * (sin a, 0, −cos a).
     */
    const shift = close * 6.6;
    look.current.set(-Math.sin(a) * shift, focusY, Math.cos(a) * shift);
    camera.lookAt(look.current);
  });

  return null;
}

export function ServicesScene({ reduced, locale }: SceneEnv) {
  return (
    <>
      {/* The modules are the only lit thing here; everything else is emissive.
          A key from above-right is what gives their faces different values —
          but paper reflects, so the fill sits high and the key stays modest
          rather than blowing the tops out. */}
      <ambientLight intensity={0.95} />
      <directionalLight position={[5, 9, 6]} intensity={1.2} />

      <Scaffold reduced={reduced} />
      {STAGES.map((_, i) => (
        <Tier key={i} index={i} locale={locale} />
      ))}

      <BuildRig reduced={reduced} />
    </>
  );
}
