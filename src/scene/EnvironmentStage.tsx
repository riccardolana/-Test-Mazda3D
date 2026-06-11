import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useTexture } from "@react-three/drei";
import { DRIVE_SPEED, useStore } from "../state/store";
import type { EnvironmentId } from "../state/store";

/* ------------------------------------------------------------------ */
/* The surroundings react ONLY to config.environment / config.driving. */
/* Studio = dark backdrop lit by a local studio HDRI (offline-safe).   */
/* Locations = a local HDRI backdrop + tiled ground that scrolls in    */
/* drive mode. HDRIs live in /public/hdri — still zero network calls.  */
/* ------------------------------------------------------------------ */

const GROUND_SIZE = 220;
const GROUND_REPEAT = 56;

interface LocationSpec {
  hdri: string;
  fog: [string, number, number];
  groundColor: string;
  groundTex: string;
  groundNormal: string;
}

const LOCATIONS: Record<Exclude<EnvironmentId, "studio">, LocationSpec> = {
  mountain: {
    hdri: "/hdri/mountain_2k.hdr",
    fog: ["#aab4be", 30, 110],
    groundColor: "#8f897c",
    groundTex: "/textures/gravel_color.jpg",
    groundNormal: "/textures/gravel_normal.jpg",
  },
  city: {
    hdri: "/hdri/city_2k.hdr",
    fog: ["#b9bfc4", 26, 95],
    groundColor: "#85868a",
    groundTex: "/textures/asphalt_color.jpg",
    groundNormal: "/textures/asphalt_normal.jpg",
  },
  coast: {
    hdri: "/hdri/coast_2k.hdr",
    fog: ["#cfd8dd", 32, 120],
    groundColor: "#9a948b",
    groundTex: "/textures/asphalt_color.jpg",
    groundNormal: "/textures/asphalt_normal.jpg",
  },
};

function Location({ id }: { id: Exclude<EnvironmentId, "studio"> }) {
  const spec = LOCATIONS[id];
  const maps = useTexture({ map: spec.groundTex, normalMap: spec.groundNormal });

  useMemo(() => {
    Object.values(maps).forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
      t.anisotropy = 8;
    });
    maps.map.colorSpace = THREE.SRGBColorSpace;
  }, [maps]);

  // drive mode: scroll the ground texture under the car (car faces +Z)
  useFrame((_, delta) => {
    if (!useStore.getState().config.driving) return;
    const move = (delta * DRIVE_SPEED) / (GROUND_SIZE / GROUND_REPEAT);
    maps.map.offset.y -= move;
    maps.normalMap.offset.y -= move;
  });

  return (
    <>
      <Environment files={spec.hdri} background backgroundBlurriness={0.04} />
      <fog attach="fog" args={spec.fog} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial
          color={spec.groundColor}
          map={maps.map}
          normalMap={maps.normalMap}
          roughness={0.95}
          metalness={0}
        />
      </mesh>
    </>
  );
}

function Studio() {
  return (
    <>
      <color attach="background" args={["#0a0a0d"]} />
      <fog attach="fog" args={["#0a0a0d", 16, 40]} />
      {/* procedural studio reflections (V1 rig) — no external HDRI, works offline */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={5}
          position={[0, 7, 0]}
          rotation-x={Math.PI / 2}
          scale={[11, 11, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          position={[-9, 2.4, 0]}
          rotation-y={Math.PI / 2}
          scale={[9, 2.2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          position={[9, 2.4, 0]}
          rotation-y={-Math.PI / 2}
          scale={[9, 2.2, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[0, 3, -10]}
          scale={[10, 2.4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.8}
          position={[0, 2.4, 10]}
          rotation-y={Math.PI}
          scale={[8, 2, 1]}
        />
      </Environment>
      {/* studio floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]}>
        <circleGeometry args={[34, 64]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.95} metalness={0} />
      </mesh>
    </>
  );
}

export default function EnvironmentStage() {
  const env = useStore((s) => s.config.environment);
  if (env === "studio") return <Studio />;
  return (
    <Suspense fallback={<Studio />}>
      <Location key={env} id={env} />
    </Suspense>
  );
}
