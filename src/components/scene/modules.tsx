"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";

import { MODULES, CARD_W, CARD_H, type ModuleDef } from "@/lib/story";
import { beat, clamp, damp, owns, rangeOf, scroll } from "@/lib/scroll";

/** The troika object drei's <Text> forwards; its text and material are ours. */
type TroikaText = THREE.Object3D & {
  text: string;
  sync: () => void;
  material?: THREE.Material & { opacity: number };
};

/** Scratch, written and consumed inside a single useFrame call. */
const tmpTarget = new THREE.Vector3();

/** The tour spans the first module beat through the last, as measured. */
export function tourBounds(): [number, number] {
  const first = rangeOf(`mod-${MODULES[0].id}`);
  const last = rangeOf(`mod-${MODULES[MODULES.length - 1].id}`);
  return [first[0], last[1]];
}

/** 1 while any module beat is on screen. */
export function tourAmount(p: number) {
  if (!scroll.measured) return 0;
  const [from, to] = tourBounds();
  const edge = (to - from) * 0.04;
  return beat(p, from - edge, from + edge) * (1 - beat(p, to - edge, to + edge));
}

/** Continuous card index across the tour, for camera interpolation. */
export function tourIndex(p: number) {
  const [from, to] = tourBounds();
  const span = (to - from) / MODULES.length;
  return clamp((p - from) / span - 0.5, 0, MODULES.length - 1);
}

/**
 * One module card.
 *
 * Carries its real name and description, so the card is readable content
 * rather than a labelled box. Every value is damped toward a scroll-derived
 * target inside useFrame — no React state, no re-renders.
 */
function ModuleCard({ def, reduced }: { def: ModuleDef; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const bar = useRef<THREE.MeshBasicMaterial>(null);
  // troika's Text object; its .material is a normal three material we can
  // mutate. Do NOT pass a <meshBasicMaterial> child to <Text> — troika treats
  // children as the text content, so a material element there is a bug.
  const nameRef = useRef<{ material?: THREE.Material & { opacity: number } } | null>(null);
  const descRef = useRef<TroikaText | null>(null);
  /** Whether this card's description text is currently populated. */
  const descFilled = useRef(false);


  // Per-instance endpoints. Sharing module-level vectors here stacked every
  // card on one spot, because each instance read whatever the last render left.
  const ends = useMemo(
    () => ({
      scattered: new THREE.Vector3(...def.scattered),
      assembled: new THREE.Vector3(...def.assembled),
    }),
    [def.scattered, def.assembled],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;

    // Ranges come from the measured section layout, so they stay correct
    // whatever height a beat's copy ends up being.
    const [openFrom] = rangeOf("open");
    const [, problemsTo] = rangeOf("problems");
    const [assemblyFrom, assemblyTo] = rangeOf("assembly");
    const [, closeFrom] = rangeOf("why");

    const revealed = beat(p, openFrom, problemsTo);
    const assembled = beat(p, assemblyFrom - (assemblyTo - assemblyFrom), assemblyTo);

    // 1 while this card owns its screen, ramping in and out either side
    const mine = owns(p, `mod-${def.id}`, 0.35);

    tmpTarget.lerpVectors(ends.scattered, ends.assembled, assembled);

    // The focused card steps out of the ring toward the camera
    tmpTarget.z += mine * 3.4;

    if (!reduced) {
      const t = state.clock.elapsedTime;
      const drift = (1 - assembled) * 0.34;
      tmpTarget.x += Math.sin(t * 0.28 + def.seed) * drift;
      tmpTarget.y += Math.cos(t * 0.23 + def.seed * 1.7) * drift;
      tmpTarget.z += Math.sin(t * 0.19 + def.seed * 0.7) * drift * 1.4;
    }

    g.position.x = damp(g.position.x, tmpTarget.x, 3.2, dt);
    g.position.y = damp(g.position.y, tmpTarget.y, 3.2, dt);
    g.position.z = damp(g.position.z, tmpTarget.z, 3.2, dt);

    const tumble = reduced ? 0 : (1 - assembled) * 0.2;
    const t = state.clock.elapsedTime;
    g.rotation.x = damp(g.rotation.x, Math.sin(t * 0.31 + def.seed) * tumble, 2.4, dt);
    g.rotation.y = damp(g.rotation.y, Math.cos(t * 0.27 + def.seed) * tumble, 2.4, dt);

    // Grows a little when focused
    const scale = (0.7 + revealed * 0.3) * (1 + mine * 0.22);
    g.scale.setScalar(damp(g.scale.x, scale, 3, dt));

    // Dim the rest of the ring during the tour so the focused card reads
    const touring = tourAmount(p);
    const dimmed = touring * (1 - mine) * 0.82;
    const recede = beat(p, closeFrom, 1) * 0.55;
    const opacity = revealed * (1 - dimmed) * (1 - recede);

    if (mat.current) {
      mat.current.opacity = damp(mat.current.opacity, opacity, 4, dt);
      // The focused boost is deliberately modest. At +0.75 the card face lit
      // up so hard that its own description washed out against it — a card
      // you can't read is worse than one that doesn't glow.
      mat.current.emissiveIntensity = damp(
        mat.current.emissiveIntensity,
        0.1 + assembled * 0.3 + mine * 0.34,
        3,
        dt,
      );
    }
    if (bar.current) bar.current.opacity = damp(bar.current.opacity, opacity * 0.9, 4, dt);

    const nm = nameRef.current?.material;
    if (nm) {
      nm.transparent = true;
      nm.opacity = damp(nm.opacity, opacity, 4, dt);
    }

    // The description lives inside the card group so it sits against the title
    // exactly, but only the focused card's text is ever populated: an empty
    // troika Text generates no glyphs, so nine of the ten cost nothing.
    const wantDesc = mine > 0.5;
    if (descRef.current && wantDesc !== descFilled.current) {
      descFilled.current = wantDesc;
      descRef.current.text = wantDesc ? def.desc : "";
      descRef.current.sync();
    }
    const dm = descRef.current?.material;
    if (dm) {
      dm.transparent = true;
      dm.opacity = damp(dm.opacity, opacity * mine, 4, dt);
    }
  });

  return (
    <group ref={group} position={def.scattered}>
      <RoundedBox args={[CARD_W, CARD_H, 0.07]} radius={0.07} smoothness={4}>
        <meshStandardMaterial
          ref={mat}
          color="#0E0E18"
          emissive={def.color}
          emissiveIntensity={0.1}
          roughness={0.36}
          metalness={0.15}
          transparent
          opacity={0}
        />
      </RoundedBox>

      {/* Accent bar — identity at a glance */}
      <mesh position={[0, CARD_H / 2 - 0.16, 0.045]}>
        <planeGeometry args={[CARD_W - 0.34, 0.045]} />
        <meshBasicMaterial ref={bar} color={def.color} transparent opacity={0} />
      </mesh>

      <Text
        ref={nameRef}
        position={[-CARD_W / 2 + 0.17, CARD_H / 2 - 0.42, 0.05]}
        fontSize={0.155}
        color="#F4F4F6"
        anchorX="left"
        anchorY="middle"
        letterSpacing={-0.012}
        maxWidth={CARD_W - 0.34}
      >
        {def.label}
      </Text>

      {/* Starts empty; filled imperatively when this card takes focus */}
      <Text
        ref={descRef}
        position={[-CARD_W / 2 + 0.17, CARD_H / 2 - 0.62, 0.05]}
        fontSize={0.088}
        color="#E4E4F0"
        anchorX="left"
        anchorY="top"
        lineHeight={1.5}
        maxWidth={CARD_W - 0.34}
      >
        {""}
      </Text>
    </group>
  );
}

export function Modules({ reduced }: { reduced: boolean }) {
  return (
    <group>
      {MODULES.map((def) => (
        <ModuleCard key={def.id} def={def} reduced={reduced} />
      ))}
    </group>
  );
}
