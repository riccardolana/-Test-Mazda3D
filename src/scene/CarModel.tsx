import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { easing } from "maath";
import { ASSEMBLY_DONE, DRIVE_SPEED, useStore } from "../state/store";
import { INTERIOR_COLORS, PAINTS } from "../state/palette";
import { rigCar } from "./rigCar";

export const MODEL_URL = "/models/mazda-cx5.glb";

const tmpColor = new THREE.Color();
const tmpVec = new THREE.Vector3();

export default function CarModel() {
  const { scene } = useGLTF(MODEL_URL);
  const rig = useMemo(() => rigCar(scene as unknown as THREE.Group), [scene]);
  const root = useRef<THREE.Group>(null);
  const driveDist = useRef(0);

  const fabricNormal = useTexture("/textures/fabric_normal.jpg");
  useMemo(() => {
    fabricNormal.wrapS = fabricNormal.wrapT = THREE.RepeatWrapping;
    fabricNormal.repeat.set(4, 4);
  }, [fabricNormal]);

  // Place parts according to the current assembly step on mount so a
  // reload doesn't replay the fly-in.
  useMemo(() => {
    const step = useStore.getState().config.assemblyStep;
    rig.partRigs.forEach((p) => {
      p.group.position.copy(step >= p.step ? p.home : p.staged);
    });
  }, [rig]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20); // avoid jumps after tab switches
    const { config } = useStore.getState();
    const built = config.assemblyStep >= ASSEMBLY_DONE;

    // 1. paint — tween the shared CarPaint material
    tmpColor.set(PAINTS[config.color].hex);
    easing.dampC(rig.paint.color, tmpColor, 0.25, delta);

    // 2. cabin — tint + leather/cloth surface response
    const cloth = config.interior.material === "cloth";
    tmpColor.set(INTERIOR_COLORS[config.interior.color].hex);
    rig.cabinMats.forEach((m) => {
      easing.dampC(m.color, tmpColor, 0.25, delta);
      easing.damp(m, "roughness", cloth ? 0.92 : 0.5, 0.25, delta);
      const wantNormal = cloth
        ? fabricNormal
        : ((m.userData.leatherNormal as THREE.Texture | null) ?? null);
      if (m.normalMap !== wantNormal) {
        m.normalMap = wantNormal;
        m.needsUpdate = true;
      }
      m.sheen = cloth ? 0.5 : 0;
      if (cloth) m.sheenColor.set("#ffffff");
    });

    // 3. doors / tailgate — eased hinge rotation around parent-local axes
    rig.doorRigs.forEach((d) => {
      const target = built && config.doors[d.key] ? d.openAngle : 0;
      easing.damp(d, "angle", target, 0.18, delta);
      d.group.quaternion.setFromAxisAngle(d.localAxis, d.angle);
    });

    // 4. drive mode — wheels keep spinning, body gets a gentle road bob
    if (config.driving && built) driveDist.current += delta * DRIVE_SPEED;
    if (root.current) {
      const t = state.clock.elapsedTime;
      const bobY = config.driving && built ? Math.sin(t * 11) * 0.006 : 0;
      const bobPitch = config.driving && built ? Math.sin(t * 7.3) * 0.0035 : 0;
      easing.damp(root.current.position, "y", rig.wrapper.position[1] + bobY, 0.12, delta);
      easing.damp(root.current.rotation, "x", bobPitch, 0.12, delta);
    }

    // 5. assembly — parts damp between staged and home positions
    rig.partRigs.forEach((p) => {
      const target = config.assemblyStep >= p.step ? p.home : p.staged;
      easing.damp3(p.group.position, target, 0.4, delta);
      if (p.roll) {
        tmpVec.copy(p.group.position).sub(p.home);
        const travel = tmpVec.dot(p.roll.localTravelDir);
        p.group.quaternion.setFromAxisAngle(
          p.roll.localAxis,
          -(travel + driveDist.current) / p.roll.radiusLocal,
        );
      }
    });
  });

  return (
    <group
      ref={root}
      position={rig.wrapper.position}
      rotation-y={rig.wrapper.rotationY}
      scale={rig.wrapper.scale}
    >
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
