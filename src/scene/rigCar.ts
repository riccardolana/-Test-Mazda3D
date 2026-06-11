import * as THREE from "three";
import type { DoorKey, ViewName } from "../state/store";

/* ------------------------------------------------------------------ */
/* Discovers the car's parts from the GLB node hierarchy, wraps the    */
/* animatable ones in pivot groups (hinges at door edges, axles at     */
/* wheel centers) and computes camera presets — all data-driven from   */
/* world-space bounding boxes. Offsets and hinge axes are converted    */
/* into each pivot's parent-local space, so nested nodes with baked    */
/* unit scales or Y-up rotations (this GLB parents everything under    */
/* a millimetre-scaled "Body" node) animate correctly.                 */
/* ------------------------------------------------------------------ */

export const NAME_MAP = {
  body: "Body",
  undercarriage: "Undercarriage",
  headlights: "Headlights",
  taillights: "Taillights",
  interior: "Interior",
  seats: "Seats",
  steeringWheel: "SteeringWheel",
  doors: {
    frontLeft: "DoorFrLeft",
    frontRight: "DoorFrRight",
    rearLeft: "DoorRearLeft",
    rearRight: "DoorRearRight",
    trunk: "DoorTrunk",
  } as Record<DoorKey, string>,
  wheels: ["WheelFrLeft", "WheelFrRight", "WheelRearLeft", "WheelRearRight"],
};

export const NORMALIZED_LENGTH = 4.6; // car length in scene units after normalization

export interface DoorRig {
  key: DoorKey;
  group: THREE.Group;
  /** hinge axis in the pivot's parent-local space */
  localAxis: THREE.Vector3;
  openAngle: number;
  /** current damped angle, mutated each frame */
  angle: number;
}

export interface PartRig {
  group: THREE.Group;
  home: THREE.Vector3;   // parent-local
  staged: THREE.Vector3; // parent-local
  step: number;          // assemblyStep at which this part flies home
  roll?: {
    localAxis: THREE.Vector3;      // spin axis, parent-local
    localTravelDir: THREE.Vector3; // travel direction, parent-local
    radiusLocal: number;           // wheel radius in parent-local units
  };
}

export interface CameraPreset {
  pos: [number, number, number];
  target: [number, number, number];
}

export interface CarRig {
  doorRigs: DoorRig[];
  partRigs: PartRig[];
  paint: THREE.MeshPhysicalMaterial;
  /** live interior materials (seats, door cards); userData.leatherNormal holds the original grain map */
  cabinMats: THREE.MeshPhysicalMaterial[];
  presets: Record<ViewName, CameraPreset>;
  /** wrapper transform that normalizes the car: front → +Z, floor at y=0, centered */
  wrapper: { rotationY: number; scale: number; position: [number, number, number] };
}

function worldBox(obj: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(obj);
}

/** Re-parent `obj` into a new group whose origin sits at `pivotWorld`. */
function makePivot(
  scene: THREE.Object3D,
  obj: THREE.Object3D,
  pivotWorld: THREE.Vector3,
): THREE.Group {
  scene.updateMatrixWorld(true);
  const parent = obj.parent!;
  const g = new THREE.Group();
  g.name = `${obj.name}_pivot`;
  g.position.copy(parent.worldToLocal(pivotWorld.clone()));
  parent.add(g);
  g.updateMatrixWorld(true);
  g.attach(obj); // preserves world transform
  return g;
}

/** World-space direction → parent-local direction (normalized). */
function dirToLocal(parent: THREE.Object3D, worldDir: THREE.Vector3): THREE.Vector3 {
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  return worldDir.clone().transformDirection(inv);
}

/** World-space point → parent-local point. */
function ptToLocal(parent: THREE.Object3D, worldPt: THREE.Vector3): THREE.Vector3 {
  return parent.worldToLocal(worldPt.clone());
}

export function rigCar(scene: THREE.Group): CarRig {
  // useGLTF caches the scene; never rig the same instance twice.
  if (scene.userData.carRig) return scene.userData.carRig as CarRig;

  scene.updateMatrixWorld(true);
  const find = (name: string) => scene.getObjectByName(name) ?? null;

  /* --- orientation discovery (raw world space, Y-up) ---------------- */
  const carBox = worldBox(scene);
  const size = carBox.getSize(new THREE.Vector3());
  const center = carBox.getCenter(new THREE.Vector3());
  const lengthAxis: "x" | "z" = size.x > size.z ? "x" : "z";
  const latAxis: "x" | "z" = lengthAxis === "x" ? "z" : "x";

  const headlights = find(NAME_MAP.headlights);
  const headCenter = headlights
    ? worldBox(headlights).getCenter(new THREE.Vector3())
    : center.clone().setComponent(lengthAxis === "x" ? 0 : 2, carBox.max[lengthAxis]);
  const frontSign = Math.sign(headCenter[lengthAxis] - center[lengthAxis]) || 1;

  const frontDir = new THREE.Vector3();
  frontDir[lengthAxis] = frontSign;
  const upDir = new THREE.Vector3(0, 1, 0);

  /* --- paint material ---------------------------------------------- */
  const paint = new THREE.MeshPhysicalMaterial({
    name: "CarPaintLive",
    color: new THREE.Color("#a01e22"),
    metalness: 0.8,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.3,
  });
  const cabinCache = new Map<string, THREE.MeshPhysicalMaterial>();
  const cabinMats: THREE.MeshPhysicalMaterial[] = [];
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const mesh = o as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const swap = (m: THREE.Material): THREE.Material => {
      if (m.name === "CarPaint") return paint;
      if (/^intLeather(Dark|Lt|PerfLt)$/.test(m.name)) {
        let live = cabinCache.get(m.name);
        if (!live) {
          const src = m as THREE.MeshStandardMaterial;
          live = new THREE.MeshPhysicalMaterial({
            name: `CabinLive_${m.name}`,
            color: new THREE.Color("#1a191c"),
            roughness: 0.5,
            metalness: 0,
            normalMap: src.normalMap ?? undefined,
          });
          if (src.normalScale) live.normalScale.copy(src.normalScale);
          live.userData.leatherNormal = src.normalMap ?? null;
          live.userData.srcMap = src.map ?? null;
          live.userData.srcNormalScale = live.normalScale.clone();
          cabinCache.set(m.name, live);
          cabinMats.push(live);
        }
        return live;
      }
      // safety net for glass exported opaque
      const std = m as THREE.MeshStandardMaterial;
      if (/glasswind|intglassclear/i.test(m.name) && !std.transparent) {
        std.transparent = true;
        std.opacity = 0.32;
        std.roughness = 0.05;
        std.metalness = 0;
        std.depthWrite = false;
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(swap)
      : swap(mesh.material);
  });

  /* --- door hinges -------------------------------------------------- */
  const doorRigs: DoorRig[] = [];
  const partRigs: PartRig[] = [];
  const sideDoorYawSign = lengthAxis === "z" ? -1 : 1;

  (Object.keys(NAME_MAP.doors) as DoorKey[]).forEach((key) => {
    const obj = find(NAME_MAP.doors[key]);
    if (!obj) return;
    const box = worldBox(obj);
    const c = box.getCenter(new THREE.Vector3());

    if (key === "trunk") {
      // liftgate: hinge along the top edge, toward the roof
      const pivot = c.clone();
      pivot.y = box.max.y;
      pivot[lengthAxis] = frontSign > 0 ? box.max[lengthAxis] : box.min[lengthAxis];
      const g = makePivot(scene, obj, pivot);
      const liftSign = lengthAxis === "z" ? frontSign : -frontSign;
      const latDir = new THREE.Vector3();
      latDir[latAxis] = 1;
      doorRigs.push({
        key,
        group: g,
        localAxis: dirToLocal(g.parent!, latDir),
        openAngle: liftSign * 1.15,
        angle: 0,
      });
      const stagedWorld = pivot
        .clone()
        .addScaledVector(frontDir, -size[lengthAxis] * 0.55)
        .addScaledVector(upDir, size.y * 0.55);
      partRigs.push({
        group: g,
        home: g.position.clone(),
        staged: ptToLocal(g.parent!, stagedWorld),
        step: 4,
      });
    } else {
      // side door: hinge along the vertical front edge
      const pivot = c.clone();
      pivot[lengthAxis] = frontSign > 0 ? box.max[lengthAxis] : box.min[lengthAxis];
      const g = makePivot(scene, obj, pivot);
      const outward = Math.sign(c[latAxis] - center[latAxis]) || 1;
      doorRigs.push({
        key,
        group: g,
        localAxis: dirToLocal(g.parent!, upDir),
        openAngle: sideDoorYawSign * outward * frontSign * 0.95,
        angle: 0,
      });
      const lateral = new THREE.Vector3();
      lateral[latAxis] = outward;
      const stagedWorld = pivot.clone().addScaledVector(lateral, size[latAxis] * 0.95);
      partRigs.push({
        group: g,
        home: g.position.clone(),
        staged: ptToLocal(g.parent!, stagedWorld),
        step: 4,
      });
    }
  });

  /* --- wheels ------------------------------------------------------- */
  let frontLeftWheelCenter: THREE.Vector3 | null = null;
  NAME_MAP.wheels.forEach((name) => {
    const obj = find(name);
    if (!obj) return;
    const box = worldBox(obj);
    const c = box.getCenter(new THREE.Vector3());
    const radiusWorld = (box.max.y - box.min.y) / 2;
    const g = makePivot(scene, obj, c);
    const parentScale = g.parent!.getWorldScale(new THREE.Vector3()).x || 1;
    const isFront = Math.sign(c[lengthAxis] - center[lengthAxis]) === frontSign;
    if (name === "WheelFrLeft") frontLeftWheelCenter = c.clone();
    const latDir = new THREE.Vector3();
    latDir[latAxis] = 1;
    const stagedWorld = c
      .clone()
      .addScaledVector(frontDir, (isFront ? 1 : -1) * size[lengthAxis] * 1.05);
    partRigs.push({
      group: g,
      home: g.position.clone(),
      staged: ptToLocal(g.parent!, stagedWorld),
      step: 2,
      roll: {
        localAxis: dirToLocal(g.parent!, latDir),
        localTravelDir: dirToLocal(g.parent!, frontDir),
        radiusLocal: radiusWorld / parentScale,
      },
    });
  });

  /* --- body / interior / lights ------------------------------------ */
  const rigPart = (name: string, step: number, offsetWorld: THREE.Vector3) => {
    const obj = find(name);
    if (!obj) return;
    const c = worldBox(obj).getCenter(new THREE.Vector3());
    const g = makePivot(scene, obj, c);
    partRigs.push({
      group: g,
      home: g.position.clone(),
      staged: ptToLocal(g.parent!, c.clone().add(offsetWorld)),
      step,
    });
  };

  rigPart(NAME_MAP.body, 1, new THREE.Vector3(0, size.y * 1.6, 0));
  rigPart(NAME_MAP.undercarriage, 1, new THREE.Vector3(0, size.y * 1.6, 0));
  rigPart(NAME_MAP.interior, 3, new THREE.Vector3(0, size.y * 1.5, 0));
  rigPart(NAME_MAP.seats, 3, new THREE.Vector3(0, size.y * 1.1, 0));
  rigPart(NAME_MAP.headlights, 4, frontDir.clone().multiplyScalar(size[lengthAxis] * 0.4));
  rigPart(NAME_MAP.taillights, 4, frontDir.clone().multiplyScalar(-size[lengthAxis] * 0.4));

  /* --- normalization wrapper: front → +Z, floor y=0, centered ------- */
  let rotationY = 0;
  if (lengthAxis === "z") rotationY = frontSign > 0 ? 0 : Math.PI;
  else rotationY = frontSign > 0 ? -Math.PI / 2 : Math.PI / 2;
  const scale = NORMALIZED_LENGTH / size[lengthAxis];

  const norm = new THREE.Matrix4().makeRotationY(rotationY);
  const corners: THREE.Vector3[] = [];
  for (const x of [carBox.min.x, carBox.max.x])
    for (const y of [carBox.min.y, carBox.max.y])
      for (const z of [carBox.min.z, carBox.max.z])
        corners.push(new THREE.Vector3(x, y, z).applyMatrix4(norm));
  const rBox = new THREE.Box3().setFromPoints(corners);
  const rCenter = rBox.getCenter(new THREE.Vector3());
  const position: [number, number, number] = [
    -rCenter.x * scale,
    -rBox.min.y * scale,
    -rCenter.z * scale,
  ];

  /** raw world space → normalized scene space */
  const toScene = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0)),
    new THREE.Vector3(scale, scale, scale),
  );

  /* --- camera presets (normalized space) ---------------------------- */
  const steering = find(NAME_MAP.steeringWheel);
  const steerC = steering
    ? worldBox(steering).getCenter(new THREE.Vector3()).applyMatrix4(toScene)
    : new THREE.Vector3(-0.36, 0.95, 0.6);
  const wheelC = (frontLeftWheelCenter
    ? (frontLeftWheelCenter as THREE.Vector3).clone()
    : new THREE.Vector3(0.8, 0.35, 1.4)
  ).applyMatrix4(toScene);

  const presets: Record<ViewName, CameraPreset> = {
    exterior: { pos: [3.3, 1.45, 4.5], target: [0, 0.62, 0] },
    front: { pos: [0.5, 1.05, 5.6], target: [0, 0.68, 0.3] },
    rear: { pos: [-0.7, 1.5, -5.5], target: [0, 0.72, -0.4] },
    trunk: { pos: [0, 1.75, -4.9], target: [0, 0.8, -1.5] },
    wheels: {
      pos: [wheelC.x + Math.sign(wheelC.x || 1) * 1.7, 0.65, wheelC.z + 1.5],
      target: [wheelC.x, wheelC.y, wheelC.z],
    },
    interior: {
      // between the front headrests, looking over the dash and console
      pos: [steerC.x * 0.55, steerC.y + 0.28, steerC.z - 0.72],
      target: [0, steerC.y - 0.12, steerC.z + 1.6],
    },
  };

  const rig: CarRig = {
    doorRigs,
    partRigs,
    paint,
    cabinMats,
    presets,
    wrapper: { rotationY, scale, position },
  };
  scene.userData.carRig = rig;
  return rig;
}
