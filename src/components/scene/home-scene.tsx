"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import { WORDMARK_PATHS, WORDMARK_VIEWBOX } from "@/components/brand";
import { BEATS, MODULES, moduleBeatOffset } from "@/lib/story";
import { beat, clamp, damp, owns, rangeOf, scroll, smooth } from "@/lib/scroll";
import { Starfield } from "./starfield";

/**
 * One field of points, re-formed eight times.
 *
 * Every other page here builds an object and moves a camera around it. This
 * one has no object: the same twelve thousand points are the scattered data,
 * the assembled core, the ten modules and the logotype, and the story is the
 * transitions between those states. Nothing is created or destroyed the whole
 * way down, which is the argument the page is making — these are not separate
 * tools that get replaced, it is the same material organised.
 *
 * That also settles the motion problem. Home cannot converge-and-orbit without
 * repeating what it used to do, and it cannot climb or rotate without
 * repeating services and about. Transformation in place is nobody else's.
 *
 * ## Why the blend is eight attributes and not a morph target
 *
 * Each point carries all eight of its positions at once (`aPos0`…`aPos7`) and
 * the vertex shader sums them against eight uniform weights. So a frame costs
 * one multiply-add per formation and the CPU touches nothing but the weights —
 * no per-frame buffer upload, and no interpolation state anywhere.
 *
 * Which means the scene is a pure function of scroll position. Scrubbing
 * backwards is not a reversal that has to be computed, it is the same
 * evaluation at a smaller number, so the field cannot drift out of sync with
 * the copy however fast the timeline is dragged.
 */

const COUNT = 12000;
const CLUSTERS = MODULES.length; // 10

/**
 * Logotype size at the finale, and its true aspect.
 *
 * Sized and dropped to clear the closing copy, which is the tallest block on
 * the page — headline, subtitle, two buttons and the office cards. The mark
 * signs off underneath all of it rather than sitting behind it.
 */
const MARK_W = 6.8;
const MARK_AR = WORDMARK_VIEWBOX.h / WORDMARK_VIEWBOX.w;

/**
 * Where the ten module clusters sit. Kept inside the frustum's *short* axis —
 * at 5.5 the ring fitted the frame's width and was cropped top and bottom.
 */
const RING_R = 4.5;

const NODES = Array.from({ length: CLUSTERS }, (_, i) => {
  const a = (i / CLUSTERS) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(
    Math.cos(a) * RING_R,
    Math.sin(a) * RING_R,
    Math.sin(i * 2.1) * 0.5,
  );
});

/* ------------------------------------------------------------ formations */

const DRIFT = 0;
const SCATTER = 1;
const FUNNEL = 2;
const CORE = 3;
const RING = 4;
const WEAVE = 5;
const LATTICE = 6;
const MARK = 7;
const FORMS = 8;

/** Which formation each beat holds. Ten module beats all rest on RING. */
function formationOf(id: string) {
  if (id.startsWith("mod-")) return RING;
  switch (id) {
    case "open":
      return DRIFT;
    case "problems":
    case "problems-2":
      return SCATTER;
    case "flow":
      return FUNNEL;
    case "assembly":
      return CORE;
    case "ai":
      return WEAVE;
    case "why":
      return LATTICE;
    case "close":
      return MARK;
    default:
      return DRIFT;
  }
}

/** How far the camera sits back while each formation holds the frame. */
// The ring sits furthest back of anything here: it has to hold the ten cluster
// labels as well as the clusters, and the twelve o'clock one was landing under
// the nav bar.
const DISTANCE = [17.5, 14.5, 11.5, 7.6, 17.8, 12.6, 12.2, 12.7];
/** And how high it rides. */
const HEIGHT = [1.4, 1.0, 0.7, 0.3, 0.6, 0.5, 0.9, 0.2];
/**
 * Per-formation opacity, blended by the same weights as everything else.
 *
 * The copy sits on top of this and has to win. A formation spread wide enough
 * to fill the frame — the opening haze especially — has to be much fainter
 * than a compact one to put the same amount of light on screen, so density is
 * paid for here rather than by thinning the field itself.
 */
const ALPHA = [0.3, 0.55, 0.7, 0.95, 0.85, 0.8, 0.7, 1.0];

/** Deterministic PRNG — the field must be identical on every load. */
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
 * The logotype, as points.
 *
 * The outlines are filled onto a canvas and the opaque pixels are sampled, so
 * the finale resolves into the actual mark. Rasterising is the only way to get
 * a *fill* — walking the path data would only ever give the outline, and the
 * mark would come out hollow.
 */
function markPoints(rand: () => number): [number, number][] {
  const W = 420;
  const H = Math.round((W * WORDMARK_VIEWBOX.h) / WORDMARK_VIEWBOX.w);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  const s = W / WORDMARK_VIEWBOX.w;
  ctx.setTransform(s, 0, 0, s, -WORDMARK_VIEWBOX.x * s, -WORDMARK_VIEWBOX.y * s);
  ctx.fillStyle = "#fff";
  for (const d of WORDMARK_PATHS) ctx.fill(new Path2D(d));

  const { data } = ctx.getImageData(0, 0, W, H);
  const hits: [number, number][] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 128) hits.push([x / W - 0.5, 0.5 - y / H]);
    }
  }
  // Shuffled once, so taking the first N later is an even sample of the glyphs
  // rather than a slab of whatever the scanline order reached first.
  for (let i = hits.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [hits[i], hits[j]] = [hits[j], hits[i]];
  }
  return hits;
}

type Field = {
  geometry: THREE.BufferGeometry;
};

function buildField(): Field {
  const rand = mulberry32(0x0d1a);
  const pos = Array.from({ length: FORMS }, () => new Float32Array(COUNT * 3));
  const cluster = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);

  const gauss = () =>
    (rand() + rand() + rand() + rand() - 2) * 0.7; // cheap normal-ish

  // Seven problem clumps, spread wide and deliberately unaligned
  const clumps = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    return new THREE.Vector3(
      Math.cos(a) * (7.4 + rand() * 1.6),
      Math.sin(a * 1.7) * 3.4,
      Math.sin(a) * (4.2 + rand() * 1.4) - 1.5,
    );
  });

  const nodes = NODES;
  const marks = markPoints(rand);
  const v = new THREE.Vector3();

  for (let i = 0; i < COUNT; i++) {
    const c = i % CLUSTERS;
    cluster[i] = c;
    seed[i] = rand();
    const k = i * 3;

    /* 0 — DRIFT: a wide, thin haze, sat well behind the copy. Nothing has
       happened yet, and the hero headline has to be the loudest thing here. */
    pos[DRIFT][k] = (rand() - 0.5) * 34;
    pos[DRIFT][k + 1] = (rand() - 0.5) * 19;
    pos[DRIFT][k + 2] = (rand() - 0.5) * 22 - 12;

    /* 1 — SCATTER: seven clumps that never touch. */
    const clump = clumps[i % 7];
    pos[SCATTER][k] = clump.x + gauss() * 1.5;
    pos[SCATTER][k + 1] = clump.y + gauss() * 1.5;
    pos[SCATTER][k + 2] = clump.z + gauss() * 1.5;

    /* 2 — FUNNEL: the same clumps drawn inward on a twist. */
    const t = Math.pow(rand(), 0.65);
    const twist = t * 2.3;
    const cs = Math.cos(twist);
    const sn = Math.sin(twist);
    const fx = clump.x * (1 - t) + gauss() * 0.5 * (1 - t);
    const fz = clump.z * (1 - t) + gauss() * 0.5 * (1 - t);
    pos[FUNNEL][k] = fx * cs - fz * sn;
    pos[FUNNEL][k + 1] = clump.y * (1 - t) + gauss() * 0.4;
    pos[FUNNEL][k + 2] = fx * sn + fz * cs;

    /* 3 — CORE: one dense shell. The point of the whole page. */
    v.set(gauss(), gauss(), gauss()).normalize();
    v.multiplyScalar(2.05 * (0.86 + Math.pow(rand(), 2) * 0.2));
    pos[CORE][k] = v.x;
    pos[CORE][k + 1] = v.y;
    pos[CORE][k + 2] = v.z;

    /* 4 — RING: the core opened out into ten seated clusters. Roughly a
       seventh of the field stays on the ring itself, so the modules read as
       joined rather than as ten separate clouds. */
    const node = nodes[c];
    if (i % 7 === 0) {
      const a = rand() * Math.PI * 2;
      pos[RING][k] = Math.cos(a) * RING_R + gauss() * 0.13;
      pos[RING][k + 1] = Math.sin(a) * RING_R + gauss() * 0.13;
      pos[RING][k + 2] = gauss() * 0.13;
    } else {
      pos[RING][k] = node.x + gauss() * 0.72;
      pos[RING][k + 1] = node.y + gauss() * 0.72;
      pos[RING][k + 2] = node.z + gauss() * 0.5;
    }

    /* 5 — WEAVE: every cluster wired through the middle. The assistant is the
       only beat where the centre is busier than the ring. */
    const u = rand();
    if (u < 0.62) {
      const s2 = Math.pow(rand(), 0.8);
      const sag = Math.sin(s2 * Math.PI) * 0.9;
      pos[WEAVE][k] = node.x * s2 + gauss() * 0.16;
      pos[WEAVE][k + 1] = node.y * s2 + gauss() * 0.16 - sag * 0.3;
      pos[WEAVE][k + 2] = node.z * s2 + sag;
    } else {
      const next = nodes[(c + 1) % CLUSTERS];
      const s2 = rand();
      const bow = Math.sin(s2 * Math.PI) * 1.5;
      pos[WEAVE][k] = THREE.MathUtils.lerp(node.x, next.x, s2) * (1 - bow * 0.12);
      pos[WEAVE][k + 1] = THREE.MathUtils.lerp(node.y, next.y, s2) * (1 - bow * 0.12);
      pos[WEAVE][k + 2] = THREE.MathUtils.lerp(node.z, next.z, s2) + gauss() * 0.2;
    }

    /* 6 — LATTICE: order. Six columns, because there are six reasons. */
    const gx = i % 6;
    const gy = Math.floor(i / 6) % 6;
    const gz = Math.floor(i / 36) % 7;
    pos[LATTICE][k] = (gx - 2.5) * 1.75 + gauss() * 0.1;
    pos[LATTICE][k + 1] = (gy - 2.5) * 1.35 + gauss() * 0.1;
    pos[LATTICE][k + 2] = (gz - 3) * 1.35 + gauss() * 0.1;

    /* 7 — MARK. Sized to sit under the closing copy rather than behind it:
       the last beat is centred, so a full-frame logotype and the CTA fight
       over the same middle. */
    if (marks.length) {
      const [mx, my] = marks[i % marks.length];
      // Both axes come back normalised to ±0.5 against their *own* dimension,
      // so scaling them by the same number squares up a mark that is nearly
      // five times wider than it is tall. The height carries the aspect.
      pos[MARK][k] = mx * MARK_W;
      pos[MARK][k + 1] = my * MARK_W * MARK_AR - 4.1;
      pos[MARK][k + 2] = gauss() * 0.2;
    } else {
      pos[MARK][k] = pos[CORE][k];
      pos[MARK][k + 1] = pos[CORE][k + 1];
      pos[MARK][k + 2] = pos[CORE][k + 2];
    }
  }

  const geometry = new THREE.BufferGeometry();
  // `position` is never read by the shader — the eight blended sets are. It
  // exists so three can count vertices.
  geometry.setAttribute("position", new THREE.BufferAttribute(pos[DRIFT], 3));
  for (let f = 0; f < FORMS; f++) {
    geometry.setAttribute(`aPos${f}`, new THREE.BufferAttribute(pos[f], 3));
  }
  geometry.setAttribute("aCluster", new THREE.BufferAttribute(cluster, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

  return { geometry };
}

/* -------------------------------------------------------------- material */

const UNIFORMS = {
  uW: { value: new Float32Array(FORMS) },
  uTime: { value: 0 },
  uTurb: { value: 0 },
  uFocus: { value: -1 },
  uFocusAmt: { value: 0 },
  uAlpha: { value: 0.3 },
  /**
   * Points are small on purpose. The first pass used 2.6 against a 300 unit
   * scale, which put ~46px sprites on screen: twelve thousand of those,
   * additive, is twenty million fragments a frame — it saturated to flat white
   * and dropped the framerate far enough to be visible.
   */
  uSize: { value: 1.25 },
  uBase: { value: new THREE.Color("#8FA6F5") },
  uCluster: {
    value: MODULES.map((m) => new THREE.Color(m.color)),
  },
};

const MATERIAL = new THREE.ShaderMaterial({
  uniforms: UNIFORMS,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute vec3 aPos0;
    attribute vec3 aPos1;
    attribute vec3 aPos2;
    attribute vec3 aPos3;
    attribute vec3 aPos4;
    attribute vec3 aPos5;
    attribute vec3 aPos6;
    attribute vec3 aPos7;
    attribute float aCluster;
    attribute float aSeed;

    uniform float uW[8];
    uniform float uTime;
    uniform float uTurb;
    uniform float uFocus;
    uniform float uFocusAmt;
    uniform float uAlpha;
    uniform float uSize;
    uniform vec3 uBase;
    uniform vec3 uCluster[${CLUSTERS}];

    varying vec3 vCol;
    varying float vAlpha;

    void main() {
      vec3 p =
          aPos0 * uW[0] + aPos1 * uW[1] + aPos2 * uW[2] + aPos3 * uW[3]
        + aPos4 * uW[4] + aPos5 * uW[5] + aPos6 * uW[6] + aPos7 * uW[7];

      // A held formation should breathe, or a beat you dwell on turns into a
      // photograph. Amplitude is a uniform so reduced motion can zero it.
      float ph = aSeed * 6.2831853;
      p += vec3(
        sin(uTime * 0.5 + ph),
        cos(uTime * 0.43 + ph * 1.7),
        sin(uTime * 0.37 + ph * 2.3)
      ) * uTurb;

      float mine = step(abs(aCluster - uFocus), 0.5);
      float lit = mine * uFocusAmt;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;

      // Module hues only while the ring and the weave own the frame; before
      // and after that the field is one material, which is the point.
      float hueAmt = clamp(uW[4] + uW[5] * 0.85 + uW[6] * 0.3, 0.0, 1.0);
      vec3 col = mix(uBase, uCluster[int(aCluster)], hueAmt);
      // Lifted toward white, not to it. Boosting colour, alpha and size at
      // once blew the focused cluster into a solid white disc — it lost both
      // its hue, which is the only thing identifying it, and the grain that
      // makes it read as a cloud of records rather than a blob.
      vCol = mix(col, vec3(1.0), lit * 0.22);

      float dim = mix(1.0, 0.28, uFocusAmt * (1.0 - mine));
      vAlpha = dim * uAlpha * (1.0 + lit * 0.5);

      gl_PointSize = uSize * (1.0 + lit * 0.5) * (42.0 / max(-mv.z, 0.001));
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vCol;
    varying float vAlpha;

    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float r2 = dot(d, d);
      if (r2 > 0.25) discard;
      float a = smoothstep(0.25, 0.02, r2) * vAlpha;
      if (a < 0.004) discard;
      gl_FragColor = vec4(vCol, a);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
});

/* ---------------------------------------------------------------- timing */

type Anchor = { at: number; form: number };

/**
 * One anchor per beat, at the centre of its measured range.
 *
 * Rebuilt every frame rather than cached because `scroll.ranges` is remeasured
 * on resize and on font settle, and a stale table would drift the field away
 * from the copy it is illustrating. Eighteen beats — the cost is nothing.
 */
function anchors(out: Anchor[]) {
  // Written in place. Rebuilding the list allocated eighteen objects a frame,
  // which is a thousand a second of pure garbage for a table that only ever
  // changes on resize.
  for (let i = 0; i < BEATS.length; i++) {
    const [from, to] = rangeOf(BEATS[i].id);
    out[i].at = (from + to) / 2;
  }
  return out;
}

function weightsAt(p: number, list: Anchor[], out: Float32Array) {
  out.fill(0);
  if (!list.length) {
    out[DRIFT] = 1;
    return;
  }
  if (p <= list[0].at) {
    out[list[0].form] = 1;
    return;
  }
  const last = list[list.length - 1];
  if (p >= last.at) {
    out[last.form] = 1;
    return;
  }
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (p < a.at || p > b.at) continue;
    const t = smooth(clamp((p - a.at) / Math.max(b.at - a.at, 1e-6)));
    // `+=` rather than `=`: consecutive beats often share a formation (all ten
    // module beats do), and the two halves have to add back up to one.
    out[a.form] += 1 - t;
    out[b.form] += t;
    return;
  }
  out[last.form] = 1;
}

/* --------------------------------------------------------------- labels */

/**
 * The ten module names, on the ring.
 *
 * Without them the tour is ten anonymous coloured clouds: the copy column
 * names one module at a time, so nothing on screen ever says *this is an ERP
 * and here is everything in it*. All ten stay legible at once and the active
 * one lifts, which is the one thing the DOM cannot show.
 *
 * Children of the spin group, so a label travels with its own cluster as the
 * ring turns. Billboarded, or they would rotate with it and render mirrored —
 * the same trap the about-page city labels hit.
 */
/**
 * troika's own opacity properties, not the material's.
 *
 * The material is derived and its uniforms are rewritten from `fillOpacity` in
 * `onBeforeRender` — so `material.opacity = x` is overwritten before it ever
 * reaches the screen, and all ten labels hung there at full strength through
 * the opening beat. The outline is a second material for the same reason and
 * needs telling separately.
 */
type TroikaText = THREE.Mesh & {
  fillOpacity: number;
  outlineOpacity: number;
};

function RingLabels() {
  const refs = useRef<(TroikaText | null)[]>([]);
  // Kept here rather than read back off the text, so the damp starts from
  // hidden instead of from troika's default of fully opaque.
  const opacity = useRef(new Float32Array(CLUSTERS));

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const ring = UNIFORMS.uW.value[RING];
    const focus = UNIFORMS.uFocus.value;
    const amt = UNIFORMS.uFocusAmt.value;

    for (let i = 0; i < refs.current.length; i++) {
      const t = refs.current[i];
      if (!t) continue;
      // The nine that are not being talked about are context, not competition
      // — they say "and these too", quietly, under the copy column.
      const active = i === focus ? amt : 0;
      const o = damp(opacity.current[i], ring * (0.24 + active * 0.76), 4, dt);
      opacity.current[i] = o;
      t.fillOpacity = o;
      t.outlineOpacity = o;
      t.visible = o > 0.01;
    }
  });

  return (
    <>
      {MODULES.map((m, i) => (
        <Billboard
          key={m.id}
          position={[NODES[i].x * 1.235, NODES[i].y * 1.235, NODES[i].z]}
        >
          <Text
            ref={(el) => {
              refs.current[i] = el as unknown as TroikaText;
            }}
            visible={false}
            fillOpacity={0}
            outlineOpacity={0}
            fontSize={0.17}
            // Wrapped rather than shrunk: at full width "Inventory &
            // Procurement" is wider than the 3.4 units between neighbours.
            maxWidth={2.5}
            textAlign="center"
            lineHeight={1.25}
            color={m.color}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.06}
            outlineWidth={0.012}
            outlineColor="#05050a"
          >
            {m.label.toUpperCase()}
          </Text>
        </Billboard>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ rig */

function Field({ reduced }: { reduced: boolean }) {
  // Built here, not at module scope: sampling the logotype needs a canvas.
  const field = useMemo(() => buildField(), []);
  // The field and the labels share one transform, so a label cannot drift off
  // the cluster it names.
  const points = useRef<THREE.Group>(null);
  // Formations never change; only the measured centres do.
  const list = useRef<Anchor[]>(
    BEATS.map((b) => ({ at: 0, form: formationOf(b.id) })),
  );
  const look = useRef(new THREE.Vector3());
  const modOffset = useMemo(() => moduleBeatOffset(), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const w = UNIFORMS.uW.value;

    if (scroll.measured) {
      weightsAt(p, anchors(list.current), w);
    } else {
      w.fill(0);
      w[DRIFT] = 1;
    }

    // Which module owns the frame. Only the ring and weave show hues, so this
    // is wasted work outside them — but it is ten cheap range tests.
    let focus = -1;
    let amt = 0;
    for (let i = 0; i < MODULES.length; i++) {
      const o = owns(p, `mod-${MODULES[i].id}`, 0.3);
      if (o > amt) {
        amt = o;
        focus = i;
      }
    }
    UNIFORMS.uFocus.value = focus;
    UNIFORMS.uFocusAmt.value = damp(UNIFORMS.uFocusAmt.value, amt, 4, dt);
    UNIFORMS.uTurb.value = damp(UNIFORMS.uTurb.value, reduced ? 0 : 0.12, 2, dt);
    if (!reduced) UNIFORMS.uTime.value = state.clock.elapsedTime;

    const g = points.current;
    if (g) {
      const face = w[MARK];
      const ring = w[RING];

      /**
       * During the tour the ring turns to bring the active cluster to twelve
       * o'clock, so every module gets the same, composed presentation instead
       * of glowing wherever the free spin happened to leave it.
       *
       * Cluster i sits at `i/10 · 2π − π/2`, so the target is a constant −36°
       * step per module: the ring rolls steadily through most of a full turn
       * across the ten beats rather than snapping between them.
       *
       * Twelve o'clock and not the side away from the copy, which was the
       * first instinct: <StoryOverlay> alternates the column every beat, so
       * "opposite the copy" would have flipped the ring 180° ten times.
       */
      const spoke =
        focus >= 0
          ? Math.PI / 2 - ((focus / CLUSTERS) * Math.PI * 2 - Math.PI / 2)
          : 0;
      g.rotation.z = damp(g.rotation.z, spoke * ring, 2, dt);

      // Free spin everywhere else — but not under the ring, where it would
      // tilt the clusters out of plane, and not at the finale, where the
      // logotype has to be square to camera to be readable at all.
      // Held to about a half-turn across the whole page. At 1.9 radians the
      // weave arrived nearly edge-on and its radial structure — the one thing
      // that beat is about — collapsed into a vertical band.
      const free = (1 - face) * (1 - ring);
      g.rotation.y = damp(g.rotation.y, free * (0.2 + p * 0.85), 1.6, dt);
      g.rotation.x = damp(g.rotation.x, free * 0.12, 1.6, dt);
    }

    // Camera distance and height are the same weighted sum as the positions,
    // so the move and the morph are guaranteed to be in step.
    let dist = 0;
    let high = 0;
    let alpha = 0;
    for (let f = 0; f < FORMS; f++) {
      dist += w[f] * DISTANCE[f];
      high += w[f] * HEIGHT[f];
      alpha += w[f] * ALPHA[f];
    }
    UNIFORMS.uAlpha.value = alpha;

    /**
     * Park the field opposite its copy column during the module tour.
     * <StoryOverlay> alternates by beat index, and module i is beat
     * `moduleBeatOffset() + i`, so even indices put their copy left.
     */
    let side = 0;
    if (focus >= 0 && modOffset >= 0) {
      side = (modOffset + focus) % 2 === 0 ? 1 : -1;
    }
    const shift = side * amt * 2.6;

    const { camera } = state;
    camera.position.x = damp(camera.position.x, shift * 0.35, 2.2, dt);
    camera.position.y = damp(camera.position.y, high, 2.2, dt);
    camera.position.z = damp(camera.position.z, dist, 2.2, dt);

    look.current.set(-shift * 0.65, 0, 0);
    camera.lookAt(look.current);
  });

  return (
    <group ref={points}>
      <points geometry={field.geometry} material={MATERIAL} frustumCulled={false} />
      <RingLabels />
    </group>
  );
}

/**
 * The one lit object in the scene: a small core sitting at the origin, so the
 * field has something to have come from and to close around.
 */
function Heart({ reduced }: { reduced: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const [assemblyFrom] = rangeOf("assembly");
    const [aiFrom] = rangeOf("ai");

    // Present from the moment the field starts collapsing until the wiring
    // beat takes over the centre.
    const show =
      beat(p, assemblyFrom - 0.06, assemblyFrom + 0.02) *
      (1 - beat(p, aiFrom, aiFrom + 0.04));

    if (mat.current) mat.current.opacity = damp(mat.current.opacity, show * 0.5, 3, dt);
    if (mesh.current) {
      const s = 0.28 + show * 0.22;
      mesh.current.scale.setScalar(damp(mesh.current.scale.x, Math.max(s, 0.001), 3, dt));
      if (!reduced) mesh.current.rotation.y = state.clock.elapsedTime * 0.25;
    }
  });

  return (
    <mesh ref={mesh} scale={0.001}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={mat}
        color="#C4B5FD"
        transparent
        opacity={0}
        wireframe
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export function HomeScene({ reduced }: { reduced: boolean }) {
  return (
    <>
      <Starfield reduced={reduced} />
      <Field reduced={reduced} />
      <Heart reduced={reduced} />
    </>
  );
}
