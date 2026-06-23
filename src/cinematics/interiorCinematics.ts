import type { InteriorColorId, InteriorConfig, InteriorMaterial } from "../state/store";

export interface InteriorCinematicVariant {
  id: `${InteriorMaterial}-${InteriorColorId}`;
  label: string;
  view: "interior";
  interior: InteriorConfig;
  basePath: string;
  frameCount: number;
  fps: number;
  width: number;
  height: number;
  firstFrame: string;
  frames: string[];
}

export function createFrameUrls(basePath: string, frameCount: number): string[] {
  return Array.from(
    { length: frameCount },
    (_, i) => `${basePath}/frame_${String(i + 1).padStart(4, "0")}.jpg`,
  );
}

const makeVariant = (
  variant: Omit<InteriorCinematicVariant, "firstFrame" | "frames" | "view">,
): InteriorCinematicVariant => {
  const frames = createFrameUrls(variant.basePath, variant.frameCount);
  return {
    ...variant,
    view: "interior",
    firstFrame: frames[0],
    frames,
  };
};

export const INTERIOR_CINEMATIC_VARIANTS: InteriorCinematicVariant[] = [
  makeVariant({
    id: "leather-cognac",
    label: "Cognac leather cinematic interior",
    interior: { material: "leather", color: "cognac" },
    basePath: "/cinematics/interior/leather-cognac",
    frameCount: 60,
    fps: 7.5,
    width: 1920,
    height: 993,
  }),
  makeVariant({
    id: "leather-obsidian",
    label: "Obsidian leather cinematic interior",
    interior: { material: "leather", color: "obsidian" },
    basePath: "/cinematics/interior/leather-obsidian",
    frameCount: 60,
    fps: 7.5,
    width: 1920,
    height: 993,
  }),
];

export function getInteriorCinematicVariant(
  interior: InteriorConfig,
): InteriorCinematicVariant | null {
  return (
    INTERIOR_CINEMATIC_VARIANTS.find(
      (variant) =>
        variant.interior.material === interior.material &&
        variant.interior.color === interior.color,
    ) ?? null
  );
}
