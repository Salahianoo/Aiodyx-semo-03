"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";

import { VALUES, FACET_COLORS } from "@/lib/about-story";
import { beat, damp, owns, rangeOf, scroll } from "@/lib/scroll";
import { Starfield } from "./starfield";

/**
 * A globe the camera orbits — rotation around one object, as opposed to the
 * home page's assembly and the services corridor's forward travel.
 *
 * The story ends on "Where We Operate", so the sphere spins through the values
 * and settles with the Middle East facing the viewer, Amman and Riyadh lit.
 */

const R = 1.55;
const DOTS = 1400;

/**
 * Amman and Riyadh really are only ~11° of longitude apart, which on a globe
 * this size puts the two skylines almost on top of each other — they read as
 * one smudge and the labels collide.
 *
 * The separation is exaggerated around their true midpoint so each city gets
 * its own space. Latitudes are real; longitudes are spread by SPREAD. This is
 * a deliberate cartographic liberty on an already-abstract globe — set SPREAD
 * to 1 for true positions.
 */
const SPREAD = 3.1;
const MID_LON = (35.93 + 46.68) / 2;
const spreadLon = (lon: number) => MID_LON + (lon - MID_LON) * SPREAD;

const AMMAN = { lat: 33.5, lon: spreadLon(35.93), label: "Amman" };
const RIYADH = { lat: 21.5, lon: spreadLon(46.68), label: "Riyadh" };

/** Standard lat/lon → cartesian, +Z toward the camera at rotation 0. */
function latLon(lat: number, lon: number, radius = R) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Rotation that brings a longitude to face the camera.
 * A point sits at theta = lon + 180; it faces +Z when theta + rotY = 90°.
 */
const faceLon = (lon: number) => ((90 - (lon + 180)) * Math.PI) / 180;

/** Settle with the region between the two offices centred. */
const FINAL_Y = faceLon((AMMAN.lon + RIYADH.lon) / 2);

/**
 * Dotted surface, built once at module scope.
 *
 * A Fibonacci sphere is deterministic, so this needs no RNG and renders
 * identically on server and client. Uniform dots rather than fabricated
 * coastlines — inventing continent shapes for a real company's site would be
 * worse than an honest abstraction.
 */
const DOT_GEOMETRY = (() => {
  const pos = new Float32Array(DOTS * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < DOTS; i++) {
    const y = 1 - (i / (DOTS - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = golden * i;
    pos[i * 3] = Math.cos(t) * r * R;
    pos[i * 3 + 1] = y * R;
    pos[i * 3 + 2] = Math.sin(t) * r * R;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
})();

/** Latitude rings and meridians — the structure that reads as "globe". */
const GRATICULE = (() => {
  const pts: number[] = [];
  const SEG = 72;

  // Latitude rings every 30°
  for (let lat = -60; lat <= 60; lat += 30) {
    const phi = ((90 - lat) * Math.PI) / 180;
    const r = Math.sin(phi) * R;
    const y = Math.cos(phi) * R;
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * Math.PI * 2;
      const a1 = ((s + 1) / SEG) * Math.PI * 2;
      pts.push(Math.cos(a0) * r, y, Math.sin(a0) * r);
      pts.push(Math.cos(a1) * r, y, Math.sin(a1) * r);
    }
  }

  // Meridians every 30°
  for (let lon = 0; lon < 360; lon += 30) {
    for (let s = 0; s < SEG / 2; s++) {
      const t0 = (s / (SEG / 2)) * Math.PI;
      const t1 = ((s + 1) / (SEG / 2)) * Math.PI;
      const a = (lon * Math.PI) / 180;
      pts.push(Math.sin(t0) * Math.cos(a) * R, Math.cos(t0) * R, Math.sin(t0) * Math.sin(a) * R);
      pts.push(Math.sin(t1) * Math.cos(a) * R, Math.cos(t1) * R, Math.sin(t1) * Math.sin(a) * R);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
})();

/** Great-circle arc between the two offices, lifted just off the surface. */
const ROUTE = (() => {
  const a = latLon(AMMAN.lat, AMMAN.lon, 1).normalize();
  const b = latLon(RIYADH.lat, RIYADH.lon, 1).normalize();
  const pts: number[] = [];
  const dists: number[] = [];
  const SEG = 48;
  const v = new THREE.Vector3();
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    // Slerp keeps the path on the sphere; the lift arches it above the surface
    v.copy(a).lerp(b, t).normalize();
    const lift = R * (1.015 + Math.sin(t * Math.PI) * 0.09);
    pts.push(v.x * lift, v.y * lift, v.z * lift);
    dists.push(t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute("aDist", new THREE.Float32BufferAttribute(dists, 1));
  return g;
})();

const ROUTE_UNIFORMS = { uPulse: { value: 0 }, uShow: { value: 0 } };

const ROUTE_LINE = (() => {
  const m = new THREE.ShaderMaterial({
    uniforms: ROUTE_UNIFORMS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aDist;
      varying float vDist;
      void main() {
        vDist = aDist;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uPulse;
      uniform float uShow;
      varying float vDist;
      void main() {
        float pulse = smoothstep(0.14, 0.0, abs(vDist - uPulse));
        float alpha = (0.22 + pulse * 0.78) * uShow;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(mix(vec3(0.65,0.55,0.98), vec3(1.0), pulse * 0.7), alpha);
      }
    `,
  });
  const line = new THREE.Line(ROUTE, m);
  line.frustumCulled = false;
  return line;
})();

/* ------------------------------------------------------------- buildings */

/**
 * The two office cities, built the same way as everything else in this scene:
 * geometry and a shader, no texture and no model.
 *
 * A box with an emissive tint reads as a coloured slab — which is exactly how
 * the first version looked. What turns a box into a building is the facade: a
 * window grid at a *constant physical pitch*, so every tower shares a floor
 * height and the cluster gains a sense of scale from its own detail. The rest
 * is silhouette — setbacks, masts and beacons.
 */

type Tower = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Turn about the vertical, so the cluster isn't a grid of aligned boxes. */
  rot: number;
  /** Seeds the window pattern — no two towers light the same rooms. */
  seed: number;
  /** Narrower section stacked on the roof. `inset` is a fraction of w/d. */
  setback?: { h: number; inset: number };
  /** Mast rising above the highest roof; its tip carries a beacon. */
  spire?: number;
};

/**
 * A deterministic downtown: tall in the core, falling away to low blocks at
 * the edges so the cluster meets the ground instead of ending in a cliff.
 *
 * Tallest total is 0.34 + 0.11 + 0.05 = 0.50, which is the roofline <Marker>
 * assumes when it parks the city label at 0.62.
 */
const TOWERS: Tower[] = [
  { x: 0.0, z: 0.0, w: 0.03, d: 0.026, h: 0.34, rot: 0.2, seed: 1, setback: { h: 0.11, inset: 0.62 }, spire: 0.05 },
  { x: 0.052, z: 0.03, w: 0.026, d: 0.03, h: 0.27, rot: 0.92, seed: 2, setback: { h: 0.07, inset: 0.66 } },
  { x: -0.046, z: 0.043, w: 0.03, d: 0.023, h: 0.3, rot: 0.45, seed: 3, setback: { h: 0.08, inset: 0.58 }, spire: 0.04 },
  { x: 0.033, z: -0.053, w: 0.023, d: 0.027, h: 0.19, rot: 1.22, seed: 4 },
  { x: -0.039, z: -0.037, w: 0.028, d: 0.021, h: 0.23, rot: 0.05, seed: 5, setback: { h: 0.05, inset: 0.7 } },
  { x: 0.088, z: -0.013, w: 0.021, d: 0.025, h: 0.15, rot: 0.7, seed: 6 },
  { x: -0.09, z: 0.005, w: 0.024, d: 0.02, h: 0.21, rot: 1.05, seed: 7 },
  { x: 0.013, z: 0.088, w: 0.022, d: 0.028, h: 0.29, rot: 0.35, seed: 8, setback: { h: 0.06, inset: 0.6 }, spire: 0.035 },
  { x: 0.068, z: -0.072, w: 0.019, d: 0.022, h: 0.13, rot: 0.55, seed: 9 },
  { x: -0.072, z: -0.07, w: 0.021, d: 0.018, h: 0.17, rot: 1.35, seed: 10 },
  { x: 0.107, z: 0.064, w: 0.018, d: 0.023, h: 0.11, rot: 0.15, seed: 11 },
  { x: -0.025, z: 0.119, w: 0.02, d: 0.019, h: 0.14, rot: 0.8, seed: 12 },
  { x: -0.118, z: 0.074, w: 0.017, d: 0.021, h: 0.1, rot: 1.1, seed: 13 },
  { x: 0.08, z: 0.107, w: 0.019, d: 0.017, h: 0.16, rot: 0.6, seed: 14 },
  { x: -0.14, z: -0.03, w: 0.022, d: 0.018, h: 0.07, rot: 0.3, seed: 15 },
  { x: 0.13, z: -0.098, w: 0.018, d: 0.02, h: 0.06, rot: 0.95, seed: 16 },
  { x: -0.052, z: -0.128, w: 0.02, d: 0.016, h: 0.08, rot: 1.25, seed: 17 },
  { x: 0.036, z: 0.148, w: 0.017, d: 0.019, h: 0.05, rot: 0.42, seed: 18 },
];

/** Window size in local units. Constant across every tower — that's the point. */
const WINDOW_PITCH = new THREE.Vector2(0.0062, 0.0104);

/**
 * Shared by both cities. `uReveal` rides the same landing ramp that raises the
 * towers, so the lights come up as the city does rather than snapping on.
 */
const CITY_UNIFORMS = {
  uTime: { value: 0 },
  uReveal: { value: 0 },
};

const FACADE_VERT = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aDim;

  varying vec3 vPos;
  varying vec3 vNrm;
  varying vec3 vNrmView;
  varying vec3 vNrmWorld;
  varying vec3 vToCam;
  varying float vSeed;
  varying vec3 vDim;

  void main() {
    vPos = position;
    vNrm = normal;
    vSeed = aSeed;
    vDim = aDim;
    vNrmView = normalMatrix * normal;
    vNrmWorld = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vToCam = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FACADE_FRAG = /* glsl */ `
  uniform vec3 uAccent;
  uniform vec3 uWarm;
  uniform vec2 uPitch;
  uniform float uTime;
  uniform float uReveal;

  varying vec3 vPos;
  varying vec3 vNrm;
  varying vec3 vNrmView;
  varying vec3 vNrmWorld;
  varying vec3 vToCam;
  varying float vSeed;
  varying vec3 vDim;

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 n = normalize(vNrm);
    bool roof = abs(n.y) > 0.5;

    // Facade coordinates. Horizontal runs along whichever axis this face
    // spans, vertical is height above the section's own base. Both stay in
    // local units, so the window pitch is a physical size rather than a
    // fraction of the face — which is what keeps a squat block and a tower
    // reading at the same scale.
    float sideX = step(0.5, abs(n.x));
    float horiz = mix(vPos.x, vPos.z, sideX);
    float halfSpan = mix(vDim.x, vDim.z, sideX) * 0.5;

    // --- body ------------------------------------------------------------
    // Kept deliberately dark. The accent colours differ a lot in luminance —
    // Amman's lavender is far lighter than Riyadh's teal — so a body tint
    // bright enough to see washed one city out into plastic while the other
    // looked right. Concrete at night is nearly black; the windows carry the
    // colour, and that reads the same whatever the accent.
    float gy = clamp(vPos.y / max(vDim.y, 1e-4), 0.0, 1.0);
    vec3 col = mix(vec3(0.010, 0.010, 0.018), uAccent * 0.075, gy);
    if (roof) col = vec3(0.018, 0.018, 0.028) + uAccent * 0.03;

    // One fixed key direction so the four faces don't sit at identical value.
    // Without it a box is a flat silhouette with no volume at all.
    float key = 0.5 + 0.5 * dot(vNrmWorld, normalize(vec3(0.45, 0.62, 0.38)));
    col *= 0.45 + key * 0.75;

    // --- windows ----------------------------------------------------------
    if (!roof) {
      vec2 g = vec2(horiz, vPos.y) / uPitch;
      vec2 cell = floor(g);
      vec2 f = fract(g);
      // Derivative-width antialiasing. Without it the grid moirés into noise
      // the moment the city is more than a few units away.
      vec2 aa = fwidth(g) * 0.75 + 1e-4;

      float wx = smoothstep(0.18 - aa.x, 0.18 + aa.x, f.x) *
                 (1.0 - smoothstep(0.82 - aa.x, 0.82 + aa.x, f.x));
      float wy = smoothstep(0.26 - aa.y, 0.26 + aa.y, f.y) *
                 (1.0 - smoothstep(0.80 - aa.y, 0.80 + aa.y, f.y));
      float pane = wx * wy;

      // Occupancy is deterministic, with a slow drift so the city isn't a
      // frozen photograph — a handful of rooms change over on a long cycle.
      float r = hash21(cell + vSeed * 17.3);
      float lit = step(0.44, r);
      float phase = floor(uTime * 0.14 + r * 9.0);
      lit = mix(lit, step(0.58, hash21(cell + phase * 5.7 + vSeed)), 0.3);

      // Mostly the city's own colour, a few warm rooms to break the monotone
      vec3 pane_col = mix(uAccent, uWarm, step(0.74, hash21(cell.yx + vSeed * 4.1)));
      col += pane_col * pane * lit * (0.55 + r * 0.9) * 1.5 * uReveal;

      // Corner mullions — the vertical edges that stop a tower reading as a
      // rectangle of noise
      float corner = smoothstep(halfSpan * 0.74, halfSpan * 0.99, abs(horiz));
      col += uAccent * corner * 0.28 * uReveal;
    }

    // --- rim ---------------------------------------------------------------
    // Just enough to separate the tower from the sky behind it. Any stronger
    // and every face at a grazing angle floods, which is the same washout the
    // body tint causes.
    float fres = pow(1.0 - clamp(dot(normalize(vNrmView), normalize(vToCam)), 0.0, 1.0), 3.0);
    col += uAccent * fres * 0.32;

    gl_FragColor = vec4(col, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Box with its base at y=0 and the two attributes the facade shader needs: a
 * per-building seed, and the section's own dimensions so the shader knows
 * where its edges are. Cached — the two cities share every geometry.
 */
const SECTIONS = new Map<string, THREE.BoxGeometry>();

function section(w: number, h: number, d: number, seed: number) {
  const key = `${w}|${h}|${d}|${seed}`;
  let g = SECTIONS.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    const count = g.attributes.position.count;
    const seeds = new Float32Array(count).fill(seed);
    const dims = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      dims[i * 3] = w;
      dims[i * 3 + 1] = h;
      dims[i * 3 + 2] = d;
    }
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    g.setAttribute("aDim", new THREE.BufferAttribute(dims, 3));
    SECTIONS.set(key, g);
  }
  return g;
}

/**
 * Materials are cached per accent colour, and the shared uniform objects are
 * spread in by reference — so one write to CITY_UNIFORMS drives both cities.
 */
const FACADES = new Map<string, THREE.ShaderMaterial>();

function facade(accent: string) {
  let m = FACADES.get(accent);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: {
        ...CITY_UNIFORMS,
        uAccent: { value: new THREE.Color(accent) },
        uWarm: { value: new THREE.Color("#FFD2A0") },
        uPitch: { value: WINDOW_PITCH },
      },
      vertexShader: FACADE_VERT,
      fragmentShader: FACADE_FRAG,
    });
    FACADES.set(accent, m);
  }
  return m;
}

const MASTS = new Map<string, THREE.MeshBasicMaterial>();

function mast(accent: string) {
  let m = MASTS.get(accent);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(0.5) });
    MASTS.set(accent, m);
  }
  return m;
}

/** Aircraft warning lights. Opacity is driven per-frame from <Globe>. */
const BEACONS = new Map<string, THREE.MeshBasicMaterial>();

function beacon(accent: string) {
  let m = BEACONS.get(accent);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: "#FFFFFF",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    BEACONS.set(accent, m);
  }
  return m;
}

/**
 * Ground haze: the spill a lit city throws onto the land around it, plus a
 * faint street grid. Without it the towers look like they were dropped on the
 * sphere rather than standing on it.
 *
 * The disc lies in the tangent plane, so its rim floats ~0.012 above the
 * surface rather than sinking into it — additive, so that reads as glow.
 */
const GROUNDS = new Map<string, THREE.ShaderMaterial>();

function ground(accent: string) {
  let m = GROUNDS.get(accent);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: {
        ...CITY_UNIFORMS,
        uAccent: { value: new THREE.Color(accent) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uAccent;
        uniform float uReveal;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float glow = pow(1.0 - smoothstep(0.0, 1.0, length(p)), 2.4);
          vec2 g = abs(fract(p * 6.0) - 0.5);
          float street = 1.0 - smoothstep(0.0, 0.07, min(g.x, g.y));
          float a = glow * (0.2 + street * 0.42) * uReveal;
          if (a < 0.002) discard;
          gl_FragColor = vec4(uAccent * (0.7 + street * 0.6), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    GROUNDS.set(accent, m);
  }
  return m;
}

const UP = new THREE.Vector3(0, 1, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function Skyline({
  at,
  color,
  groupRef,
}: {
  at: THREE.Vector3;
  color: string;
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  // Orient the plot so "up" for the buildings is the globe's surface normal
  const quaternion = useMemo(() => {
    const normal = at.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(UP, normal);
  }, [at]);

  return (
    // Starts flat. Relying on the frame loop to damp down from the default
    // scale of 1 meant the skylines were briefly full height on load and
    // during every beat before the finale.
    <group
      ref={groupRef}
      position={at}
      quaternion={quaternion}
      scale={[0.35, 0.001, 0.35]}
    >
      {/* Flat, so the city's Y-scale rise leaves it alone */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.0015, 0]}
        material={ground(color)}
      >
        <circleGeometry args={[0.21, 48]} />
      </mesh>

      {TOWERS.map((b) => {
        const roof = b.h + (b.setback?.h ?? 0);
        return (
          <group key={b.seed} position={[b.x, 0, b.z]} rotation={[0, b.rot, 0]}>
            <mesh geometry={section(b.w, b.h, b.d, b.seed)} material={facade(color)} />

            {/* The setback restarts the window grid at its own base, which is
                how a real stepped tower reads. */}
            {b.setback && (
              <mesh
                position={[0, b.h, 0]}
                geometry={section(
                  b.w * b.setback.inset,
                  b.setback.h,
                  b.d * b.setback.inset,
                  b.seed + 0.37,
                )}
                material={facade(color)}
              />
            )}

            {b.spire && (
              <>
                <mesh position={[0, roof + b.spire / 2, 0]} material={mast(color)}>
                  <cylinderGeometry args={[0.0006, 0.0014, b.spire, 5]} />
                </mesh>
                {/* Small enough to read as a light. At 0.0034 it was a ball on
                    a stick — a warning beacon is a point, and bloom is what
                    gives it its size on screen. */}
                <mesh position={[0, roof + b.spire, 0]} material={beacon(color)}>
                  <sphereGeometry args={[0.0015, 8, 8]} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------ satellites */

const SAT_RADIUS = 2.45;
const SAT_TILT = 0.42;

/** Orbit path the value satellites travel. */
const ORBIT = (() => {
  const pts: number[] = [];
  const SEG = 128;
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI * 2;
    const a1 = ((i + 1) / SEG) * Math.PI * 2;
    pts.push(Math.cos(a0) * SAT_RADIUS, 0, Math.sin(a0) * SAT_RADIUS);
    pts.push(Math.cos(a1) * SAT_RADIUS, 0, Math.sin(a1) * SAT_RADIUS);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
})();

/**
 * One satellite per value, riding a tilted orbit.
 *
 * Gives the middle of the page something to actually do: the active value's
 * satellite swings forward and lights while the rest recede, instead of the
 * globe just turning for eight straight beats.
 */
function ValueSatellites({ reduced }: { reduced: boolean }) {
  const orbit = useRef<THREE.Group>(null);
  const orbitMat = useRef<THREE.LineBasicMaterial>(null);
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const nodeMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;

    // Present through the values, gone by the CEO beat
    const [valuesFrom] = rangeOf(VALUES[0]);
    const [, valuesTo] = rangeOf(VALUES[VALUES.length - 1]);
    const present = beat(p, valuesFrom - 0.05, valuesFrom + 0.02) *
      (1 - beat(p, valuesTo, valuesTo + 0.05));

    if (orbit.current) {
      orbit.current.rotation.y += reduced ? 0 : dt * 0.16;
      orbit.current.rotation.z = SAT_TILT;
      orbit.current.scale.setScalar(
        damp(orbit.current.scale.x, 0.6 + present * 0.4, 2.4, dt),
      );
    }
    if (orbitMat.current) {
      orbitMat.current.opacity = damp(orbitMat.current.opacity, present * 0.2, 3, dt);
    }

    VALUES.forEach((id, i) => {
      const g = nodes.current[i];
      const m = nodeMats.current[i];
      const active = owns(p, id, 0.3);
      if (g) {
        const s = (0.55 + active * 1.15) * present;
        g.scale.setScalar(damp(g.scale.x, Math.max(s, 0.001), 3, dt));
      }
      if (m) {
        m.opacity = damp(m.opacity, present * (0.22 + active * 0.78), 3, dt);
      }
    });
  });

  return (
    <group ref={orbit}>
      <lineSegments geometry={ORBIT} frustumCulled={false}>
        <lineBasicMaterial ref={orbitMat} color="#A78BFA" transparent opacity={0} />
      </lineSegments>

      {VALUES.map((id, i) => {
        const a = (i / VALUES.length) * Math.PI * 2;
        return (
          <group
            key={id}
            ref={(el) => {
              nodes.current[i] = el;
            }}
            position={[
              Math.cos(a) * SAT_RADIUS,
              0,
              Math.sin(a) * SAT_RADIUS,
            ]}
          >
            <mesh>
              <octahedronGeometry args={[0.11, 0]} />
              <meshBasicMaterial
                ref={(el) => {
                  nodeMats.current[i] = el;
                }}
                color={FACET_COLORS[i]}
                transparent
                opacity={0}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Callout geometry, in city-local units.
 *
 * The label used to sit straight up at 0.62 — directly over the roofline — and
 * the street-level camera cropped it off the top of the frame every time. It
 * now stands off to one side at skyline height with a leader back to the
 * cluster, which is both in frame and reads as an annotation of *that* city
 * rather than text that happens to float nearby.
 */
const LABEL_UP = 0.3;
const LABEL_OUT = 0.32;
/** The tallest tower's roof is at 0.45; the node sits at the foot of its mast. */
const LEADER_TOP = 0.46;

/**
 * The label holds a constant *screen* size instead of a constant world size.
 *
 * A world-sized label cannot serve both ends of this page: the camera is ~1
 * unit from the city at street level and ~5.4 out at orbit, so text big enough
 * to read from orbit is wider than the frame up close — which is why the old
 * label could only survive by being centred over the skyline. Scaling by
 * distance makes it an annotation rather than an object, readable at both.
 *
 * The scale is applied *inside* the reveal group and compensates only for the
 * globe's scale, never the reveal's — so the reveal still shrinks the callout
 * away to nothing, which is what hides it.
 */
const LABEL_K = 0.23;

/**
 * The leader line, one per city, built by hand because `<line>` in JSX
 * resolves to the SVG element rather than R3F's.
 *
 * Module scope rather than `useMemo` on purpose: its three vertices are
 * rewritten every frame, and a memoised value is not allowed to be mutated
 * after render. Keyed by label so two cities can never share one line.
 */
const LEADERS = new Map<string, THREE.Line>();

function leaderLine(key: string, accent: string) {
  let l = LEADERS.get(key);
  if (!l) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(9), 3),
    );
    l = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.5 }),
    );
    // Positions are rewritten every frame, so the baked bounding sphere is
    // wrong the moment the camera moves.
    l.frustumCulled = false;
    LEADERS.set(key, l);
  }
  return l;
}

function Marker({
  at,
  label,
  color,
  matRef,
  groupRef,
  side,
}: {
  at: THREE.Vector3;
  label: string;
  color: string;
  matRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  groupRef: React.RefObject<THREE.Group | null>;
  /** +1 places the callout on the camera's right, -1 on its left. */
  side: 1 | -1;
}) {
  const upLocal = useMemo(() => at.clone().normalize(), [at]);
  const nodeAt = useMemo(
    () => upLocal.clone().multiplyScalar(LEADER_TOP),
    [upLocal],
  );
  const billboard = useRef<THREE.Group>(null);

  const outer = useRef<THREE.Group>(null);
  const scratch = useMemo(
    () => ({
      right: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      pos: new THREE.Vector3(),
      scale: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(({ camera }) => {
    const b = billboard.current;
    if (!b || !b.parent || !outer.current) return;
    const { right, q, pos, scale } = scratch;

    // Which way is "right" is only knowable at render time: the marker is a
    // child of the spinning globe, so take the camera's own right vector and
    // bring it back into this marker's frame.
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    b.parent.getWorldQuaternion(q).invert();
    right.applyQuaternion(q);
    // Flatten onto the local ground plane. Without this the callout rides the
    // camera's roll up and down instead of holding its height beside the city.
    right.addScaledVector(upLocal, -right.dot(upLocal));
    if (right.lengthSq() < 1e-6) return;
    right.normalize().multiplyScalar(side);

    b.position
      .copy(upLocal)
      .multiplyScalar(LABEL_UP)
      .addScaledVector(right, LABEL_OUT);

    // Constant apparent size. The outer group carries no scale of its own, so
    // its world scale is the globe's — divide it out and the reveal scale is
    // the only one left multiplying through.
    outer.current.getWorldPosition(pos);
    outer.current.getWorldScale(scale);
    b.scale.setScalar(
      (LABEL_K * camera.position.distanceTo(pos)) / Math.max(scale.x, 1e-4),
    );

    // Leader: off the tallest roof, out and down to label height, then a short
    // horizontal run into the text. Fetched from the module-scope table inside
    // the callback — binding it to a local in the render body makes it a value
    // the compiler forbids mutating afterwards.
    const line = LEADERS.get(label);
    if (!line) return;
    const attr = line.geometry.attributes.position;
    const a = attr.array as Float32Array;
    const elbow = LABEL_OUT * 0.5;
    const end = LABEL_OUT - 0.022;
    for (let i = 0; i < 3; i++) {
      const axis = i === 0 ? "x" : i === 1 ? "y" : "z";
      a[i] = upLocal[axis] * LEADER_TOP;
      a[3 + i] = upLocal[axis] * LABEL_UP + right[axis] * elbow;
      a[6 + i] = upLocal[axis] * LABEL_UP + right[axis] * end;
    }
    attr.needsUpdate = true;
  });

  return (
    /* Two nested groups on purpose. The outer one is fixed at the city; the
       inner one carries the reveal scale.
       Scaling a group that sits at the globe's origin also scales its
       children's position vectors, so at scale 0.5 the label was sitting at
       radius ~1.2 — inside the planet, well below the towers. Scaling in
       place at the city keeps it beside the skyline at every size. */
    <group ref={outer} position={at}>
      <group ref={groupRef} scale={0.001}>
        <mesh>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} />
        </mesh>

        <primitive object={leaderLine(label, color)} />

        {/* Node where the leader leaves the skyline. Kept to a dot — at 0.011
            it was a bubble stuck to the roof, wider than the tower it marks. */}
        <mesh position={nodeAt}>
          <sphereGeometry args={[0.0042, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>

        {/* Billboarded: the label is a child of the rotating globe, so without
            this it turns with the sphere and renders back-to-front — the text
            came out mirrored once the globe settled.

            Anchored on its inner edge so it reads outward from the leader
            rather than straddling it. */}
        <Billboard ref={billboard}>
          <Text
            fontSize={0.15}
            color={color}
            anchorX={side > 0 ? "left" : "right"}
            anchorY="middle"
            letterSpacing={0.12}
            outlineWidth={0.011}
            outlineColor="#05050a"
          >
            {label.toUpperCase()}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

function Globe({
  reduced,
  ammanCity,
  riyadhCity,
}: {
  reduced: boolean;
  ammanCity: React.RefObject<THREE.Group | null>;
  riyadhCity: React.RefObject<THREE.Group | null>;
}) {
  const group = useRef<THREE.Group>(null);
  const dots = useRef<THREE.PointsMaterial>(null);
  const grid = useRef<THREE.LineBasicMaterial>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const ammanMat = useRef<THREE.MeshBasicMaterial>(null);
  const riyadhMat = useRef<THREE.MeshBasicMaterial>(null);
  const ammanMarker = useRef<THREE.Group>(null);
  const riyadhMarker = useRef<THREE.Group>(null);

  const accent = useMemo(() => new THREE.Color(), []);
  const target = useMemo(() => new THREE.Color(), []);

  const ammanPos = useMemo(() => latLon(AMMAN.lat, AMMAN.lon), []);
  const riyadhPos = useMemo(() => latLon(RIYADH.lat, RIYADH.lon), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;
    const g = group.current;
    if (!g) return;

    const [openFrom, openTo] = rangeOf("intro");
    const [ammanFrom] = rangeOf("amman");
    const [closeFrom] = rangeOf("close");

    const arrive = beat(p, openFrom, openTo);
    // Cities are up from the moment the Amman beat starts and stay up.
    const landing = beat(p, ammanFrom - 0.045, ammanFrom + 0.01);

    const atAmman = owns(p, "amman", 0.3);
    const atRiyadh = owns(p, "riyadh", 0.3);

    // Spin through the story, then settle. During the two city stops, turn so
    // that city specifically faces the camera; blended rather than switched,
    // so moving between the two stops is a short turn, not a cut.
    const spun = FINAL_Y - (1 - beat(p, openFrom, ammanFrom)) * Math.PI * 2 * 2;
    const cityWeight = Math.min(1, atAmman + atRiyadh);
    const cityY =
      (faceLon(AMMAN.lon) * atAmman + faceLon(RIYADH.lon) * atRiyadh) /
      Math.max(cityWeight, 1e-4);
    const targetY = THREE.MathUtils.lerp(spun, cityY, cityWeight);
    g.rotation.y = damp(g.rotation.y, targetY, 2.2, dt);

    // Axial tilt, eased in on arrival
    g.rotation.z = damp(g.rotation.z, -0.41 * arrive, 2, dt);
    g.position.y = damp(g.position.y, (1 - arrive) * -2.2, 2.2, dt);
    // Shrink for the finale: at full size the sphere crops off the top of the
    // frame and takes the office markers with it.
    // Hold full size through the city stops — shrinking the globe while the
    // camera is flying down to street level fights itself. Only the final
    // pull-out shrinks it.
    const shrink = beat(p, closeFrom, 1) * 0.3;
    g.scale.setScalar(damp(g.scale.x, (0.72 + arrive * 0.28) * (1 - shrink), 2.4, dt));

    // Each value tints the globe — the sphere has no facets to light, so the
    // colour is what gives every value its own moment.
    let active = 0;
    for (let i = 0; i < VALUES.length; i++) {
      if (owns(p, VALUES[i], 0.3) > 0.4) active = i;
    }
    target.set(FACET_COLORS[active]);
    accent.lerp(target, 1 - Math.exp(-2.5 * dt));

    if (dots.current) {
      dots.current.color.copy(accent);
      dots.current.opacity = damp(dots.current.opacity, arrive * 0.92, 3, dt);
    }
    if (grid.current) {
      grid.current.color.copy(accent);
      grid.current.opacity = damp(grid.current.opacity, arrive * 0.26, 3, dt);
    }
    if (glow.current) {
      glow.current.color.copy(accent);
      glow.current.opacity = damp(glow.current.opacity, arrive * 0.12, 3, dt);
    }

    // Offices surface at the end. While standing in one city, the other's
    // label drops away — at close range two billboards on a globe this size
    // sit right on top of each other.
    //
    // They also stand down for the close beat: that one is centred copy over
    // the whole globe and it names both offices in its own text, so a pair of
    // callouts holding screen size across the middle of the frame is competing
    // with the headline to say something the headline already says.
    const settled = 1 - beat(p, closeFrom, 1);
    const ammanVis = landing * (1 - atRiyadh * 0.92) * settled;
    const riyadhVis = landing * (1 - atAmman * 0.92) * settled;

    // The dot marks the city from orbit. Standing in the city it is a solid
    // ball the width of three towers, parked in the middle of downtown — so it
    // fades out on approach and lets the skyline do the marking. Faded on the
    // material rather than the group, because the group scale also carries the
    // label, which we still want overhead.
    if (ammanMat.current) {
      const v = ammanVis * (1 - atAmman * 0.95);
      ammanMat.current.opacity = damp(ammanMat.current.opacity, v, 3, dt);
    }
    if (riyadhMat.current) {
      const v = riyadhVis * (1 - atRiyadh * 0.95);
      riyadhMat.current.opacity = damp(riyadhMat.current.opacity, v, 3, dt);
    }
    if (ammanMarker.current) {
      const g2 = ammanMarker.current;
      g2.scale.setScalar(damp(g2.scale.x, Math.max(ammanVis, 0.001), 3, dt));
    }
    if (riyadhMarker.current) {
      const g2 = riyadhMarker.current;
      g2.scale.setScalar(damp(g2.scale.x, Math.max(riyadhVis, 0.001), 3, dt));
    }
    // Cities grow out of the surface. Scaling only Y makes them rise from the
    // ground rather than balloon into existence — the offices arriving, not
    // appearing.
    for (const city of [ammanCity.current, riyadhCity.current]) {
      if (!city) continue;
      city.scale.y = damp(city.scale.y, Math.max(landing, 0.001), 3.4, dt);
      const lateral = damp(city.scale.x, 0.35 + landing * 0.65, 3.4, dt);
      city.scale.x = lateral;
      city.scale.z = lateral;
    }

    // Window lights come up with the city rather than snapping on. The slow
    // occupancy drift and the beacons are motion, so they stop when asked to.
    CITY_UNIFORMS.uReveal.value = damp(CITY_UNIFORMS.uReveal.value, landing, 3, dt);
    if (!reduced) CITY_UNIFORMS.uTime.value = state.clock.elapsedTime;

    let b = 0;
    for (const m of BEACONS.values()) {
      // Offset per city so the two skylines don't strobe in lockstep
      const phase = b++ * 1.9;
      // Floored well above zero: a beacon that spends most of its cycle dim
      // reads as a grey bead rather than a light that happens to flash.
      const blink = reduced
        ? 0.75
        : 0.5 +
          0.5 *
            Math.pow(
              Math.max(0, Math.sin(state.clock.elapsedTime * 1.5 + phase)),
              6,
            );
      m.opacity = landing * blink;
    }

    ROUTE_UNIFORMS.uShow.value = damp(ROUTE_UNIFORMS.uShow.value, landing, 3, dt);
    if (!reduced) {
      ROUTE_UNIFORMS.uPulse.value = (state.clock.elapsedTime * 0.3) % 1.3;
    }
  });

  return (
    <group ref={group}>
      <points geometry={DOT_GEOMETRY} frustumCulled={false}>
        <pointsMaterial
          ref={dots}
          size={0.033}
          transparent
          opacity={0}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      <lineSegments geometry={GRATICULE} frustumCulled={false}>
        <lineBasicMaterial ref={grid} transparent opacity={0} />
      </lineSegments>

      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[R * 1.13, 32, 32]} />
        <meshBasicMaterial
          ref={glow}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Occluder: an opaque sphere just under the surface stops the far-side
          dots showing through and flattening the globe into a disc. */}
      <mesh>
        <sphereGeometry args={[R * 0.97, 48, 48]} />
        <meshBasicMaterial color="#05050a" />
      </mesh>

      <primitive object={ROUTE_LINE} />

      <Skyline at={ammanPos} color="#A78BFA" groupRef={ammanCity} />
      <Skyline at={riyadhPos} color="#6FCBE2" groupRef={riyadhCity} />

      {/* Each callout stands opposite its own copy column. <StoryOverlay>
          alternates the text by beat index — amman is odd so its copy sits
          right, riyadh is even so its copy sits left — and a callout on the
          same side lands straight on the headline. */}
      <Marker
        at={ammanPos}
        label={AMMAN.label}
        color="#A78BFA"
        matRef={ammanMat}
        groupRef={ammanMarker}
        side={-1}
      />
      <Marker
        at={riyadhPos}
        label={RIYADH.label}
        color="#6FCBE2"
        matRef={riyadhMat}
        groupRef={riyadhMarker}
        side={1}
      />
    </group>
  );
}

function OrbitRig({
  reduced,
  ammanCity,
  riyadhCity,
}: {
  reduced: boolean;
  ammanCity: React.RefObject<THREE.Group | null>;
  riyadhCity: React.RefObject<THREE.Group | null>;
}) {
  const pointer = useRef({ x: 0, y: 0 });
  const vecs = useRef({
    look: new THREE.Vector3(0, 0, 0),
    city: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    perch: new THREE.Vector3(),
    aim: new THREE.Vector3(),
  });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { camera } = state;
    const p = scroll.progress;
    const { look, city, normal, tangent, perch, aim } = vecs.current;

    const [introFrom, introTo] = rangeOf("intro");
    const [closeFrom] = rangeOf("close");

    const open = beat(p, introFrom, introTo);
    const ceo = owns(p, "ceo", 0.3);
    const close = beat(p, closeFrom, 1);
    const atAmman = owns(p, "amman", 0.3);
    const atRiyadh = owns(p, "riyadh", 0.3);
    const visiting = Math.min(1, atAmman + atRiyadh);

    // --- orbit (default) ---------------------------------------------------
    let x = (1.0 + Math.sin(p * Math.PI * 1.3) * 1.1) * (1 - close);
    let y = 0.45 + close * 0.35;
    let z = 5.4 + open * 1.6 - ceo * 0.9 + close * 0.9;
    look.set(0, -close * 0.95, 0);

    // --- city visit --------------------------------------------------------
    // The skylines are children of the spinning globe, so their world position
    // is only knowable at render time. Reading it off the object is far more
    // robust than trying to re-derive it from rotation, tilt and scale.
    if (visiting > 0.001) {
      const target = atAmman >= atRiyadh ? ammanCity.current : riyadhCity.current;
      if (target) {
        target.getWorldPosition(city);
        normal.copy(city).normalize();

        // Mostly tangential, only slightly out along the normal. Sitting on
        // the normal meant looking straight down at the rooftops, so the
        // towers read as flat slabs instead of a skyline.
        tangent.copy(normal).cross(WORLD_UP).normalize();

        // Stand back far enough that the whole cluster fits — at 0.88 the
        // camera was inside the skyline and the near towers filled the frame
        // edge-on, which is what made them read as bars. Widened again once
        // the towers grew masts: the tallest reaches 0.50 and its beacon was
        // being cropped off the top of the frame.
        perch
          .copy(city)
          .addScaledVector(normal, 0.28)
          .addScaledVector(tangent, 0.92);

        // Aim at mid-tower height so the skyline stands up in frame
        aim.copy(city).addScaledVector(normal, 0.21);

        x = THREE.MathUtils.lerp(x, perch.x, visiting);
        y = THREE.MathUtils.lerp(y, perch.y, visiting);
        z = THREE.MathUtils.lerp(z, perch.z, visiting);
        look.lerp(aim, visiting);
      }
    }

    if (!reduced) {
      pointer.current.x = damp(pointer.current.x, state.pointer.x, 2.2, dt);
      pointer.current.y = damp(pointer.current.y, state.pointer.y, 2.2, dt);
      // Damp the parallax down while up close, where it would read as shake
      const par = 1 - visiting * 0.75;
      x += pointer.current.x * 0.4 * par;
      y += pointer.current.y * 0.28 * par;
    }

    // Tighter tracking on the dive so the descent lands within the beat
    const lambda = 2.4 + visiting * 1.8;
    camera.position.x = damp(camera.position.x, x, lambda, dt);
    camera.position.y = damp(camera.position.y, y, lambda, dt);
    camera.position.z = damp(camera.position.z, z, lambda, dt);

    // On a sphere, "up" for a city is its surface normal. Leaving the camera's
    // up as world-Y meant the towers splayed sideways across the frame like
    // spikes off a horizon instead of standing on ground. Blending the up
    // vector toward the normal is what turns the shot into a skyline.
    if (visiting > 0.001) {
      camera.up.lerpVectors(WORLD_UP, normal, visiting).normalize();
    } else if (camera.up.y !== 1) {
      camera.up.set(0, 1, 0);
    }

    camera.lookAt(look);
  });

  return null;
}

export function AboutScene({ reduced }: { reduced: boolean }) {
  // Held here so the rig can read each city's world position — they live
  // inside the rotating globe, so only the object knows where it actually is.
  const ammanCity = useRef<THREE.Group>(null);
  const riyadhCity = useRef<THREE.Group>(null);

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 2, 4]} intensity={2} color="#8B5CF6" />

      <Starfield reduced={reduced} />
      <Globe reduced={reduced} ammanCity={ammanCity} riyadhCity={riyadhCity} />
      {/* Outside <Globe> so the orbit doesn't inherit the planet's spin */}
      <ValueSatellites reduced={reduced} />
      <OrbitRig
        reduced={reduced}
        ammanCity={ammanCity}
        riyadhCity={riyadhCity}
      />
    </>
  );
}
