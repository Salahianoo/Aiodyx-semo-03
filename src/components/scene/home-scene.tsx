"use client";

import { Modules } from "./modules";
import { Connections, Core } from "./connections";
import { Rig } from "./rig";
import { Starfield } from "./starfield";

/** The home story: eight scattered apps assembling into one wired ring. */
export function HomeScene({ reduced }: { reduced: boolean }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      <pointLight position={[0, 0, 1.5]} intensity={2.2} color="#8B5CF6" />

      <Starfield reduced={reduced} />
      <Connections />
      <Core reduced={reduced} />
      <Modules reduced={reduced} />

      <Rig reduced={reduced} />
    </>
  );
}
