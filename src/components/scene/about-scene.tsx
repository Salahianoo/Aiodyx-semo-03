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
 * A small skyline that rises out of each office city on the final beat.
 *
 * Deterministic footprints and heights — no RNG during render, so the two
 * cities look the same on every load and on the server.
 */
/**
 * A skyline, not a row of identical boxes.
 *
 * Each tower gets its own footprint (w ≠ d), its own turn about the vertical,
 * and a height that varies enough to give the cluster a silhouette. The
 * tallest ones carry a narrower lit crown, which is what reads as "tower"
 * rather than "block" at a distance.
 */
type Plot = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot: number;
  crown?: number;
};

const PLOTS: Plot[] = [
  { x: 0.0, z: 0.0, w: 0.032, d: 0.026, h: 0.4, rot: 0.2, crown: 0.1 },
  { x: 0.05, z: 0.03, w: 0.024, d: 0.03, h: 0.29, rot: 0.9, crown: 0.07 },
  { x: -0.045, z: 0.042, w: 0.03, d: 0.022, h: 0.33, rot: 0.45, crown: 0.08 },
  { x: 0.032, z: -0.052, w: 0.022, d: 0.026, h: 0.19, rot: 1.2 },
  { x: -0.038, z: -0.036, w: 0.028, d: 0.02, h: 0.24, rot: 0.05 },
  { x: 0.086, z: -0.012, w: 0.02, d: 0.024, h: 0.15, rot: 0.7 },
  { x: -0.088, z: 0.004, w: 0.023, d: 0.019, h: 0.21, rot: 1.05 },
  { x: 0.012, z: 0.086, w: 0.021, d: 0.027, h: 0.31, rot: 0.35, crown: 0.06 },
  { x: 0.066, z: -0.07, w: 0.018, d: 0.021, h: 0.13, rot: 0.55 },
  { x: -0.07, z: -0.068, w: 0.02, d: 0.017, h: 0.17, rot: 1.35 },
  { x: 0.104, z: 0.062, w: 0.017, d: 0.022, h: 0.11, rot: 0.15 },
  { x: -0.024, z: 0.116, w: 0.019, d: 0.018, h: 0.14, rot: 0.8 },
  { x: -0.115, z: 0.072, w: 0.016, d: 0.02, h: 0.1, rot: 1.1 },
  { x: 0.078, z: 0.104, w: 0.018, d: 0.016, h: 0.16, rot: 0.6 },
];

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
      {PLOTS.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rot, 0]}>
          {/* Shaft — dark body so the silhouette reads against the sky */}
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial
              color="#0A0A12"
              emissive={color}
              emissiveIntensity={0.35}
              roughness={0.45}
              metalness={0.35}
            />
          </mesh>

          {/* Lit crown on the tall ones — the detail that makes them towers */}
          {b.crown && (
            <mesh position={[0, b.h + b.crown / 2, 0]}>
              <boxGeometry args={[b.w * 0.55, b.crown, b.d * 0.55]} />
              <meshStandardMaterial
                color="#0A0A12"
                emissive={color}
                emissiveIntensity={1.9}
                roughness={0.3}
                metalness={0.4}
              />
            </mesh>
          )}
        </group>
      ))}
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

function Marker({
  at,
  label,
  color,
  matRef,
  groupRef,
}: {
  at: THREE.Vector3;
  label: string;
  color: string;
  matRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  /**
   * Label offset, expressed relative to the city — NOT to the globe centre.
   *
   * The tallest tower reaches 0.5 above the surface (0.4 shaft + 0.1 crown).
   * 0.62 sits just over the roofline — enough to clear it, close enough that
   * the label stays in frame during the street-level visit.
   */
  const labelOffset = useMemo(
    () => at.clone().normalize().multiplyScalar(0.62),
    [at],
  );

  return (
    /* Two nested groups on purpose. The outer one is fixed at the city; the
       inner one carries the reveal scale.
       Scaling a group that sits at the globe's origin also scales its
       children's position vectors, so at scale 0.5 the label was sitting at
       radius ~1.2 — inside the planet, well below the towers. Scaling in
       place at the city keeps it above the skyline at every size. */
    <group position={at}>
      <group ref={groupRef} scale={0.001}>
        <mesh>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial ref={matRef} color={color} transparent opacity={0} />
        </mesh>
      {/* Billboarded: the label is a child of the rotating globe, so without
          this it turns with the sphere and renders back-to-front — the text
          came out mirrored once the globe settled. */}
        {/* Big enough to read from orbit — the globe renders at ~0.7 scale, so
            the original 0.12 came out around 0.08 world units — but not so big
            that it swamps the frame during the street-level visit. */}
        <Billboard position={labelOffset}>
          <Text
            fontSize={0.17}
            color={color}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.12}
            outlineWidth={0.012}
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
    const ammanVis = landing * (1 - atRiyadh * 0.92);
    const riyadhVis = landing * (1 - atAmman * 0.92);

    if (ammanMat.current) {
      ammanMat.current.opacity = damp(ammanMat.current.opacity, ammanVis, 3, dt);
    }
    if (riyadhMat.current) {
      riyadhMat.current.opacity = damp(riyadhMat.current.opacity, riyadhVis, 3, dt);
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

      <Marker
        at={ammanPos}
        label={AMMAN.label}
        color="#A78BFA"
        matRef={ammanMat}
        groupRef={ammanMarker}
      />
      <Marker
        at={riyadhPos}
        label={RIYADH.label}
        color="#6FCBE2"
        matRef={riyadhMat}
        groupRef={riyadhMarker}
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
        // edge-on, which is what made them read as bars.
        perch
          .copy(city)
          .addScaledVector(normal, 0.26)
          .addScaledVector(tangent, 0.86);

        // Aim at mid-tower height so the skyline stands up in frame
        aim.copy(city).addScaledVector(normal, 0.19);

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
