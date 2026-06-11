import { Suspense } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import {
  EffectComposer,
  N8AO,
  Bloom,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import CarModel from "./CarModel";
import CameraRig from "./CameraRig";
import EnvironmentStage from "./EnvironmentStage";
import { useStore } from "../state/store";

/** Full-bleed 3D studio. Everything inside reacts only to CarConfig. */
export default function Experience() {
  const setCapture = useStore((s) => s.setCapture);
  // Per-environment tone mapping: V1's ACESFilmic look in the studio,
  // Khronos Neutral in the HDRI locations. The EffectComposer forces the
  // renderer to NoToneMapping, so this MUST be a composer effect — setting
  // gl.toneMapping does nothing while the composer is mounted.
  const environment = useStore((s) => s.config.environment);

  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [8.5, 3.2, 10.5], fov: 38, near: 0.05, far: 250 }}
      gl={{
        antialias: false,
        preserveDrawingBuffer: true,
        toneMappingExposure: 1.0,
      }}
      onCreated={(state) => {
        setCapture(() => state.gl.domElement.toDataURL("image/jpeg", 0.85));
        if (import.meta.env.DEV) {
          (window as any).__three = state;
          console.log("[studio] canvas created");
        }
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[5, 9, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
      />
      <directionalLight position={[-6, 5, -6]} intensity={0.4} color="#bcd0ff" />

      <EnvironmentStage />

      <Suspense fallback={null}>
        <CarModel />
        <CameraRig />
        <ContactShadows
          position={[0, 0.001, 0]}
          scale={11}
          blur={2.4}
          opacity={0.7}
          far={3.2}
          resolution={512}
          frames={Infinity}
          color="#000000"
        />
      </Suspense>

      <EffectComposer multisampling={4}>
        <N8AO aoRadius={0.35} intensity={2.5} distanceFalloff={1} quality="medium" halfRes />
        <Bloom mipmapBlur intensity={0.12} luminanceThreshold={1.1} />
        <ToneMapping
          mode={
            environment === "studio"
              ? ToneMappingMode.ACES_FILMIC
              : ToneMappingMode.NEUTRAL
          }
        />
        <Vignette eskil={false} offset={0.18} darkness={0.5} />
      </EffectComposer>
    </Canvas>
  );
}
