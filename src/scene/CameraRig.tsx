import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CameraControls, useGLTF } from "@react-three/drei";
import { easing } from "maath";
import { useStore } from "../state/store";
import { rigCar } from "./rigCar";
import { MODEL_URL } from "./CarModel";

/** Animated camera with named presets per CarConfig.view + idle turntable. */
export default function CameraRig() {
  const { scene } = useGLTF(MODEL_URL);
  const rig = useMemo(() => rigCar(scene as unknown as THREE.Group), [scene]);
  const controls = useRef<CameraControls>(null);
  const view = useStore((s) => s.config.view);
  const driving = useStore((s) => s.config.driving);
  const started = useStore((s) => s.started);
  const lastInteract = useRef(0);
  // drive-mode auto-orbit: armed each time drive mode starts, disarmed by
  // any user control input (same event the idle turntable listens to)
  const driveOrbit = useRef(false);

  useEffect(() => {
    driveOrbit.current = driving;
  }, [driving]);

  // keep panning within the studio
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.setBoundary(
      new THREE.Box3(new THREE.Vector3(-5, 0.1, -5), new THREE.Vector3(5, 3, 5)),
    );
  }, []);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (!started) {
      // dramatic wide opening shot while the intro overlay is up
      c.setLookAt(8.5, 3.2, 10.5, 0, 0.7, 0, false);
      return;
    }
    const apply = (animate: boolean) => {
      if (driving) {
        // rear-quarter chase shot: car front faces +Z, so sit behind/left
        c.minDistance = 2.4;
        c.maxDistance = 20;
        c.setLookAt(3.4, 1.4, -5.8, 0, 0.8, 1.4, animate);
        return;
      }
      c.minDistance = view === "interior" ? 0.05 : view === "wheels" ? 1.2 : 2.4;
      c.maxDistance = 16;
      const p = rig.presets[view];
      // presets are tuned for landscape; back off in portrait so the car fits
      const cam = c.camera as THREE.PerspectiveCamera;
      const zoomOut =
        view !== "interior" && cam.aspect < 1
          ? Math.min(1.9, 1 + (1 - cam.aspect) * 1.2)
          : 1;
      c.setLookAt(
        p.target[0] + (p.pos[0] - p.target[0]) * zoomOut,
        p.target[1] + (p.pos[1] - p.target[1]) * zoomOut,
        p.target[2] + (p.pos[2] - p.target[2]) * zoomOut,
        p.target[0],
        p.target[1],
        p.target[2],
        animate,
      );
    };
    apply(true);
    const onResize = () => apply(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [view, rig, started, driving]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const s = useStore.getState();
    const idle = performance.now() - lastInteract.current > 6000;
    const turntable =
      s.assembling ||
      (idle &&
        s.started &&
        s.config.view === "exterior" &&
        !s.config.driving &&
        !s.bookingOpen);
    if (turntable) c.azimuthAngle += delta * 0.07;

    // while driving, slowly pan around the moving car until the user takes over
    if (s.config.driving && s.started && driveOrbit.current && !s.bookingOpen) {
      c.azimuthAngle += delta * 0.12;
    }

    // wider lens inside the cabin
    const cam = c.camera as THREE.PerspectiveCamera;
    const targetFov = s.config.view === "interior" ? 54 : 38;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      easing.damp(cam, "fov", targetFov, 0.35, delta);
      cam.updateProjectionMatrix();
    }
  });

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.55}
      maxPolarAngle={1.52}
      onStart={() => {
        lastInteract.current = performance.now();
        driveOrbit.current = false; // user takes over — stop the drive orbit
      }}
    />
  );
}
