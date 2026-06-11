import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import CarModel from "./CarModel";
import CameraRig from "./CameraRig";
import EnvironmentStage from "./EnvironmentStage";
import { useStore } from "../state/store";

/** Full-bleed 3D studio. Everything inside reacts only to CarConfig. */
export default function Experience() {
  const setCapture = useStore((s) => s.setCapture);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [8.5, 3.2, 10.5], fov: 38, near: 0.05, far: 250 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
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
      <directionalLight position={[5, 9, 4]} intensity={1.1} />
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
    </Canvas>
  );
}
