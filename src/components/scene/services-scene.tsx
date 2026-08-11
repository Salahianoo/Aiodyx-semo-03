"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

import { STAGES, STATION_COLORS, stationZ } from "@/lib/services-story";
import { t } from "@/lib/content";
import { damp, scroll } from "@/lib/scroll";

/**
 * A corridor of gates the camera flies through — forward travel, deliberately
 * unlike the home page's orbit.
 *
 * Each station is a ring plus a label. The camera moves along -Z with scroll,
 * so stations arrive, pass, and recede behind you.
 */

/**
 * Corridor radius. The camera flies *inside* this tube, so the radius has to
 * sit inside the visible half-height at the distance a gate is read — at
 * fov 58 that's ~2.8 units a few gaps out. At 3.1 the rings sat off-screen
 * and the corridor was invisible.
 */
const RADIUS = 1.95;

function Station({ index }: { index: number }) {
  const group = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const innerRingMat = useRef<THREE.MeshBasicMaterial>(null);
  const z = stationZ(index);
  const color = STATION_COLORS[index];

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 1 / 30);

    // Distance from the camera along the corridor, in station-gaps
    const camZ = state.camera.position.z;
    const d = (camZ - z) / 9;

    // Bright while approaching and passing, dark once well behind
    const near = THREE.MathUtils.clamp(1 - Math.abs(d) / 1.5, 0, 1);

    if (ringMat.current) {
      ringMat.current.opacity = damp(
        ringMat.current.opacity,
        0.22 + near * 0.78,
        4,
        dt,
      );
    }
    if (innerRingMat.current) {
      innerRingMat.current.opacity = damp(
        innerRingMat.current.opacity,
        0.1 + near * 0.5,
        4,
        dt,
      );
    }

    // Slow counter-rotation, alternating direction so the corridor doesn't
    // read as one rigid tube
    g.rotation.z += dt * 0.06 * (index % 2 === 0 ? 1 : -1);
  });

  return (
    <group ref={group} position={[0, 0, z]}>
      {/* Gate ring. Heavy on purpose — at 0.022 the gates read as hairlines
          and the corridor barely existed. This is the page's main structure,
          so it carries real weight. */}
      <mesh>
        <torusGeometry args={[RADIUS, 0.075, 12, 96]} />
        <meshBasicMaterial ref={ringMat} color={color} transparent opacity={0} />
      </mesh>

      {/* A thinner concentric ring just inside, so each gate reads as a built
          object rather than a single stroke. */}
      <mesh>
        <torusGeometry args={[RADIUS - 0.16, 0.022, 8, 96]} />
        <meshBasicMaterial ref={innerRingMat} color={color} transparent opacity={0} />
      </mesh>

      {/* Four corner ticks — give the gate an orientation as it passes */}
      {[0, 1, 2, 3].map((q) => {
        const a = (q / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh
            key={q}
            position={[Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0]}
            rotation={[0, 0, a]}
          >
            <planeGeometry args={[0.62, 0.1]} />
            <meshBasicMaterial color={color} transparent opacity={0.85} />
          </mesh>
        );
      })}

      <Text
        position={[0, RADIUS + 0.42, 0]}
        fontSize={0.24}
        color={color}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
      >
        {t(`home.process.${STAGES[index]}.title`).toUpperCase()}
      </Text>

      <Text
        position={[0, -RADIUS - 0.5, 0]}
        fontSize={0.46}
        color="#2E2E3E"
        anchorX="center"
        anchorY="middle"
      >
        {String(index + 1).padStart(2, "0")}
      </Text>
    </group>
  );
}

/** Rails running the length of the corridor, for a sense of speed. */
function Rails() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const far = stationZ(STAGES.length) - 6;
    for (let q = 0; q < 4; q++) {
      const a = (q / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * RADIUS;
      const y = Math.sin(a) * RADIUS;
      positions.push(x, y, 2, x, y, far);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#8B5CF6" transparent opacity={0.24} />
    </lineSegments>
  );
}

/** Camera rig: straight-line travel down the corridor. */
function CorridorRig({ reduced }: { reduced: boolean }) {
  const pointer = useRef({ x: 0, y: 0 });
  const look = useRef(new THREE.Vector3(0, 0, -30));

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { camera } = state;
    const p = scroll.progress;

    // Travel from just before the first gate to just past the last
    const start = 2;
    const end = stationZ(STAGES.length - 1) - 3;
    const targetZ = THREE.MathUtils.lerp(start, end, p);

    let x = 0;
    let y = 0;
    if (!reduced) {
      pointer.current.x = damp(pointer.current.x, state.pointer.x, 2.2, dt);
      pointer.current.y = damp(pointer.current.y, state.pointer.y, 2.2, dt);
      x = pointer.current.x * 0.5;
      y = pointer.current.y * 0.35;

      // A gentle drift across the corridor so it isn't a dead-straight line
      x += Math.sin(p * Math.PI * 2.2) * 0.55;
      y += Math.cos(p * Math.PI * 1.7) * 0.4;
    }

    camera.position.x = damp(camera.position.x, x, 2.4, dt);
    camera.position.y = damp(camera.position.y, y, 2.4, dt);
    // Faster on Z: the sense of travel depends on this tracking scroll closely
    camera.position.z = damp(camera.position.z, targetZ, 4, dt);

    // Always look down the corridor, a little ahead of where we are
    look.current.set(0, 0, camera.position.z - 12);
    camera.lookAt(look.current);
  });

  return null;
}

export function ServicesScene({ reduced }: { reduced: boolean }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 0, 2]} intensity={3} color="#8B5CF6" distance={30} />

      <Rails />
      {STAGES.map((_, i) => (
        <Station key={i} index={i} />
      ))}

      <CorridorRig reduced={reduced} />
    </>
  );
}
