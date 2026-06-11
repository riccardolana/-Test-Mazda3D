import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import CarModel from "./CarModel";
import CameraRig from "./CameraRig";
import { useStore } from "../state/store";

/** Full-bleed 3D studio. Everything inside reacts only to CarConfig. */
export default function Experience() {
  const setCapture = useStore((s) => s.setCapture);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [8.5, 3.2, 10.5], fov: 38, near: 0.05, far: 120 }}
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
      <color attach="background" args={["#0a0a0d"]} />
      <fog attach="fog" args={["#0a0a0d", 16, 40]} />

      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 9, 4]} intensity={1.1} />
      <directionalLight position={[-6, 5, -6]} intensity={0.4} color="#bcd0ff" />

      {/* procedural studio reflections — no external HDRI, works offline */}
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
