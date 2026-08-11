"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { MODULES, moduleBeatOffset } from "@/lib/story";
import { beat, damp, rangeOf, scroll, smooth } from "@/lib/scroll";
import { tourAmount, tourIndex } from "./modules";

/**
 * The camera path.
 *
 * Position is interpolated between per-beat waypoints, then damped. The look
 * target is damped separately and more slowly — a camera whose aim snaps ahead
 * of its body reads as a glitch, while a slight lag reads as weight.
 */
export function Rig({ reduced }: { reduced: boolean }) {
  const pointer = useRef({ x: 0, y: 0 });

  // Per-instance scratch. Module-level vectors mutated from useFrame trip the
  // React Compiler purity rule, and would be shared state if the rig ever
  // rendered twice.
  const vecs = useRef({
    target: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
    currentLook: new THREE.Vector3(0, 0, 0),
  });

  useFrame((state, delta) => {
    const { target, lookTarget, currentLook } = vecs.current;
    // Taken off the frame state rather than useThree(): driving the camera
    // imperatively is the R3F pattern, but a hook return is not allowed to be
    // mutated under the compiler's immutability rule.
    const { camera } = state;
    const dt = Math.min(delta, 1 / 30);
    const p = scroll.progress;

    // --- ring view ---------------------------------------------------------
    // Ten cards on a 4.75 ring spans ~11 units tall including card height,
    // which needs ~14.5 units of distance at fov 42 to clear top and bottom.
    // All ranges are measured from the real section layout (see lib/scroll.ts)
    const [openFrom] = rangeOf("open");
    const [, problemsTo] = rangeOf("problems");
    const [gapFrom, gapTo] = rangeOf("problems-2");
    const [assemblyFrom] = rangeOf("assembly");
    const [closeFrom] = rangeOf("close");

    const pullBack = beat(p, openFrom, problemsTo);
    const throughGap = beat(p, gapFrom, gapTo) * (1 - beat(p, assemblyFrom, assemblyFrom + 0.03));
    const retreat = beat(p, closeFrom, 1);

    let x = throughGap * 2.4;
    let y = throughGap * -0.7;
    let z = 3.6 + pullBack * 11;

    // --- module tour -------------------------------------------------------
    // Continuous index across the ring, so the camera glides from card to card
    // rather than cutting.
    const f = tourIndex(p);
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, MODULES.length - 1);
    const frac = smooth(f - i0);

    const cardX = THREE.MathUtils.lerp(
      MODULES[i0].assembled[0],
      MODULES[i1].assembled[0],
      frac,
    );
    const cardY = THREE.MathUtils.lerp(
      MODULES[i0].assembled[1],
      MODULES[i1].assembled[1],
      frac,
    );

    // Ramps in just before the first card and out just after the last, so the
    // ring view either side stays clean.
    const touring = tourAmount(p);

    // Park the focused card in the half the copy column isn't using, instead
    // of dead centre where it sat behind the text — or, mid-transition, ran
    // off the edge of the viewport with its own words clipped.
    // Even-indexed beats put the copy left, odd put it right.
    const beatIndex = moduleBeatOffset() + Math.round(f);
    const copyOnRight = beatIndex % 2 === 1;

    // 1.6, not 2.5. The card is 2.35 wide, so at 2.5 its outer edge overshot
    // the frustum and the words clipped off the far side instead of the near
    // one — the same symptom, mirrored.
    const shift = (copyOnRight ? 1 : -1) * 1.6;

    x = THREE.MathUtils.lerp(x, cardX + shift, touring);
    y = THREE.MathUtils.lerp(y, cardY, touring);
    // The focused card steps 3.4 toward the camera. 8.2 leaves ~4.35 of
    // clearance, enough that a 2.35-wide card offset 1.6 sits fully inside
    // the frustum with margin.
    z = THREE.MathUtils.lerp(z, 8.2, touring);

    // Final pull out to show the whole assembled system
    z += retreat * 3.2;
    x *= 1 - retreat;
    y *= 1 - retreat;

    target.set(x, y, z);

    if (!reduced) {
      // Parallax — decorative, so it gets a damped mapping rather than 1:1.
      // Tying rotation directly to the pointer feels robotic.
      target.x += pointer.current.x * 0.42;
      target.y += pointer.current.y * 0.3;

      // Lean into the direction of travel. Small: 0.4 units at full tilt.
      target.y -= THREE.MathUtils.clamp(scroll.velocity * 0.012, -0.4, 0.4);
    }

    // Track faster during the tour. At 2.6 the camera lagged so far behind a
    // normal scroll that the focused card was still sliding in from the edge
    // — clipped, with its own copy cut off — by the time you were reading
    // about it.
    const lambda = 2.6 + touring * 2.6;
    camera.position.x = damp(camera.position.x, target.x, lambda, dt);
    camera.position.y = damp(camera.position.y, target.y, lambda, dt);
    camera.position.z = damp(camera.position.z, target.z, lambda, dt);

    // Aim: centre for the ring beats, the focused card during the tour.
    // The same shift is applied here so the card holds its off-centre spot
    // rather than being pulled back to the middle by the look direction.
    lookTarget.set(
      (cardX + shift) * touring,
      cardY * touring - retreat * 1.2,
      touring * 2.6,
    );

    const lookLambda = 2.2 + touring * 2.4;
    currentLook.x = damp(currentLook.x, lookTarget.x, lookLambda, dt);
    currentLook.y = damp(currentLook.y, lookTarget.y, lookLambda, dt);
    currentLook.z = damp(currentLook.z, lookTarget.z, lookLambda, dt);
    camera.lookAt(currentLook);

    // Pointer is read from frame state rather than a listener, to stay in loop
    pointer.current.x = damp(pointer.current.x, state.pointer.x, 2.2, dt);
    pointer.current.y = damp(pointer.current.y, state.pointer.y, 2.2, dt);
  });

  return null;
}
