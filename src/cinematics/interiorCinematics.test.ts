import { describe, expect, it } from "vitest";
import { createFrameUrls, getInteriorCinematicVariant } from "./interiorCinematics";

describe("interior cinematic variants", () => {
  it("matches the primary cognac leather interior variant", () => {
    const variant = getInteriorCinematicVariant({ material: "leather", color: "cognac" });

    expect(variant?.id).toBe("leather-cognac");
    expect(variant?.firstFrame).toBe(
      "/cinematics/interior/leather-cognac/frame_0001.jpg",
    );
  });

  it("matches the default obsidian leather interior variant", () => {
    const variant = getInteriorCinematicVariant({ material: "leather", color: "obsidian" });

    expect(variant?.id).toBe("leather-obsidian");
  });

  it("returns null for unsupported interior variants so the 3D cabin can remain visible", () => {
    expect(getInteriorCinematicVariant({ material: "cloth", color: "greige" })).toBeNull();
    expect(getInteriorCinematicVariant({ material: "nappa", color: "tan" })).toBeNull();
  });

  it("creates padded frame urls from a base directory", () => {
    expect(createFrameUrls("/cinematics/interior/leather-cognac", 3)).toEqual([
      "/cinematics/interior/leather-cognac/frame_0001.jpg",
      "/cinematics/interior/leather-cognac/frame_0002.jpg",
      "/cinematics/interior/leather-cognac/frame_0003.jpg",
    ]);
  });
});
