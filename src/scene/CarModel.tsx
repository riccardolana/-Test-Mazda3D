import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { easing } from "maath";
import { ASSEMBLY_DONE, useStore } from "../state/store";
import { PAINTS } from "../state/palette";
import { rigCar } from "./rigCar";

export const MODEL_URL = "/models/mazda-cx5.glb";

const tmpColor = new THREE.Color();
const tmpVec = new THREE.Vector3();

export default function CarModel() {
  const { scene } = useGLTF(MODEL_URL);
  const rig = useMemo(() => rigCar(scene as unknown as THREE.Group), [scene]);

  // Place parts according to the current assembly step on mount so a
  // reload doesn't replay the fly-in.
  useMemo(() => {
    const step = useStore.getState().config.assemblyStep;
    rig.partRigs.forEach((p) => {
      p.group.position.copy(step >= p.step ? p.home : p.staged);
    });
  }, [rig]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20); // avoid jumps after tab switches
    const { config } = useStore.getState();

    // 1. paint — tween the shared CarPaint material
    tmpColor.set(PAINTS[config.color].hex);
    easing.dampC(rig.paint.color, tmpColor, 0.25, delta);

    // 2. doors / tailgate — eased hinge rotation around parent-local axes
    const built = config.assemblyStep >= ASSEMBLY_DONE;
    rig.doorRigs.forEach((d) => {
      const target = built && config.doors[d.key] ? d.openAngle : 0;
      easing.damp(d, "angle", target, 0.18, delta);
      d.group.quaternion.setFromAxisAngle(d.localAxis, d.angle);
    });

    // 3. assembly — parts damp between staged and home positions
    rig.partRigs.forEach((p) => {
      const target = config.assemblyStep >= p.step ? p.home : p.staged;
      easing.damp3(p.group.position, target, 0.4, delta);
      if (p.roll) {
        tmpVec.copy(p.group.position).sub(p.home);
        const travel = tmpVec.dot(p.roll.localTravelDir);
        p.group.quaternion.setFromAxisAngle(p.roll.localAxis, -travel / p.roll.radiusLocal);
      }
    });
  });

  return (
    <group
      position={rig.wrapper.position}
      rotation-y={rig.wrapper.rotationY}
      scale={rig.wrapper.scale}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
