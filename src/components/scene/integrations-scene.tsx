"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import type { SceneEnv } from "@/components/story-page";
import {
  AUTHORITIES,
  FIELD_MID_Y,
  RING_RX,
  HUB_MID_Y,
  authorityName,
  authorityPos,
  authoritySubject,
} from "@/lib/integrations-story";
import {
  BRAND_NAVY,
  WORDMARK_LETTER_PATHS,
  WORDMARK_MONOGRAM_PATHS,
  WORDMARK_VIEWBOX,
} from "@/components/brand";
import { AUTHORITY_MARKS, type AuthorityMark } from "@/lib/authority-marks";
import { MARK_BOX_H, MARK_BOX_W, MARK_DOT, buildMark } from "@/lib/mark-cloud";
import {
  ODOO_ACCENT_PATHS,
  ODOO_MAGENTA,
  ODOO_NEUTRAL,
  ODOO_PLAIN_PATHS,
  ODOO_VIEWBOX,
} from "@/lib/odoo-mark";
import { arabicFontUrl, displayCase } from "@/lib/fonts";
import type { Locale } from "@/lib/i18n";
import { isRtl } from "@/lib/i18n";
import { beat, clamp, damp, owns, rangeOf, scroll } from "@/lib/scroll";
import { SCENE } from "@/lib/theme";

/**
 * A hub and three spokes: your own system at the centre, the three national
 * platforms standing around it, and documents crossing between them.
 *
 * It was a lane before — hub at one end, platforms strung out along it — which
 * drew the right traffic and the wrong shape. A queue says the platforms come
 * one after another and that the last one is furthest away, and neither is
 * true: a company files with all three, from one system, in the same month.
 * Around the hub they are what they are — three directions out of one place,
 * none of them further than the others.
 *
 * The camera never yaws. It pans across the plane the ring is drawn in and
 * dollies, so world X stays screen X and a platform can be parked opposite its
 * own copy column by moving the camera alone.
 *
 * Each gate carries the authority's own mark, drawn as points. See
 * `authority-marks.ts` for why the logo rather than the name in type.
 */

const GATE_R = 1.62;

/**
 * How much the whole field steps back at the closing beat.
 *
 * `close` is the only beat besides the hero with *centred* copy: a headline,
 * a line of body and two buttons, straight down the middle. Every other beat
 * has a side, so the camera can park the picture opposite it; this one has
 * none, and the ring is symmetric enough that shoving it either way just picks
 * a different half to sit on.
 *
 * So it stops competing instead. The constellation stays whole and centred —
 * which is the right last image, the system the page just built — and drops to
 * a watermark behind the ask.
 */
const hush = (p: number) => 1 - owns(p, "close", 0.3) * 0.72;

/**
 * The air between a mark and its caption.
 *
 * The caption hangs off the mark's own underside rather than sitting on a line
 * of its own, so the two read as one lockup. On a shared line instead they sat
 * neatly level with each other and belonged to nothing — and around a ring
 * there is no shared line to sit on.
 */
const CAPTION_GAP = 0.42;


/**
 * Our own end of the lane, described the same way the authorities are.
 *
 * The hub was a wireframe icosahedron — an abstraction standing where three
 * real logos stand, which made the near end of the lane the one place the page
 * did not say who it meant. It is the AIODYX mark now, split the way the SVG
 * colours it: navy monogram, ink letters.
 */
const AIODYX_MARK: AuthorityMark = {
  viewBox: WORDMARK_VIEWBOX,
  emblem: WORDMARK_MONOGRAM_PATHS,
  word: WORDMARK_LETTER_PATHS,
  gradient: [BRAND_NAVY],
  wordColor: SCENE.base,
};

/**
 * And the system it is all built on, under our own name.
 *
 * "Odoo ERP" was set in type here. Every other party in this scene is present
 * as its own mark, and the one at the centre — the system the whole page is
 * about connecting — was the only one spelled out. Split the way its file
 * colours it: the leading "o" magenta, "doo" neutral.
 */
const ODOO_MARK: AuthorityMark = {
  viewBox: ODOO_VIEWBOX,
  emblem: ODOO_ACCENT_PATHS,
  word: ODOO_PLAIN_PATHS,
  gradient: [ODOO_MAGENTA],
  wordColor: ODOO_NEUTRAL,
};

/**
 * How much smaller Odoo sits than the name above it.
 *
 * Both are wide wordmarks, so contain-fit gives them the same width and the
 * lockup reads as two brands of equal billing. This is our page; the platform
 * is the subtitle.
 */
const ODOO_SCALE = 0.62;

/** The air between the two marks of the hub's lockup. */
const HUB_STACK_GAP = 0.34;



/* ---------------------------------------------------------------- spokes */

/** Hub end, gate end and length of one spoke, in the ring's own plane. */
type Spoke = {
  from: [number, number];
  to: [number, number];
  /** Unit vector, hub → platform. */
  dir: [number, number];
  len: number;
};

/**
 * How far a lockup reaches in a given direction, as an ellipse through its
 * corners, plus air.
 *
 * A single number cannot do this. The lockups are much wider than they are
 * tall, so the clearance a spoke needs leaving the hub sideways is more than
 * twice what it needs leaving straight up — and one figure big enough for the
 * wide case swallowed the vertical spoke whole. Fitted per direction, every
 * spoke starts and ends the same distance clear of the artwork.
 */
const AIR = 0.45;
const reach = (dx: number, dy: number, halfW: number, halfH: number) =>
  1 / Math.hypot(dx / halfW, dy / halfH) + AIR;

/** Half-height of the hub's two-mark stack, measured in `Hub`. */
const HUB_HALF_H = 1.35;
/**
 * A platform's half-height for clearance: the mark's box plus the caption
 * hanging under it, since a spoke arriving from below meets the caption first.
 */
const GATE_HALF_H = MARK_BOX_H / 2 + CAPTION_GAP + 0.16;

/**
 * The three runs out of the hub, each stopping short at both ends.
 *
 * Drawn from the edge of the lockup rather than its centre, and stopping
 * before the mark it arrives at: a line that touches a logo reads as an arrow
 * pointing at it, and these are channels, not annotations.
 */
const SPOKES: Spoke[] = AUTHORITIES.map((_, i) => {
  const [gx, gy] = authorityPos(i);
  const dy = gy - HUB_MID_Y;
  const mag = Math.hypot(gx, dy) || 1;
  const dir: [number, number] = [gx / mag, dy / mag];
  const hubClear = reach(dir[0], dir[1], MARK_BOX_W / 2, HUB_HALF_H);
  const gateClear = reach(dir[0], dir[1], MARK_BOX_W / 2, GATE_HALF_H);
  const len = Math.max(mag - hubClear - gateClear, 0);
  return {
    from: [dir[0] * hubClear, HUB_MID_Y + dir[1] * hubClear],
    to: [dir[0] * (hubClear + len), HUB_MID_Y + dir[1] * (hubClear + len)],
    dir,
    len,
  };
});

/**
 * One spoke as a dashed run rather than a solid line.
 *
 * A continuous line reads as a pipe that is simply *there*; a run of marks
 * reads as a channel with traffic on it, and it gives the documents something
 * to travel against so movement is visible even when the camera is still.
 */
function spokeTicks(sp: Spoke) {
  const pts: number[] = [];
  const step = 0.34;
  for (let d = 0; d <= sp.len; d += step) {
    const b = Math.min(d + step * 0.42, sp.len);
    pts.push(
      sp.from[0] + sp.dir[0] * d,
      sp.from[1] + sp.dir[1] * d,
      0,
      sp.from[0] + sp.dir[0] * b,
      sp.from[1] + sp.dir[1] * b,
      0,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

const SPOKE_TICKS = SPOKES.map(spokeTicks);

/* ------------------------------------------------------------- documents */

/** Per spoke, per direction. Three spokes and two directions make 72 planes. */
const DOC_PER_SPOKE = 12;
const DOC_GEO = new THREE.PlaneGeometry(0.3, 0.4);

/**
 * Two passes of every spoke: what you send, and what comes back.
 *
 * Split into two meshes rather than recolouring one, because the colour is the
 * whole point — outbound is a draft in your own system, inbound is the same
 * document with a platform's mark on it. Outbound is one flat grey for all
 * three; inbound is the colour of the platform it is returning from, written
 * once into the instance colours rather than lerped every frame the way it had
 * to be when a single lane carried all three in turn.
 */
const OUT_MATERIAL = new THREE.MeshBasicMaterial({
  color: SCENE.muted,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0,
});

const BACK_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#ffffff",
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0,
});

/** Deterministic per-document offsets — the bundle must look the same every load. */
function docSeeds(count: number, seed: number) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    /** Across the spoke, and out of its plane. */
    across: (rand() - 0.5) * 0.68,
    z: (rand() - 0.5) * 1.3,
    phase: rand(),
    spin: (rand() - 0.5) * 0.7,
  }));
}

const DOC_COUNT = DOC_PER_SPOKE * AUTHORITIES.length;

function Documents({ reduced, reach }: { reduced: boolean; reach: React.RefObject<number[]> }) {
  const out = useRef<THREE.InstancedMesh>(null);
  const ret = useRef<THREE.InstancedMesh>(null);
  const outSeeds = useMemo(() => docSeeds(DOC_COUNT, 0x51de), []);
  const retSeeds = useMemo(() => docSeeds(DOC_COUNT, 0x9a12), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);

  /* Written once. Which platform stamped a document never changes, so the
     colour is a property of the instance, not of the frame. */
  useEffect(() => {
    const mesh = ret.current;
    if (!mesh) return;
    const c = new THREE.Color();
    for (let i = 0; i < DOC_COUNT; i++) {
      c.set(AUTHORITIES[Math.floor(i / DOC_PER_SPOKE)].color);
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = reduced ? 0.35 : state.clock.elapsedTime;
    const live = reach.current ?? [];

    for (const [mesh, seeds, dir] of [
      [out.current, outSeeds, 1],
      [ret.current, retSeeds, -1],
    ] as const) {
      if (!mesh) continue;
      for (let i = 0; i < DOC_COUNT; i++) {
        const lane = Math.floor(i / DOC_PER_SPOKE);
        const sp = SPOKES[lane];
        const s = seeds[i];
        let p = (s.phase + time * 0.075) % 1;
        if (dir < 0) p = 1 - p;
        const d = p * sp.len;

        /* Two separate things, and the lane version conflated them.
           A moving frontier was right when the story walked *down* a lane —
           traffic only existed as far as the page had got. A spoke is either
           connected or it is not, so how far the story has come belongs to the
           whole run at once, and it left every document shrinking to nothing
           before it ever reached the platform it was addressed to.

           The taper is the other thing: a small fade at each end, so nothing
           pops into being against a lockup. */
        const open = clamp(live[lane] ?? 0, 0, 1);
        const edge = clamp(Math.min(d, sp.len - d) / 0.55, 0, 1);
        const room = edge * clamp(open * 1.6 - 0.25, 0, 1);

        // Offset across the spoke, not along Y: on a spoke running diagonally
        // a vertical spread would splay the bundle instead of widening it.
        pos.set(
          sp.from[0] + sp.dir[0] * d - sp.dir[1] * s.across,
          sp.from[1] + sp.dir[1] * d + sp.dir[0] * s.across,
          s.z,
        );
        scl.setScalar(room * (0.85 + 0.15 * Math.sin(time * 2 + i)));
        q.setFromAxisAngle(UP, s.spin + time * (reduced ? 0 : 0.25) * dir);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    /* The busiest spoke sets the opacity. Per-instance fading is what `room`
       already does; this is only the field arriving at all. */
    const shown = clamp(Math.max(0, ...live) * 1.4, 0, 1);
    OUT_MATERIAL.opacity = damp(OUT_MATERIAL.opacity, shown * 0.55, 3, dt);
    BACK_MATERIAL.opacity = damp(BACK_MATERIAL.opacity, shown * 0.85, 3, dt);
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
  const [x, y] = authorityPos(index);

  const cloud = useMemo(() => {
    const mark = AUTHORITY_MARKS[a.id];
    return mark ? buildMark(mark) : null;
  }, [a.id]);

  const markHalf = cloud ? cloud.halfH : 0;

  const ring = useRef<THREE.Points>(null);
  const ringMat = useRef<THREE.PointsMaterial>(null);
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
        built * (0.58 + active * 0.42) * hush(p),
        4,
        dt,
      );
    }
    if (ring.current) {
      /* A logo does not spin. The ring this replaced could turn like a seal;
         a wordmark turned even a little stops being readable, which is the
         same rule the home page's logotype and figure both follow.

         The breath used to live on a tinted disc behind the mark. With the
         disc gone it moved here — a fraction of a percent of scale, which is
         enough that a beat you dwell on is not a photograph, and far too
         little to blur the letterforms the way a positional drift would. */
      const breath = reduced
        ? 0
        : Math.sin(state.clock.elapsedTime * 1.1) * 0.012 * active;
      const s = 0.62 + built * 0.38 + breath;
      ring.current.scale.setScalar(damp(ring.current.scale.x, s, 3.5, dt));
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
    <group position={[x, y, 0]}>
      {/* Square to the camera, like everything else in this scene.

          The gate was a torus turned a quarter about Y so it stood *across*
          the lane facing the traffic — right in plan and useless on screen,
          since the camera watched side-on and an edge-on ring read as a bar.
          It faced the camera after that, and was still a ring: a diagram of a
          gate rather than a statement about who is behind it. */}
      {cloud && (
        <points ref={ring} geometry={cloud.geometry} scale={0.001}>
          <pointsMaterial
            ref={ringMat}
            size={MARK_DOT}
            vertexColors
            transparent
            opacity={0}
            sizeAttenuation
            depthWrite={false}
          />
        </points>
      )}

      {/* No wash behind the mark. A tinted disc scaled to the logo filled half
          the frame and turned the page's own ground a different colour on every
          gate — and nothing else on this site puts a panel behind its subject.
          The mark stands on the page, like the copy does. */}

      {/* The caption sits *under* a mark and *over* a name.

          Where the logo is drawn it already says who this is, so repeating the
          name in type beside it is the same word twice — only the subject is
          worth adding. Where there is no mark yet, the name has to carry the
          gate on its own. */}
      <group ref={label} scale={0.001}>
        <Billboard
          position={[0, cloud ? -(markHalf + CAPTION_GAP) : GATE_R + 0.72, 0]}
        >
          {!cloud && (
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
          )}
          <Text
            position={[0, cloud ? 0 : -0.44, 0]}
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

/**
 * Your system, at the centre: our name, with the platform it runs on under it.
 *
 * The one thing on the page that is not a party being *connected to* — it is
 * the place all three spokes start. So it holds the middle, and the ring is
 * arranged about it rather than the other way round.
 */
function Hub({ reduced }: { reduced: boolean }) {
  const brand = useMemo(() => buildMark(AIODYX_MARK), []);
  const odoo = useMemo(() => buildMark(ODOO_MARK), []);
  const core = useRef<THREE.Group>(null);
  const brandMat = useRef<THREE.PointsMaterial>(null);
  const odooMat = useRef<THREE.PointsMaterial>(null);

  /* Stacked off the two measured half-heights, so the gap between them is the
     gap and not whatever two boxes of different shapes happen to leave. */
  const brandHalf = brand?.halfH ?? 0;
  const odooHalf = (odoo?.halfH ?? 0) * ODOO_SCALE;
  const brandY = odooHalf + HUB_STACK_GAP;
  const odooY = -(brandHalf + HUB_STACK_GAP);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;

    /**
     * Recedes to a watermark while a platform holds the frame.
     *
     * It cannot move out of the way: it is the middle of the ring, so the
     * framing that puts a platform opposite its copy column puts the hub
     * *under* that column — for two of the three, whichever way the camera is
     * pushed. Dimming is the only lever left, and it is the right one anyway:
     * on those beats the subject is the platform, and the hub only has to say
     * that the spoke runs back to something.
     */
    let held = 0;
    for (const a of AUTHORITIES) held = Math.max(held, owns(p, a.id, 0.3));
    const quiet = (1 - held * 0.88) * hush(p);

    /* Up from the first frame, not faded in over the opening beat.
       Gating this on scroll made the hero render empty — the top of the page
       cannot scroll above zero, so `beat(p, 0, introTo)` is exactly 0 there.
       The damp from zero is the entrance. Services learned the same thing. */
    if (brandMat.current) {
      brandMat.current.opacity = damp(brandMat.current.opacity, 0.95 * quiet, 3, dt);
    }
    if (odooMat.current) {
      odooMat.current.opacity = damp(odooMat.current.opacity, 0.9 * quiet, 3, dt);
    }
    if (core.current) {
      /* The sphere this replaced turned on Y. A wordmark cannot: a logotype
         rotated even a little stops being readable, which is the rule the
         platforms' marks and the home page's logotype both follow. The life
         comes from a breath in scale instead. */
      const breath = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.9) * 0.01;
      core.current.scale.setScalar(damp(core.current.scale.x, 1 + breath, 3, dt));
    }
  });

  return (
    <group position={[0, HUB_MID_Y, 0]}>
      <group ref={core} scale={0.001}>
        {brand && (
          <points geometry={brand.geometry} position={[0, brandY, 0]}>
            <pointsMaterial
              ref={brandMat}
              size={MARK_DOT}
              vertexColors
              transparent
              opacity={0}
              sizeAttenuation
              depthWrite={false}
            />
          </points>
        )}
        {odoo && (
          <points
            geometry={odoo.geometry}
            position={[0, odooY, 0]}
            scale={ODOO_SCALE}
          >
            <pointsMaterial
              ref={odooMat}
              size={MARK_DOT / ODOO_SCALE}
              vertexColors
              transparent
              opacity={0}
              sizeAttenuation
              depthWrite={false}
            />
          </points>
        )}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------- rig */

/** Close enough that a platform and the spoke it stands on fill the frame. */
const NEAR_DIST = 12;
/** The hub with three spokes running out of it, before any platform arrives. */
const WHY_DIST = 15.5;
/** Back far enough to hold the whole ring, marks and captions included. */
const WIDE_DIST = 22.5;
/**
 * The hub alone, at the opening — further out than `why` needs it.
 *
 * The hero drops the lockup to the lower third under centred copy, and the
 * lockup is two marks tall now rather than one. Closer in, the room left below
 * the subtitle is not enough to hold both, and the Odoo mark under our own
 * name — the thing this beat is introducing — fell off the bottom edge.
 */
const OPEN_DIST = 22;

/**
 * How far from the hub toward a platform the camera parks for its beat.
 *
 * Not all the way — the spoke has to stay in shot, or the beat becomes a logo
 * on its own, which is what the page spent the previous section saying it is
 * not. Not much less, either: the hub sits opposite the platform, so any
 * framing that holds both puts one of them where the copy column is.
 *
 * At roughly three quarters the platform owns the free half, the spoke runs
 * out of frame toward a hub that is still faintly there, and the reader is
 * told where it goes without being asked to read two things at once.
 */
const GATE_BIAS = 0.76;

/**
 * Camera: holds the hub, walks out to each platform in turn, then pulls back
 * to show the whole ring.
 *
 * Kept square to the ring — no yaw at all — so world X is screen X. That is
 * what lets a platform be parked opposite its own copy column by moving the
 * camera alone: with the camera turned, the same offset would swing the whole
 * field through the frame instead of sliding it.
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

    // Which platform owns the frame, and how strongly.
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
     * `how` carries four cards over half the frame; at any distance that holds
     * the whole ring, two of the three platforms land squarely behind them.
     * `more` and `close` are a headline and a paragraph, which the ring can
     * sit under.
     */
    const wide = beat(p, moreFrom - 0.05, moreFrom + 0.04);

    /**
     * The opening beat is centred copy, so the field has to leave the middle
     * of the frame entirely rather than sit behind the headline.
     *
     * It drops to the lower third — a pure vertical pan, camera and target
     * lifted by the same amount, so the viewing angle does not change and the
     * hub simply sits lower. Tilting instead would have foreshortened the ring
     * just as the page is trying to introduce it.
     */
    const opening = 1 - beat(p, whyFrom - 0.06, whyFrom + 0.02);
    const lift = opening * 5.65;
    /** Past the platforms but not yet pulled back: `how` holds the last one. */
    const tail = beat(p, howFrom - 0.05, howFrom + 0.03);

    /* Where the camera centres. The hub while the page is introducing itself,
       out along a spoke while a platform is being made its case for, the whole
       field once it pulls back. */
    let tx = 0;
    let ty = HUB_MID_Y;
    const walk = focus >= 0 ? focus : tail > 0.01 ? last : -1;
    const bias = focus >= 0 ? amt : tail;
    if (walk >= 0) {
      const [gx, gy] = authorityPos(walk);
      const k = GATE_BIAS * bias * (1 - wide);
      tx = gx * k;
      ty = HUB_MID_Y + (gy - HUB_MID_Y) * k;
    }
    ty = THREE.MathUtils.lerp(ty, FIELD_MID_Y, wide);

    /**
     * Park the platform opposite its copy column. <StoryOverlay> alternates by
     * beat index: the platforms are beats 2, 3 and 4, so even-indexed ones have
     * their copy on the left and want the field pushed right. `how` is beat 5,
     * odd, so it wants the opposite — hence the explicit +1 rather than
     * falling through to the platform rule with no platform in focus.
     *
     * Smaller than the lane version needed, because the ring already does most
     * of it: GOSI stands to the left of the hub on the beat whose copy is on
     * the right, and QIWA to the right on the beat whose copy is on the left.
     * This only finishes the job — and squares up ZATCA, which stands directly
     * over the hub and has no side of its own.
     */
    /* `flex-start` is the right-hand side under RTL, so the whole alternation
       mirrors in Arabic — without this the platform is pushed to the same side
       the copy just moved to and the two land on top of each other. */
    const side = (focus >= 0 ? (focus % 2 === 0 ? -1 : 1) : 1) * flip;
    const push = Math.max(amt, tail);
    /* Scaled by how little the ring already gave this platform. GOSI stands
       nearly a full radius to the left and QIWA the same to the right, so they
       need a nudge; ZATCA stands directly over the hub with no side at all and
       needs the whole shift. */
    const own = walk >= 0 ? Math.abs(authorityPos(walk)[0]) / RING_RX : 1;
    tx += side * push * (1 - wide) * (0.7 + 2.2 * (1 - own));

    /* `more` has a copy column and wants the ring opposite it; `close` is
       centred and wants the ring centred behind it — see `hush`. The lerp is
       the settle from one to the other. */
    const closing = owns(p, "close", 0.3);
    tx += wide * flip * THREE.MathUtils.lerp(-2.8, 0, closing);

    /* `why` is the one beat with a copy column and nothing on the ring yet, so
       the platform rule above has no platform to work from and left the hub
       sitting squarely under four cards. It gets the same treatment by hand. */
    tx += (1 - opening) * (1 - push) * (1 - wide) * flip * 3.2;

    const dist = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(
        OPEN_DIST,
        THREE.MathUtils.lerp(WHY_DIST, NEAR_DIST, push),
        1 - opening,
      ),
      WIDE_DIST,
      wide,
    );

    /**
     * The hub never leaves the frame.
     *
     * Everything above pushes the camera *away* from the centre to park a
     * platform opposite its copy — and under Arabic the copy columns mirror
     * while the ring does not, so the same rule pushed half again as far and
     * cropped the lockup down the middle at the frame edge. A logo cut in half
     * is worse than one that is simply not there.
     *
     * Measured from the camera's own frustum rather than a guessed number, so
     * it holds at every distance and on every viewport shape.
     */
    if (!wide) {
      const halfW =
        dist *
        Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360) *
        (camera as THREE.PerspectiveCamera).aspect;
      const room = Math.max(halfW * 0.98 - MARK_BOX_W / 2, 0);
      tx = THREE.MathUtils.clamp(tx, -room, room);
    }

    let cx = tx;
    let cy = ty + lift;
    if (!reduced) {
      pointer.current.x = damp(pointer.current.x, state.pointer.x, 2.2, dt);
      pointer.current.y = damp(pointer.current.y, state.pointer.y, 2.2, dt);
      cx += pointer.current.x * 0.5;
      cy += pointer.current.y * 0.35;
    }

    camera.position.x = damp(camera.position.x, cx, 2.4, dt);
    camera.position.y = damp(camera.position.y, cy, 2.4, dt);
    camera.position.z = damp(camera.position.z, dist, 2.4, dt);

    /* Square to the ring: look straight down −Z from wherever we are. The
       look point takes the same lift as the camera, which is what makes the
       opening a pan rather than a tilt. */
    look.current.set(camera.position.x, camera.position.y, 0);
    camera.lookAt(look.current);
  });

  return null;
}

/* ----------------------------------------------------------------- scene */

export function IntegrationsScene({ reduced, locale }: SceneEnv) {
  const laneMats = useRef<(THREE.LineBasicMaterial | null)[]>([]);
  /** How much of each spoke the story has opened, 0 → 1. Shared with the docs. */
  const reach = useRef(AUTHORITIES.map(() => 0));

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const [whyFrom] = rangeOf("why");

    /* Floored once the page has said why any of this matters: the channels are
       there before anything runs down them, which is what tells the visitor
       where this is going. */
    const floor = beat(p, whyFrom, whyFrom + 0.04) * 0.32;

    for (let i = 0; i < AUTHORITIES.length; i++) {
      const [from] = rangeOf(AUTHORITIES[i].id);
      // Latching: a connection that is made does not come apart because you
      // scrolled past it.
      const made = beat(p, from - 0.05, from + 0.03);
      reach.current[i] = damp(
        reach.current[i],
        Math.max(0.1, floor, made),
        3,
        dt,
      );
      const mat = laneMats.current[i];
      if (mat) mat.opacity = damp(mat.opacity, reach.current[i] * 0.5, 3, dt);
    }
  });

  return (
    <>
      {SPOKE_TICKS.map((g, i) => (
        <lineSegments key={AUTHORITIES[i].id} geometry={g} frustumCulled={false}>
          <lineBasicMaterial
            ref={(m) => {
              laneMats.current[i] = m;
            }}
            color={SCENE.muted}
            transparent
            opacity={0}
          />
        </lineSegments>
      ))}

      <Hub reduced={reduced} />
      <Documents reduced={reduced} reach={reach} />
      {AUTHORITIES.map((a, i) => (
        <Gate key={a.id} index={i} locale={locale} reduced={reduced} />
      ))}

      <LaneRig reduced={reduced} locale={locale} />
    </>
  );
}
