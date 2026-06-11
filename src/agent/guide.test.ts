import { describe, expect, it } from "vitest";
import { STAGES, stepGuide } from "./guide";

describe("guided build state machine", () => {
  it("vibe answers map to a paint and advance to material", () => {
    const r = stepGuide("vibe", "something bold and sporty");
    expect(r.patch.color).toBe("soulRed");
    expect(r.nextStage).toBe("material");
    expect(r.reply).toContain(STAGES.material.prompt);
  });

  it("direct colour words also work at the vibe stage", () => {
    expect(stepGuide("vibe", "white please").patch.color).toBe("snowWhite");
  });

  it("material answers set interior material and move camera inside", () => {
    const r = stepGuide("material", "leather, definitely");
    expect(r.patch.interior).toEqual({ material: "leather" });
    expect(r.patch.view).toBe("interior");
    expect(r.nextStage).toBe("cabinColor");
  });

  it("cabin colour stage accepts bare colour words (stage context)", () => {
    const r = stepGuide("cabinColor", "warm tan");
    expect(r.patch.interior).toEqual({ color: "tan" });
    expect(r.nextStage).toBe("lifestyle");
  });

  it("material stage distinguishes the four real materials", () => {
    expect(stepGuide("material", "Nappa leather").patch.interior).toEqual({ material: "nappa" });
    expect(stepGuide("material", "Leatherette + microsuede").patch.interior).toEqual({
      material: "leatherette",
    });
    expect(stepGuide("material", "classic leather").patch.interior).toEqual({
      material: "leather",
    });
    expect(stepGuide("material", "Urban cloth").patch.interior).toEqual({ material: "cloth" });
  });

  it("cabin colour stage understands cognac and parchment", () => {
    expect(stepGuide("cabinColor", "Cognac brown").patch.interior).toEqual({ color: "cognac" });
    expect(stepGuide("cabinColor", "Light parchment").patch.interior).toEqual({ color: "greige" });
  });

  it("lifestyle answers pick the environment and return to exterior", () => {
    const r = stepGuide("lifestyle", "we hike most weekends");
    expect(r.patch.environment).toBe("mountain");
    expect(r.patch.view).toBe("exterior");
    expect(r.nextStage).toBe("reveal");
  });

  it("reveal yes starts driving and finishes the guide", () => {
    const r = stepGuide("reveal", "yes let's drive");
    expect(r.patch.driving).toBe(true);
    expect(r.nextStage).toBe("done");
  });

  it("reveal no finishes without driving", () => {
    const r = stepGuide("reveal", "maybe later");
    expect(r.patch.driving).toBeUndefined();
    expect(r.nextStage).toBe("done");
  });

  it("unmatched input stays on the stage and nudges", () => {
    const r = stepGuide("vibe", "ehm I don't know");
    expect(r.matched).toBe(false);
    expect(r.nextStage).toBe("vibe");
  });

  it("'surprise me' picks a default and advances", () => {
    const r = stepGuide("vibe", "surprise me");
    expect(r.patch.color).toBeDefined();
    expect(r.nextStage).toBe("material");
  });
});
