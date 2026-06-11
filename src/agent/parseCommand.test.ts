import { describe, expect, it } from "vitest";
import { parseCommand } from "./parseCommand";

describe("parseCommand v2", () => {
  it("still parses v1 colour + view", () => {
    const r = parseCommand("make it red and show me the trunk");
    expect(r.patch.color).toBe("soulRed");
    expect(r.patch.view).toBe("trunk");
  });

  it("parses environments from lifestyle words", () => {
    expect(parseCommand("take me to the mountains").patch.environment).toBe("mountain");
    expect(parseCommand("show it in the city").patch.environment).toBe("city");
    expect(parseCommand("put it on a coastal road").patch.environment).toBe("coast");
    expect(parseCommand("back to the studio").patch.environment).toBe("studio");
  });

  it("environment words don't leak into exterior colour", () => {
    const r = parseCommand("show it at the beach");
    expect(r.patch.environment).toBe("coast");
    expect(r.patch.color).toBeUndefined();
  });

  it("parses interior material", () => {
    expect(parseCommand("I want leather seats").patch.interior?.material).toBe("leather");
    expect(parseCommand("switch to cloth").patch.interior?.material).toBe("cloth");
  });

  it("parses the four real CX-5 materials distinctly", () => {
    expect(parseCommand("nappa leather please").patch.interior?.material).toBe("nappa");
    expect(parseCommand("leatherette is fine").patch.interior?.material).toBe("leatherette");
    expect(parseCommand("the microsuede one").patch.interior?.material).toBe("leatherette");
    expect(parseCommand("just plain leather").patch.interior?.material).toBe("leather");
  });

  it("parses cognac as its own cabin colour", () => {
    const r = parseCommand("cognac leather interior");
    expect(r.patch.interior?.color).toBe("cognac");
    expect(r.patch.interior?.material).toBe("leather");
    expect(parseCommand("brown leather seats").patch.interior?.color).toBe("cognac");
  });

  it("parses interior colour only with cabin context, and consumes it", () => {
    const r = parseCommand("tan leather interior please");
    expect(r.patch.interior?.color).toBe("tan");
    expect(r.patch.interior?.material).toBe("leather");
    expect(r.patch.color).toBeUndefined(); // "tan" must NOT become zirconSand paint
    const r2 = parseCommand("paint it tan");
    expect(r2.patch.color).toBe("zirconSand"); // without cabin context it's still paint
    expect(r2.patch.interior).toBeUndefined();
  });

  it("drive vs test drive", () => {
    expect(parseCommand("book a test drive").actions).toContain("book");
    expect(parseCommand("book a test drive").actions).not.toContain("drive");
    const d = parseCommand("let's drive");
    expect(d.actions).toContain("drive");
    expect(parseCommand("ok stop and park").actions).toContain("park");
  });
});
