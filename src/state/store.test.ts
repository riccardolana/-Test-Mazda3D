import { describe, expect, it } from "vitest";
import { useStore } from "./store";

describe("store v2 config", () => {
  it("has v2 defaults", () => {
    const c = useStore.getState().config;
    expect(c.interior).toEqual({ material: "leather", color: "obsidian" });
    expect(c.environment).toBe("studio");
    expect(c.driving).toBe(false);
  });

  it("merges partial interior patches without clobbering", () => {
    const st = useStore.getState();
    st.applyConfig({ interior: { color: "tan" } });
    expect(useStore.getState().config.interior).toEqual({ material: "leather", color: "tan" });
    st.applyConfig({ interior: { material: "cloth" } });
    expect(useStore.getState().config.interior).toEqual({ material: "cloth", color: "tan" });
  });

  it("tracks guide stage and agent line", () => {
    const st = useStore.getState();
    st.setGuide("vibe", "What's the vibe?");
    expect(useStore.getState().guideStage).toBe("vibe");
    expect(useStore.getState().agentLine).toBe("What's the vibe?");
  });
});
