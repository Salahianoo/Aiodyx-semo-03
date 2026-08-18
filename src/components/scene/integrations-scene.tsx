"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import type { SceneEnv } from "@/components/story-page";
import {
  AUTHORITIES,
  HUB_X,
  LANE_END,
  authorityName,
  authoritySubject,
  gateX,
} from "@/lib/integrations-story";
import { arabicFontUrl, displayCase } from "@/lib/fonts";
import type { Locale } from "@/lib/i18n";
import { isRtl } from "@/lib/i18n";
import { beat, clamp, damp, owns, rangeOf, scroll } from "@/lib/scroll";
import { ACCENT, PEAK, SCENE } from "@/lib/theme";

/**
 * A clearing lane: your system at one end, three national platforms down it,
 * and documents crossing between them.
 *
 * The page is about things *leaving* a system and coming back approved, so the
 * scene is the only one here with two places in it. Home has one field that
 * becomes everything; services builds a single rig; about turns one globe.
 * This has a near side and a far side, and the whole subject is the traffic in
 * between — which is why the camera tracks sideways along the lane rather than
 * flying into it: travelling *down* a channel puts the viewer inside the pipe,
 * and you cannot see a handshake from inside the wire.
 *
 * Nothing here depicts the authorities' own marks. Those are trademarks with
 * their own usage rules, and a logo rebuilt as a point cloud is a redrawing of
 * it — the gates carry the names as text, which is what a statement of
 * integration actually needs.
 */

const GATE_R = 1.62;
const LANE_Y = 0;

/* ------------------------------------------------------------------ lane */

/**
 * The conduit, as a dashed run of ticks rather than a solid tube.
 *
 * A continuous line reads as a pipe that is simply *there*; a run of marks
 * reads as a channel with traffic on it, and it gives the pulses something to
 * travel against so movement is visible even when the camera is still.
 */
const LANE_TICKS = (() => {
  const pts: number[] = [];
  const step = 0.34;
  for (let x = HUB_X; x <= LANE_END; x += step) {
    pts.push(x, LANE_Y, 0, x + step * 0.42, LANE_Y, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
})();

/* ------------------------------------------------------------- documents */

const DOC_COUNT = 34;
const DOC_GEO = new THREE.PlaneGeometry(0.3, 0.4);

/**
 * Two passes of the same lane: what you send, and what comes back.
 *
 * Split into two meshes rather than recolouring one, because the colour is the
 * whole point — outbound is a draft in your own system, inbound is the same
 * document with an authority's mark on it. One mesh would mean writing an
 * instance colour buffer every frame to say something that never changes per
 * document.
 */
const OUT_MATERIAL = new THREE.MeshBasicMaterial({
  color: SCENE.muted,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0,
});

const BACK_MATERIAL = new THREE.MeshBasicMaterial({
  color: ACCENT,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0,
});

/** Deterministic lane offsets — the bundle must look the same every load. */
function laneOffsets(count: number, seed: number) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    y: (rand() - 0.5) * 1.5,
    z: (rand() - 0.5) * 1.5,
    phase: rand(),
    spin: (rand() - 0.5) * 0.7,
  }));
}

function Documents({
  reduced,
  reach,
  back,
}: {
  reduced: boolean;
  reach: React.RefObject<number>;
  back: React.RefObject<THREE.Color>;
}) {
  const out = useRef<THREE.InstancedMesh>(null);
  const ret = useRef<THREE.InstancedMesh>(null);
  const outSeeds = useMemo(() => laneOffsets(DOC_COUNT, 0x51de), []);
  const retSeeds = useMemo(() => laneOffsets(DOC_COUNT, 0x9a12), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = reduced ? 0.35 : state.clock.elapsedTime;
    const live = reach.current ?? 0;

    // How far down the lane traffic is allowed to be seen. Documents only
    // exist as far as the connection has been made in the story.
    const far = HUB_X + (LANE_END - HUB_X) * clamp(live, 0, 1);

    for (const [mesh, seeds, dir] of [
      [out.current, outSeeds, 1],
      [ret.current, retSeeds, -1],
    ] as const) {
      if (!mesh) continue;
      for (let i = 0; i < DOC_COUNT; i++) {
        const s = seeds[i];
        let p = (s.phase + time * 0.075) % 1;
        if (dir < 0) p = 1 - p;
        const x = HUB_X + (LANE_END - HUB_X) * p;

        // Fade a document out as it passes the point the story has reached,
        // rather than clipping it: a hard edge in mid-air reads as a bug.
        const room = clamp((far - x) / 2.2, 0, 1);
        pos.set(x, LANE_Y + s.y, s.z);
        scl.setScalar(room * (0.85 + 0.15 * Math.sin(time * 2 + i)));
        q.setFromAxisAngle(UP, s.spin + time * (reduced ? 0 : 0.25) * dir);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    const shown = clamp(live * 1.4, 0, 1);
    OUT_MATERIAL.opacity = damp(OUT_MATERIAL.opacity, shown * 0.55, 3, dt);
    BACK_MATERIAL.opacity = damp(BACK_MATERIAL.opacity, shown * 0.85, 3, dt);
    if (back.current) BACK_MATERIAL.color.copy(back.current);
  });

  return (
    <>
      <instancedMesh
        ref={out}
        args={[DOC_GEO, OUT_MATERIAL, DOC_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={ret}
        args={[DOC_GEO, BACK_MATERIAL, DOC_COUNT]}
        frustumCulled={false}
      />
    </>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------------ gate */

/**
 * One authority: a ring standing across the lane, with its name on it.
 *
 * The ring is open in the middle on purpose. A gate you can see through is a
 * checkpoint; a disc would be a wall, which is the opposite of what an
 * integration does.
 */
function Gate({
  index,
  locale,
  reduced,
}: {
  index: number;
  locale: Locale;
  reduced: boolean;
}) {
  const a = AUTHORITIES[index];
  const x = gateX(index);

  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const label = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const [from] = rangeOf(a.id);

    // Built once you arrive and standing from then on — a connection that is
    // made does not come apart because you scrolled past it.
    const built = beat(p, from - 0.05, from + 0.03);
    const active = owns(p, a.id, 0.3);

    if (ringMat.current) {
      ringMat.current.opacity = damp(
        ringMat.current.opacity,
        built * (0.42 + active * 0.58),
        4,
        dt,
      );
    }
    if (ring.current) {
      const s = 0.55 + built * 0.45;
      ring.current.scale.setScalar(damp(ring.current.scale.x, s, 3.5, dt));
      // In-plane: a seal turning. On any other axis it tumbles edge-on again.
      if (!reduced) ring.current.rotation.z = state.clock.elapsedTime * 0.12;
    }

    // A slow breath while the gate holds the frame, so a beat you dwell on is
    // not a photograph.
    if (haloMat.current) {
      const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.1);
      haloMat.current.opacity = damp(
        haloMat.current.opacity,
        active * (0.06 + pulse * 0.06),
        3,
        dt,
      );
    }
    if (halo.current) {
      halo.current.scale.setScalar(damp(halo.current.scale.x, 1 + active * 0.22, 3, dt));
    }

    if (label.current) {
      /* Gone by the pull-back. Each name has had a full beat to itself by
         then, and at that width the lane runs the whole frame — three sets of
         labels land inside whatever the closing copy is saying. The rings
         alone carry the memory. */
      const [moreFrom] = rangeOf("more");
      const wide = beat(p, moreFrom - 0.05, moreFrom + 0.04);
      const s = Math.max(built * (0.72 + active * 0.28) * (1 - wide), 0.001);
      label.current.scale.setScalar(damp(label.current.scale.x, s, 4, dt));
    }
  });

  return (
    <group position={[x, LANE_Y, 0]}>
      {/* Left in the XY plane, facing the camera.

          It was first turned a quarter about Y so it stood *across* the lane,
          facing the oncoming traffic — which is right in plan and useless on
          screen: the camera watches this lane side-on, so a gate square to the
          traffic is seen edge-on and reads as a bar. A ring you can see
          through only reads as a gate when it is facing you. */}
      <mesh ref={ring} scale={0.001}>
        <torusGeometry args={[GATE_R, 0.055, 10, 72]} />
        <meshBasicMaterial ref={ringMat} color={a.color} transparent opacity={0} />
      </mesh>

      <mesh ref={halo}>
        <circleGeometry args={[GATE_R * 0.97, 48]} />
        <meshBasicMaterial ref={haloMat} color={a.color} transparent opacity={0} />
      </mesh>

      <group ref={label} scale={0.001}>
        <Billboard position={[0, GATE_R + 0.72, 0]}>
          <Text
            fontSize={0.46}
            color={a.color}
            anchorX="center"
            anchorY="middle"
            font={arabicFontUrl(locale)}
            letterSpacing={locale === "ar" ? 0 : 0.06}
            outlineWidth={0.012}
            outlineColor={SCENE.outline}
          >
            {displayCase(authorityName(locale, a.id), locale)}
          </Text>
          <Text
            position={[0, -0.44, 0]}
            fontSize={0.2}
            color={SCENE.base}
            anchorX="center"
            anchorY="middle"
            font={arabicFontUrl(locale)}
            letterSpacing={locale === "ar" ? 0 : 0.08}
            outlineWidth={0.008}
            outlineColor={SCENE.outline}
          >
            {displayCase(authoritySubject(locale, a.id), locale)}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- hub */

/** Your system. One object, at the near end, where every document starts. */
function Hub({ reduced, locale }: { reduced: boolean; locale: Locale }) {
  const core = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const label = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const [firstGate] = rangeOf(AUTHORITIES[0].id);

    /* Up from the first frame, not faded in over the opening beat.
       Gating this on scroll made the hero render empty — the top of the page
       cannot scroll above zero, so `beat(p, 0, introTo)` is exactly 0 there.
       The damp from zero is the entrance. Services learned the same thing. */
    const shown = 1;

    /* The hub stays — every document on the lane starts here — but it stops
       competing once the tour begins. At the first gate the camera is only a
       few units down the lane, so the hub is still in frame and lands right
       under the copy column. */
    const stepped = beat(p, firstGate - 0.08, firstGate + 0.02);
    const quiet = 1 - stepped * 0.62;

    if (mat.current) {
      mat.current.opacity = damp(mat.current.opacity, shown * 0.75 * quiet, 3, dt);
    }
    if (core.current) {
      core.current.scale.setScalar(damp(core.current.scale.x, Math.max(shown, 0.001), 3, dt));
      if (!reduced) core.current.rotation.y = state.clock.elapsedTime * 0.22;
    }
    if (label.current) {
      // The label goes entirely: a dim ring behind a headline is texture, but
      // dim *words* behind a headline are just two things to read at once.
      const vis = shown * (1 - stepped);
      label.current.scale.setScalar(damp(label.current.scale.x, Math.max(vis, 0.001), 4, dt));
    }
  });

  return (
    <group position={[HUB_X, LANE_Y, 0]}>
      <mesh ref={core} scale={0.001}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshBasicMaterial ref={mat} color={SCENE.draft} transparent opacity={0} wireframe />
      </mesh>
      <group ref={label} scale={0.001}>
        <Billboard position={[0, 1.85, 0]}>
          <Text
            fontSize={0.34}
            color={SCENE.base}
            anchorX="center"
            anchorY="middle"
            font={arabicFontUrl(locale)}
            letterSpacing={locale === "ar" ? 0 : 0.1}
            outlineWidth={0.01}
            outlineColor={SCENE.outline}
          >
            {displayCase("Odoo ERP", locale)}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- rig */

/**
 * Camera: tracks sideways down the lane, then pulls back to show it whole.
 *
 * Kept square to the lane — no yaw at all — so world X is screen X. That is
 * what lets the gate be parked opposite its own copy column by moving the
 * camera alone: with the camera turned, the same offset would swing the whole
 * lane through the frame instead of sliding it.
 */
function LaneRig({ reduced, locale }: { reduced: boolean; locale: Locale }) {
  /* From the locale, not `scroll.rtl`: that flag is published by an effect, so
     on the first render — the one that decides this side — it is still stale.
     Same reason the services tier captions read it this way. */
  const flip = isRtl(locale) ? -1 : 1;
  const pointer = useRef({ x: 0, y: 0 });
  const look = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { camera } = state;
    const p = scroll.progress;

    const [whyFrom] = rangeOf("why");
    const [howFrom] = rangeOf("how");
    const [moreFrom] = rangeOf("more");
    const last = AUTHORITIES.length - 1;

    // Which gate owns the frame, and how strongly.
    let focus = -1;
    let amt = 0;
    for (let i = 0; i < AUTHORITIES.length; i++) {
      const o = owns(p, AUTHORITIES[i].id, 0.3);
      if (o > amt) {
        amt = o;
        focus = i;
      }
    }

    /**
     * The pull-back happens at `more`, not at `how`.
     *
     * `how` carries four cards over half the frame, and the lane is twenty-six
     * units long — at any distance that fits all three gates, two of them land
     * squarely behind those cards. `more` and `close` are a headline and a
     * paragraph, which the whole lane can sit under.
     */
    const wide = beat(p, moreFrom - 0.05, moreFrom + 0.04);
    /** Past the gates but not yet pulled back: `how` holds the last one. */
    const tail = beat(p, howFrom - 0.05, howFrom + 0.03);

    /* Target X walks the lane: the hub at the open, each gate in turn, the
       last gate held through `how`, then the midpoint once it pulls back. */
    let targetX = HUB_X + 1.4;
    if (focus >= 0) targetX = gateX(focus);
    else if (tail > 0.01) targetX = gateX(last);
    else if (p > whyFrom) targetX = HUB_X + 2.6;
    targetX = THREE.MathUtils.lerp(targetX, (HUB_X + LANE_END) / 2, wide);

    /**
     * Park the lane opposite its copy column. <StoryOverlay> alternates by
     * beat index: the gates are beats 2, 3 and 4, so even-indexed gates have
     * their copy on the left and want the lane pushed right. `how` is beat 5,
     * odd, so it wants the opposite — hence the explicit +1 rather than
     * falling through to the gate rule with no gate in focus.
     */
    /* `flex-start` is the right-hand side under RTL, so the whole alternation
       mirrors in Arabic — without this the gate is pushed to the same side the
       copy just moved to and the two land on top of each other. */
    const side = (focus >= 0 ? (focus % 2 === 0 ? -1 : 1) : 1) * flip;
    const push = Math.max(amt, tail);
    targetX += side * push * (1 - wide) * 2.1;

    const dist = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(11.5, 8.6, push),
      26,
      wide,
    );
    const high = THREE.MathUtils.lerp(1.1, 2.2, wide);

    let cx = targetX;
    let cy = high;
    if (!reduced) {
      pointer.current.x = damp(pointer.current.x, state.pointer.x, 2.2, dt);
      pointer.current.y = damp(pointer.current.y, state.pointer.y, 2.2, dt);
      cx += pointer.current.x * 0.5;
      cy += pointer.current.y * 0.35;
    }

    camera.position.x = damp(camera.position.x, cx, 2.4, dt);
    camera.position.y = damp(camera.position.y, cy, 2.4, dt);
    camera.position.z = damp(camera.position.z, dist, 2.4, dt);

    // Square to the lane: look straight down -Z from wherever we are.
    // Raising the look point drops the lane in frame — at the pull-back that
    // is what keeps three gates and their labels clear of the closing copy.
    look.current.set(camera.position.x, LANE_Y + high * 0.25 + wide * 4.3, 0);
    camera.lookAt(look.current);
  });

  return null;
}

/* ----------------------------------------------------------------- scene */

export function IntegrationsScene({ reduced, locale }: SceneEnv) {
  const laneMat = useRef<THREE.LineBasicMaterial>(null);
  /** How much of the lane the story has opened, 0 → 1. Shared with the docs. */
  const reach = useRef(0);
  /** The colour returning documents carry — the active authority's. */
  const back = useRef(new THREE.Color(ACCENT));
  const target = useRef(new THREE.Color());

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;

    // One gate's worth of lane per authority reached, latching as it goes:
    // `beat()` clamps and stays, which is what a made connection should do.
    let made = 0;
    for (const a of AUTHORITIES) {
      const [from] = rangeOf(a.id);
      made += beat(p, from - 0.05, from + 0.03);
    }
    const [whyFrom] = rangeOf("why");
    /* Floored: the channel is there before anything runs down it, which is
       what tells the visitor at the top of the page where this is going. */
    const opened = Math.max(
      0.1,
      beat(p, whyFrom, whyFrom + 0.04) * 0.34,
      made / AUTHORITIES.length,
    );
    reach.current = damp(reach.current, opened, 3, dt);

    let focus = -1;
    let amt = 0;
    for (let i = 0; i < AUTHORITIES.length; i++) {
      const o = owns(p, AUTHORITIES[i].id, 0.3);
      if (o > amt) {
        amt = o;
        focus = i;
      }
    }
    target.current.set(focus >= 0 ? AUTHORITIES[focus].color : PEAK);
    back.current.lerp(target.current, 1 - Math.exp(-2.5 * dt));

    if (laneMat.current) {
      laneMat.current.opacity = damp(laneMat.current.opacity, reach.current * 0.5, 3, dt);
    }
  });

  return (
    <>
      <lineSegments geometry={LANE_TICKS} frustumCulled={false}>
        <lineBasicMaterial ref={laneMat} color={SCENE.muted} transparent opacity={0} />
      </lineSegments>

      <Hub reduced={reduced} locale={locale} />
      <Documents reduced={reduced} reach={reach} back={back} />
      {AUTHORITIES.map((a, i) => (
        <Gate key={a.id} index={i} locale={locale} reduced={reduced} />
      ))}

      <LaneRig reduced={reduced} locale={locale} />
    </>
  );
}
