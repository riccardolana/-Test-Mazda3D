# V2 — Guided Voice Build, Interiors & Lifestyle Environments

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the CX-5 configurator into a guided, voice-led build experience: the agent walks the user through vibe → exterior colour → interior material → cabin colour → lifestyle, then reveals the car in a matching environment (mountain / city / coast) and lets it "drive" — ending in the test-drive booking.

**Architecture:** Everything stays behind the existing invariant — **the 3D scene reads only the zustand `CarConfig`**. The guided flow is a pure state machine (`guide.ts`) that turns stage-scoped utterances into `ConfigPatch` objects; environments are HDRI backgrounds + a textured ground plane selected by `config.environment`; drive mode is a `config.driving` boolean that spins the existing wheel rigs, scrolls the ground texture, and switches the camera to a chase preset. New assets (3 HDRIs, 3 texture sets) are CC0, downloaded once into `public/`, no runtime network calls.

**Tech Stack:** Existing React 19 + react-three-fiber 9 + drei 10 + zustand 5 + maath. Added: `vitest` (dev-only, for the pure-logic TDD tasks). Voice in/out via browser Web Speech APIs (already typed in `src/types/speech.d.ts`).

**V2 versioning:** all work happens on a new `v2` git branch (v1 stays on `main` / https://test-mazda3d.vercel.app). V2 deploys to a **separate Vercel project** `test-mazda3d-v2` so both apps are publicly comparable side-by-side.

**Execution status (2026-06-11):** the `v2` branch exists and **Tasks 1 and 2 are DONE** — all HDRIs and textures are downloaded, verified, and committed (`a4e562f`, `8bb63ed`). Task 0 Step 1 (branch) is also done. **Cowork scope: Task 0 Steps 2–5, then Tasks 3–12, in order.** STOP after Task 12 — Task 13 (browser/WebGL verification) and Task 14 (Vercel deploy) run in Claude Code on Riccardo's machine, not in Cowork. Work only on the `v2` branch; commit per task as specified.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/state/store.ts` | Modify | `CarConfig` gains `interior`, `environment`, `driving`; new `guideStage`/`agentLine` state; `DRIVE_SPEED` const |
| `src/state/palette.ts` | Modify | Interior colours/materials, environment metadata + labels |
| `src/agent/parseCommand.ts` | Modify | Environment / interior / drive keyword parsing |
| `src/agent/guide.ts` | Create | Guided-build state machine: stage prompts, chips, interpreters (pure, testable) |
| `src/agent/voice.ts` | Create | `speak()` wrapper over `speechSynthesis` + mute toggle |
| `src/agent/agentBridge.ts` | Modify | `.say()` routes through the guide when active; `drive`/`park` actions; `.startGuide()` |
| `src/scene/rigCar.ts` | Modify | Discover `intLeather*` materials → live cabin materials on `CarRig.cabin` |
| `src/scene/CarModel.tsx` | Modify | Cabin colour/material damping; drive-mode wheel spin + body bob |
| `src/scene/EnvironmentStage.tsx` | Create | Studio vs HDRI locations, fog, ground plane, drive-mode ground scroll |
| `src/scene/Experience.tsx` | Modify | Swap inline studio env for `<EnvironmentStage />` |
| `src/scene/CameraRig.tsx` | Modify | Chase camera while driving; pause turntable while driving |
| `src/ui/AgentPanel.tsx` | Modify | Guided mode: agent bubble + stage chips; post-guide rows for interior/environment/drive; speech mute |
| `src/styles.css` | Modify | Agent bubble + new chip styles |
| `src/agent/parseCommand.test.ts` | Create | Parser TDD |
| `src/agent/guide.test.ts` | Create | Guide state-machine TDD |
| `src/state/store.test.ts` | Create | Nested-patch merge TDD |
| `public/hdri/*.hdr` | Create | 3 CC0 HDRIs (mountain, city, coast) |
| `public/textures/*.jpg` | Create | Gravel + asphalt ground maps, fabric normal map |
| `package.json` | Modify | `vitest` + `test` script |
| `README.md` | Modify | V2 section + asset credits |

**Conventions used throughout:** the car is normalized so its **front faces +Z**, floor at y=0, ~4.6 units long (`rigCar.ts` wrapper). Scene units ≈ metres. All animation uses `maath/easing` damps inside `useFrame`, reading `useStore.getState()` — follow that pattern, never React state for per-frame values.

---

### Task 0: Branch + test runner setup

**Files:**
- Modify: `package.json`

- [x] **Step 1: Create the v2 branch** — DONE (branch `v2` exists; make sure you're on it: `git checkout v2`)

- [ ] **Step 2: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 3: Add the test script to `package.json`**

In the `"scripts"` block add:

```json
"test": "vitest run"
```

so it reads:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

No vitest config file is needed — tests are pure TS in node env, which is vitest's default.

- [ ] **Step 4: Verify the runner works**

Run: `npm test`
Expected: `No test files found` exit message (non-zero exit is fine at this point).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: v2 branch, add vitest"
```

---

### Task 1: Download HDRI environment backdrops (Poly Haven, CC0) — ✅ DONE (commit `a4e562f`)

**Files:**
- Create: `public/hdri/mountain_2k.hdr`
- Create: `public/hdri/city_2k.hdr`
- Create: `public/hdri/coast_2k.hdr`

All three are CC0 from Poly Haven and were verified live (HTTP 200) with these sizes. Each is a ground-level shot so a car sitting at y=0 reads naturally:

| Scene | Asset | Page | Size |
|---|---|---|---|
| mountain | `fouriesburg_mountain_lookout` | https://polyhaven.com/a/fouriesburg_mountain_lookout | 5.4 MB |
| city | `potsdamer_platz` | https://polyhaven.com/a/potsdamer_platz | 5.8 MB |
| coast | `simons_town_road` (coastal road) | https://polyhaven.com/a/simons_town_road | 5.9 MB |

(Verified alternates if any looks wrong in the browser check: `alps_field`, `wide_street_01`, `spiaggia_di_mondello` — same URL pattern.)

- [x] **Step 1: Download into `public/hdri/`**

```bash
cd "/Users/riccardo.lana/Projects/Madza/3d Experience"
mkdir -p public/hdri
curl -L --retry 3 -o public/hdri/mountain_2k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/fouriesburg_mountain_lookout_2k.hdr"
curl -L --retry 3 -o public/hdri/city_2k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/potsdamer_platz_2k.hdr"
curl -L --retry 3 -o public/hdri/coast_2k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/simons_town_road_2k.hdr"
```

- [x] **Step 2: Verify**

Run: `ls -la public/hdri/ && file public/hdri/*.hdr`
Expected: three files, 5–7 MB each, `file` reports `Radiance HDR image data`.

- [x] **Step 3: Commit**

```bash
git add public/hdri
git commit -m "feat: add CC0 HDRI environment backdrops (Poly Haven)"
```

---

### Task 2: Download ground + fabric textures (ambientCG, CC0) — ✅ DONE (commit `8bb63ed`)

**Files:**
- Create: `public/textures/gravel_color.jpg`, `public/textures/gravel_normal.jpg`
- Create: `public/textures/asphalt_color.jpg`, `public/textures/asphalt_normal.jpg`
- Create: `public/textures/fabric_normal.jpg`

All three assets are CC0 from ambientCG; direct-download URLs were verified to return `200 application/zip`.

- [x] **Step 1: Download and extract**

```bash
cd "/Users/riccardo.lana/Projects/Madza/3d Experience"
mkdir -p public/textures /tmp/acg
curl -L --retry 3 -o /tmp/acg/gravel.zip  "https://ambientcg.com/get?file=Gravel023_1K-JPG.zip"
curl -L --retry 3 -o /tmp/acg/asphalt.zip "https://ambientcg.com/get?file=Asphalt025C_1K-JPG.zip"
curl -L --retry 3 -o /tmp/acg/fabric.zip  "https://ambientcg.com/get?file=Fabric030_1K-JPG.zip"
unzip -o /tmp/acg/gravel.zip  -d /tmp/acg/gravel
unzip -o /tmp/acg/asphalt.zip -d /tmp/acg/asphalt
unzip -o /tmp/acg/fabric.zip  -d /tmp/acg/fabric
cp /tmp/acg/gravel/Gravel023_1K-JPG_Color.jpg        public/textures/gravel_color.jpg
cp /tmp/acg/gravel/Gravel023_1K-JPG_NormalGL.jpg     public/textures/gravel_normal.jpg
cp /tmp/acg/asphalt/Asphalt025C_1K-JPG_Color.jpg     public/textures/asphalt_color.jpg
cp /tmp/acg/asphalt/Asphalt025C_1K-JPG_NormalGL.jpg  public/textures/asphalt_normal.jpg
cp /tmp/acg/fabric/Fabric030_1K-JPG_NormalGL.jpg     public/textures/fabric_normal.jpg
```

If a `cp` fails because the inner filename differs, run `ls /tmp/acg/<dir>` and copy the `_Color.jpg` / `_NormalGL.jpg` variants (always use **NormalGL**, not NormalDX — three.js expects OpenGL-convention normals).

- [x] **Step 2: Verify sizes**

Run: `ls -la public/textures/`
Expected: 5 JPGs, each roughly 0.2–1.5 MB.

- [x] **Step 3: Commit**

```bash
git add public/textures
git commit -m "feat: add CC0 ground and fabric textures (ambientCG)"
```

---

### Task 3: Extend CarConfig — interior, environment, driving, guide state

**Files:**
- Modify: `src/state/store.ts`
- Test: `src/state/store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/state/store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- store`
Expected: FAIL — `interior` undefined / `setGuide` not a function.

- [ ] **Step 3: Implement the store changes**

In `src/state/store.ts`, add the new types after the existing type lines (after `export type DoorKey = ...`):

```ts
export type InteriorMaterial = "leather" | "cloth";
export type InteriorColorId = "obsidian" | "tan" | "greige";
export type EnvironmentId = "studio" | "mountain" | "city" | "coast";
export type GuideStage = "vibe" | "material" | "cabinColor" | "lifestyle" | "reveal" | "done";

export interface InteriorConfig {
  material: InteriorMaterial;
  color: InteriorColorId;
}
```

Extend `CarConfig`:

```ts
export interface CarConfig {
  color: PaintId;
  view: ViewName;
  doors: DoorState;
  trim: "base" | "premium";
  interior: InteriorConfig;
  environment: EnvironmentId;
  /** drive-mode showcase: wheels spin, ground scrolls, chase camera */
  driving: boolean;
  /** 0 = staged (parts floating), ASSEMBLY_DONE = fully built */
  assemblyStep: number;
}
```

Below `export const ASSEMBLY_DONE = 5;` add:

```ts
/** scene units (≈ metres) per second in drive mode — shared by wheels & ground scroll */
export const DRIVE_SPEED = 8;
```

Replace the `ConfigPatch` type:

```ts
export type ConfigPatch = Partial<Omit<CarConfig, "doors" | "interior">> & {
  doors?: Partial<DoorState>;
  interior?: Partial<InteriorConfig>;
};
```

In `interface AppState`, after `lastIntent`, add:

```ts
  /** guided build: null = not started, "done" = finished (freeform mode) */
  guideStage: GuideStage | null;
  /** what the agent is currently saying (displayed + spoken) */
  agentLine: string | null;
```

and after `setCapture`:

```ts
  setGuide: (stage: GuideStage | null, line: string | null) => void;
```

In the `create<AppState>` initial state: extend `config` defaults —

```ts
  config: {
    color: "soulRed",
    view: "exterior",
    doors: { ...CLOSED_DOORS },
    trim: "base",
    interior: { material: "leather", color: "obsidian" },
    environment: "studio",
    driving: false,
    assemblyStep: 0,
  },
```

add the two new state fields next to `lastIntent: null,`:

```ts
  guideStage: null,
  agentLine: null,
```

Update `applyConfig` to merge `interior` like `doors`:

```ts
  applyConfig: (patch, intent) =>
    set((s) => ({
      config: {
        ...s.config,
        ...patch,
        doors: { ...s.config.doors, ...(patch.doors ?? {}) },
        interior: { ...s.config.interior, ...(patch.interior ?? {}) },
      },
      ...(intent ? { lastIntent: { text: intent, ts: Date.now() } } : {}),
    })),
```

In `startAssembly`'s `set`, also reset `driving` (keep colour/interior/environment so a rebuild keeps the user's build):

```ts
      config: {
        ...s.config,
        assemblyStep: 0,
        view: "exterior",
        doors: { ...CLOSED_DOORS },
        driving: false,
      },
```

Add the action implementation next to `setCapture`:

```ts
  setGuide: (stage, line) => set({ guideStage: stage, agentLine: line }),
```

- [ ] **Step 4: Run the tests and type-check**

Run: `npm test -- store && npx tsc --noEmit`
Expected: 3 tests PASS; tsc clean (nothing else references the new fields yet).

- [ ] **Step 5: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat: CarConfig v2 — interior, environment, driving, guide state"
```

---

### Task 4: Palette metadata for interiors and environments

**Files:**
- Modify: `src/state/palette.ts`

No test — pure data. Type-check is the gate.

- [ ] **Step 1: Add the data**

In `src/state/palette.ts`, change the first import line to:

```ts
import type {
  EnvironmentId,
  InteriorColorId,
  InteriorMaterial,
  PaintId,
  ViewName,
  DoorKey,
} from "./store";
```

Append at the end of the file:

```ts
export const INTERIOR_COLORS: Record<InteriorColorId, { name: string; hex: string; sheen: string }> = {
  obsidian: { name: "Obsidian Black", hex: "#1a191c", sheen: "#4d4c52" },
  tan: { name: "Saddle Tan", hex: "#8a5a37", sheen: "#c08a5c" },
  greige: { name: "Stone Greige", hex: "#a89e8e", sheen: "#d6cdbf" },
};
export const INTERIOR_COLOR_IDS = Object.keys(INTERIOR_COLORS) as InteriorColorId[];

export const INTERIOR_MATERIALS: Record<InteriorMaterial, { name: string }> = {
  leather: { name: "Nappa Leather" },
  cloth: { name: "Urban Cloth" },
};

export const ENVIRONMENTS: Record<EnvironmentId, { name: string; blurb: string }> = {
  studio: { name: "Studio", blurb: "Back in the studio" },
  mountain: { name: "Mountain trail", blurb: "Up where the trails start" },
  city: { name: "City streets", blurb: "Right at home in the city" },
  coast: { name: "Coastal road", blurb: "Out along the coast" },
};
export const ENVIRONMENT_IDS = Object.keys(ENVIRONMENTS) as EnvironmentId[];
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/state/palette.ts
git commit -m "feat: palette metadata for interiors and environments"
```

---

### Task 5: parseCommand — environments, interiors, drive (TDD)

**Files:**
- Modify: `src/agent/parseCommand.ts`
- Test: `src/agent/parseCommand.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/agent/parseCommand.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- parseCommand`
Expected: v1 test passes, all v2 tests FAIL.

- [ ] **Step 3: Implement**

In `src/agent/parseCommand.ts`:

Change the store-type import and add palette imports:

```ts
import type {
  ConfigPatch,
  DoorKey,
  EnvironmentId,
  InteriorColorId,
  PaintId,
  ViewName,
} from "../state/store";
import { ENVIRONMENTS, INTERIOR_COLORS, INTERIOR_MATERIALS, PAINTS } from "../state/palette";
```

Extend the actions union in `ParsedCommand`:

```ts
  actions: ("assemble" | "book" | "drive" | "park")[];
```

Add word tables after `VIEW_WORDS`:

```ts
const ENV_WORDS: [RegExp, EnvironmentId][] = [
  [/\b(mountains?|alps|alpine|hik\w+|trails?|off-?road|forest|nature|camping?)\b/, "mountain"],
  [/\b(city|urban|downtown|town|commut\w+|streets?|metropolis)\b/, "city"],
  [/\b(coast(?:al)?(?:\s+road)?|beach|seaside|ocean\s+road|riviera|surf\w*)\b/, "coast"],
  [/\b(studio|showroom)\b/, "studio"],
];

const INTERIOR_COLOR_WORDS: [string, InteriorColorId][] = [
  ["black|charcoal|obsidian", "obsidian"],
  ["tan|saddle|brown|cognac|caramel", "tan"],
  ["greige|grey|gray|stone|beige|cream", "greige"],
];
const CABIN_CTX = "interior|cabin|inside|seats?|upholstery|leather|cloth|fabric";
```

Inside `parseCommand`, **the order matters**. After the existing actions block, replace the book regex section so "test drive" is consumed before the drive matcher, and add drive/park:

```ts
  if (/\b(book|reserve|schedule|test.?drive)\b/.test(s)) {
    actions.push("book");
    labels.push("Booking → test drive");
    s = s.replace(/\btest.?drive\b/g, " ");
  }
  if (/\b(drive|driving|cruise|spin|roll|let'?s go)\b/.test(s) && !actions.includes("book")) {
    actions.push("drive");
    labels.push("Drive mode → on");
    s = s.replace(/\b(drive|driving|cruise|spin|roll)\b/g, " ");
  }
  if (/\b(stop|park|pull over|stand still)\b/.test(s)) {
    actions.push("park");
    labels.push("Drive mode → off");
  }
```

(Keep the existing `assemble` block above this, unchanged. Note: the v1 `book` block is replaced by the version above; "spin" is consumed so it can't hit the wheels view matcher.)

After the doors section (after the `open everything` block) and **before** the colour section, add environment then interior parsing:

```ts
  // --- environment ---------------------------------------------------
  for (const [re, env] of ENV_WORDS) {
    if (re.test(s)) {
      patch.environment = env;
      labels.push(`Scene → ${ENVIRONMENTS[env].name}`);
      s = s.replace(re, " ");
      break;
    }
  }

  // --- interior ------------------------------------------------------
  const interior: ConfigPatch["interior"] = {};
  if (/\b(leather|nappa)\b/.test(s)) interior.material = "leather";
  else if (/\b(cloth|fabric|textile|woven)\b/.test(s)) interior.material = "cloth";

  for (const [words, id] of INTERIOR_COLOR_WORDS) {
    const near = new RegExp(
      `\\b(${words})\\b[\\w\\s,'-]{0,18}\\b(${CABIN_CTX})\\b|\\b(${CABIN_CTX})\\b[\\w\\s,'-]{0,18}\\b(${words})\\b`,
    );
    if (near.test(s)) {
      interior.color = id;
      s = s.replace(new RegExp(`\\b(${words})\\b`, "g"), " ");
      break;
    }
  }
  if (interior.material !== undefined || interior.color !== undefined) {
    patch.interior = interior;
    const mat = interior.material ? INTERIOR_MATERIALS[interior.material].name : null;
    const col = interior.color ? INTERIOR_COLORS[interior.color].name : null;
    labels.push(`Interior → ${[col, mat].filter(Boolean).join(" ")}`);
  }
```

Leave the existing colour and view sections untouched below — interior colour words were consumed, so "tan interior" can no longer trigger `zirconSand`.

- [ ] **Step 4: Run the tests**

Run: `npm test -- parseCommand && npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/agent/parseCommand.ts src/agent/parseCommand.test.ts
git commit -m "feat: parse environments, interior material/colour, drive actions"
```

---

### Task 6: The guided-build state machine (TDD)

**Files:**
- Create: `src/agent/guide.ts`
- Test: `src/agent/guide.test.ts`

`stepGuide(stage, text)` is pure (no store access) so it's fully unit-testable; `startGuide`/`answerGuided` are thin store adapters.

- [ ] **Step 1: Write the failing tests**

Create `src/agent/guide.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- guide`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/agent/guide.ts`**

```ts
import type {
  ConfigPatch,
  EnvironmentId,
  GuideStage,
  InteriorColorId,
  InteriorMaterial,
  PaintId,
} from "../state/store";
import { useStore } from "../state/store";
import { ENVIRONMENTS, INTERIOR_COLORS, INTERIOR_MATERIALS, PAINTS } from "../state/palette";

/* ------------------------------------------------------------------ */
/* The guided build: a tiny stage machine. Each stage asks a question, */
/* interprets the answer into a ConfigPatch, and hands over to the     */
/* next stage. stepGuide() is pure; answerGuided() applies to store.   */
/* Like parseCommand, this is the stand-in for the real LLM pipeline.  */
/* ------------------------------------------------------------------ */

export interface StageSpec {
  prompt: string;
  /** suggestion chips shown under the agent bubble */
  chips: string[];
}

export const STAGES: Record<Exclude<GuideStage, "done">, StageSpec> = {
  vibe: {
    prompt:
      "Let's build your CX-5 together. First, the exterior — what's the vibe you're going for?",
    chips: ["Bold & sporty", "Sleek & elegant", "Calm & minimal", "Deep & serene"],
  },
  material: {
    prompt: "Now step inside — would you rather have leather, or a softer cloth?",
    chips: ["Nappa leather", "Urban cloth"],
  },
  cabinColor: {
    prompt: "And the cabin colour?",
    chips: ["Classic black", "Warm tan", "Light greige"],
  },
  lifestyle: {
    prompt:
      "Last one — tell me about your week. Mountain trails, the daily city run, or escapes down the coast?",
    chips: ["I live for the mountains", "Family life in the city", "Weekends on the coast"],
  },
  reveal: {
    prompt: "There it is — your CX-5, right where it belongs. Want to see it move?",
    chips: ["Let's drive", "Maybe later"],
  },
};

const VIBE_MAP: [RegExp, PaintId][] = [
  [/\b(bold|sporty|sport|fun|energetic|passionate|fiery|red)\b/, "soulRed"],
  [/\b(sleek|elegant|professional|business|sophisticated|grey|gray|silver)\b/, "machineGrey"],
  [/\b(stealth|night|edgy|black|mysterious|dark)\b/, "jetBlack"],
  [/\b(calm|clean|minimal|fresh|pure|white|bright)\b/, "snowWhite"],
  [/\b(deep|serene|cool|ocean|blue|tranquil)\b/, "crystalBlue"],
  [/\b(warm|earthy|desert|sandy?|sunny|golden|beige)\b/, "zirconSand"],
];

const MATERIAL_MAP: [RegExp, InteriorMaterial][] = [
  [/\b(leather|nappa|premium)\b/, "leather"],
  [/\b(cloth|fabric|soft(er)?|textile|woven|eco)\b/, "cloth"],
];

const CABIN_COLOR_MAP: [RegExp, InteriorColorId][] = [
  [/\b(black|charcoal|obsidian|dark)\b/, "obsidian"],
  [/\b(tan|saddle|brown|cognac|caramel|warm)\b/, "tan"],
  [/\b(greige|grey|gray|stone|beige|cream|light)\b/, "greige"],
];

const LIFESTYLE_MAP: [RegExp, EnvironmentId][] = [
  [/\b(mountains?|hik\w+|trails?|ski\w*|climb\w*|outdoors?|camp\w*|nature|forest)\b/, "mountain"],
  [/\b(city|commut\w+|family|kids|school|office|urban|errands|daily)\b/, "city"],
  [/\b(coast\w*|beach|surf\w*|sea|sail\w*|road.?trips?|sun)\b/, "coast"],
];

const SURPRISE = /\b(surprise|you choose|you pick|dealer'?s choice|whatever|skip|anything)\b/;
const YES = /\b(yes|yeah|yep|sure|ok(ay)?|absolutely|drive|go|move|let'?s)\b/;

function pick<T>(table: [RegExp, T][], s: string, fallback: T): T | null {
  for (const [re, v] of table) if (re.test(s)) return v;
  if (SURPRISE.test(s)) return fallback;
  return null;
}

export interface GuideStep {
  patch: ConfigPatch;
  /** what the agent says next (ack + next question) */
  reply: string;
  /** short confirmation for the intent toast, "" if none */
  label: string;
  nextStage: GuideStage;
  actions: ("drive" | "book")[];
  matched: boolean;
}

const stay = (stage: Exclude<GuideStage, "done">, nudge: string): GuideStep => ({
  patch: {},
  reply: `${nudge} ${STAGES[stage].prompt}`,
  label: "",
  nextStage: stage,
  actions: [],
  matched: false,
});

export function stepGuide(stage: Exclude<GuideStage, "done">, text: string): GuideStep {
  const s = ` ${text.toLowerCase().trim()} `;

  switch (stage) {
    case "vibe": {
      const color = pick(VIBE_MAP, s, "soulRed");
      if (!color) return stay("vibe", "No rush — sporty, elegant, calm…?");
      return {
        patch: { color },
        reply: `${PAINTS[color].name} — great taste. ${STAGES.material.prompt}`,
        label: `Colour → ${PAINTS[color].name}`,
        nextStage: "material",
        actions: [],
        matched: true,
      };
    }
    case "material": {
      const material = pick(MATERIAL_MAP, s, "leather");
      if (!material) return stay("material", "Leather or cloth?");
      return {
        patch: { interior: { material }, view: "interior" },
        reply: `${INTERIOR_MATERIALS[material].name}, nice. Have a look inside. ${STAGES.cabinColor.prompt}`,
        label: `Interior → ${INTERIOR_MATERIALS[material].name}`,
        nextStage: "cabinColor",
        actions: [],
        matched: true,
      };
    }
    case "cabinColor": {
      const color = pick(CABIN_COLOR_MAP, s, "obsidian");
      if (!color) return stay("cabinColor", "Black, tan or greige?");
      return {
        patch: { interior: { color } },
        reply: `${INTERIOR_COLORS[color].name} it is. ${STAGES.lifestyle.prompt}`,
        label: `Cabin → ${INTERIOR_COLORS[color].name}`,
        nextStage: "lifestyle",
        actions: [],
        matched: true,
      };
    }
    case "lifestyle": {
      const environment = pick(LIFESTYLE_MAP, s, "mountain");
      if (!environment) return stay("lifestyle", "Tell me where life takes you —");
      return {
        patch: { environment, view: "exterior", doors: { frontLeft: false, frontRight: false, rearLeft: false, rearRight: false, trunk: false } },
        reply: `${ENVIRONMENTS[environment].blurb} — sounds like you. ${STAGES.reveal.prompt}`,
        label: `Scene → ${ENVIRONMENTS[environment].name}`,
        nextStage: "reveal",
        actions: [],
        matched: true,
      };
    }
    case "reveal": {
      if (YES.test(s)) {
        return {
          patch: { driving: true, view: "exterior" },
          reply:
            "Hold on — let's take it for a cruise. When you're convinced, just say “book my test drive”.",
          label: "Drive mode → on",
          nextStage: "done",
          actions: ["drive"],
          matched: true,
        };
      }
      return {
        patch: {},
        reply:
          "No problem — explore freely: colours, doors, scenes. Say “book a test drive” whenever you're ready.",
        label: "",
        nextStage: "done",
        actions: [],
        matched: true,
      };
    }
  }
}

/* ----------------------- store adapters --------------------------- */

export function startGuide() {
  useStore.getState().setGuide("vibe", STAGES.vibe.prompt);
}

/** Returns true if the utterance was consumed by the guide. */
export function answerGuided(text: string): boolean {
  const stage = useStore.getState().guideStage;
  if (!stage || stage === "done") return false;
  // booking is a global escape hatch at any stage
  if (/\b(book|reserve|test.?drive)\b/i.test(text)) {
    useStore.getState().setBooking(true);
    return true;
  }
  const step = stepGuide(stage, text);
  const store = useStore.getState();
  if (Object.keys(step.patch).length > 0) store.applyConfig(step.patch, step.label || undefined);
  store.setGuide(step.nextStage, step.reply);
  return true;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- guide && npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/agent/guide.ts src/agent/guide.test.ts
git commit -m "feat: guided build state machine (vibe → interior → lifestyle → reveal)"
```

---

### Task 7: Agent voice output + bridge routing

**Files:**
- Create: `src/agent/voice.ts`
- Modify: `src/agent/agentBridge.ts`

- [ ] **Step 1: Create `src/agent/voice.ts`**

```ts
/* Speech synthesis for the agent's lines. Browser-only, no backend.   */
/* Degrades silently where speechSynthesis is unavailable.             */

let muted = false;

export function speak(text: string) {
  if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, '"'));
  u.rate = 1.05;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export function setVoiceMuted(v: boolean) {
  muted = v;
  if (v && typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isVoiceMuted() {
  return muted;
}
```

- [ ] **Step 2: Update `src/agent/agentBridge.ts`**

Replace the whole file with:

```ts
import { useStore } from "../state/store";
import { parseCommand } from "./parseCommand";
import { answerGuided, startGuide } from "./guide";
import type { ConfigPatch } from "../state/store";

/* ------------------------------------------------------------------ */
/* The integration surface for the future voice agent. A real agent    */
/* (LLM + speech) would call exactly these functions — nothing in the  */
/* scene listens to anything else. Exposed on window for demos and     */
/* for driving the app from the console.                               */
/* ------------------------------------------------------------------ */

export const mazdaAgent = {
  /** Apply a structured CarConfig patch (what a voice agent emits). */
  apply(patch: ConfigPatch, intent?: string) {
    useStore.getState().applyConfig(patch, intent);
  },
  /** Free text in. While the guided build is active it answers the    */
  /** current stage; afterwards it's the freeform keyword parser.      */
  say(text: string) {
    if (answerGuided(text)) return { guided: true as const };
    const { patch, labels, actions } = parseCommand(text);
    const store = useStore.getState();
    if (actions.includes("drive")) patch.driving = true;
    if (actions.includes("park")) patch.driving = false;
    if (labels.length > 0) store.applyConfig(patch, labels.join("  ·  "));
    if (actions.includes("assemble")) store.startAssembly();
    if (actions.includes("book")) store.setBooking(true);
    return { patch, labels, actions };
  },
  /** Kick off (or restart) the guided build conversation. */
  startGuide() {
    startGuide();
  },
  /** Read the current configuration. */
  get config() {
    return useStore.getState().config;
  },
  /** Restart the assembly choreography. */
  rebuild() {
    useStore.getState().startAssembly();
  },
};

declare global {
  interface Window {
    mazdaAgent: typeof mazdaAgent;
  }
}

if (typeof window !== "undefined") {
  window.mazdaAgent = mazdaAgent;
}
```

- [ ] **Step 3: Type-check and run all tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/agent/voice.ts src/agent/agentBridge.ts
git commit -m "feat: agent speech output and guide-aware bridge routing"
```

---

### Task 8: rigCar — live cabin materials

**Files:**
- Modify: `src/scene/rigCar.ts`

The GLB (verified via `gltf-transform inspect`) has interior leather materials `intLeatherDark` (7 uses), `intLeatherLt` (6) and `intLeatherPerfLt` (1), each with baseColor + normal textures. We replace them with shared live `MeshPhysicalMaterial`s (keeping the original normal map for leather grain, dropping the baseColor map so flat tints read correctly) — exactly the `CarPaint` pattern. Stitches, plastics, carpet and the steering wheel are intentionally left alone.

No unit test (needs WebGL + the GLB) — gates are `tsc` and the Task 13 browser verification.

- [ ] **Step 1: Extend the `CarRig` interface**

In `src/scene/rigCar.ts`, change `CarRig`:

```ts
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
```

- [ ] **Step 2: Build cabin materials in the traverse**

In `rigCar()`, just before the `scene.traverse((o) => {` paint block, add:

```ts
  const cabinCache = new Map<string, THREE.MeshPhysicalMaterial>();
  const cabinMats: THREE.MeshPhysicalMaterial[] = [];
```

Inside the existing `swap` function, after the `if (m.name === "CarPaint") return paint;` line, add:

```ts
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
          cabinCache.set(m.name, live);
          cabinMats.push(live);
        }
        return live;
      }
```

- [ ] **Step 3: Expose it on the rig**

In the `const rig: CarRig = {` literal, add `cabinMats,` after `paint,`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/scene/rigCar.ts
git commit -m "feat: discover interior leather materials as live cabin materials"
```

---

### Task 9: CarModel — cabin animation + drive motion

**Files:**
- Modify: `src/scene/CarModel.tsx`

- [ ] **Step 1: Implement**

Replace `src/scene/CarModel.tsx` with:

```tsx
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
```

Notes for the implementer:
- `driveDist` is a ref, not state — per-frame values never go through React.
- The wheel-spin sign reuses the assembly roll convention (`-travel / radius`); adding `driveDist` keeps assembly behaviour identical when `driveDist === 0`. If wheels visibly spin backwards while driving in browser verification, flip to `+driveDist.current` inside the parenthesis — judge it on the chase view.
- `rotation-y` on the group is the wrapper yaw; we only animate `rotation.x` (pitch) and `position.y`, which don't conflict with it.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/scene/CarModel.tsx
git commit -m "feat: cabin material animation and drive-mode wheel spin + body bob"
```

---

### Task 10: EnvironmentStage — studio vs lifestyle locations

**Files:**
- Create: `src/scene/EnvironmentStage.tsx`
- Modify: `src/scene/Experience.tsx`

- [ ] **Step 1: Create `src/scene/EnvironmentStage.tsx`**

```tsx
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useTexture } from "@react-three/drei";
import { DRIVE_SPEED, useStore } from "../state/store";
import type { EnvironmentId } from "../state/store";

/* ------------------------------------------------------------------ */
/* The surroundings react ONLY to config.environment / config.driving. */
/* Studio = the original procedural Lightformer set (offline, instant).*/
/* Locations = a local HDRI backdrop + tiled ground that scrolls in    */
/* drive mode. HDRIs live in /public/hdri — still zero network calls.  */
/* ------------------------------------------------------------------ */

const GROUND_SIZE = 220;
const GROUND_REPEAT = 56;

interface LocationSpec {
  hdri: string;
  fog: [string, number, number];
  groundColor: string;
  groundTex: string;
  groundNormal: string;
}

const LOCATIONS: Record<Exclude<EnvironmentId, "studio">, LocationSpec> = {
  mountain: {
    hdri: "/hdri/mountain_2k.hdr",
    fog: ["#aab4be", 30, 110],
    groundColor: "#8f897c",
    groundTex: "/textures/gravel_color.jpg",
    groundNormal: "/textures/gravel_normal.jpg",
  },
  city: {
    hdri: "/hdri/city_2k.hdr",
    fog: ["#b9bfc4", 26, 95],
    groundColor: "#85868a",
    groundTex: "/textures/asphalt_color.jpg",
    groundNormal: "/textures/asphalt_normal.jpg",
  },
  coast: {
    hdri: "/hdri/coast_2k.hdr",
    fog: ["#cfd8dd", 32, 120],
    groundColor: "#9a948b",
    groundTex: "/textures/asphalt_color.jpg",
    groundNormal: "/textures/asphalt_normal.jpg",
  },
};

function Location({ id }: { id: Exclude<EnvironmentId, "studio"> }) {
  const spec = LOCATIONS[id];
  const maps = useTexture({ map: spec.groundTex, normalMap: spec.groundNormal });

  useMemo(() => {
    Object.values(maps).forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
      t.anisotropy = 8;
    });
    maps.map.colorSpace = THREE.SRGBColorSpace;
  }, [maps]);

  // drive mode: scroll the ground texture under the car (car faces +Z)
  useFrame((_, delta) => {
    if (!useStore.getState().config.driving) return;
    const move = (delta * DRIVE_SPEED) / (GROUND_SIZE / GROUND_REPEAT);
    maps.map.offset.y -= move;
    maps.normalMap.offset.y -= move;
  });

  return (
    <>
      <Environment files={spec.hdri} background backgroundBlurriness={0.04} />
      <fog attach="fog" args={spec.fog} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial
          color={spec.groundColor}
          map={maps.map}
          normalMap={maps.normalMap}
          roughness={0.95}
          metalness={0}
        />
      </mesh>
    </>
  );
}

function Studio() {
  return (
    <>
      <color attach="background" args={["#0a0a0d"]} />
      <fog attach="fog" args={["#0a0a0d", 16, 40]} />
      {/* procedural studio reflections — no external HDRI, works offline */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={5} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[11, 11, 1]} />
        <Lightformer form="rect" intensity={2} position={[-9, 2.4, 0]} rotation-y={Math.PI / 2} scale={[9, 2.2, 1]} />
        <Lightformer form="rect" intensity={2} position={[9, 2.4, 0]} rotation-y={-Math.PI / 2} scale={[9, 2.2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 3, -10]} scale={[10, 2.4, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 2.4, 10]} rotation-y={Math.PI} scale={[8, 2, 1]} />
      </Environment>
      {/* studio floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]}>
        <circleGeometry args={[34, 64]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.95} metalness={0} />
      </mesh>
    </>
  );
}

export default function EnvironmentStage() {
  const env = useStore((s) => s.config.environment);
  if (env === "studio") return <Studio />;
  return (
    <Suspense fallback={<Studio />}>
      <Location key={env} id={env} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Slim down `src/scene/Experience.tsx`**

Replace the file with:

```tsx
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import CarModel from "./CarModel";
import CameraRig from "./CameraRig";
import EnvironmentStage from "./EnvironmentStage";
import { useStore } from "../state/store";

/** Full-bleed 3D studio. Everything inside reacts only to CarConfig. */
export default function Experience() {
  const setCapture = useStore((s) => s.setCapture);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [8.5, 3.2, 10.5], fov: 38, near: 0.05, far: 250 }}
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
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 9, 4]} intensity={1.1} />
      <directionalLight position={[-6, 5, -6]} intensity={0.4} color="#bcd0ff" />

      <EnvironmentStage />

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
```

(Camera `far` raised 120 → 250 so the big ground plane and HDRI horizon don't clip.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/scene/EnvironmentStage.tsx src/scene/Experience.tsx
git commit -m "feat: lifestyle environments — HDRI locations with drive-mode ground scroll"
```

---

### Task 11: CameraRig — chase camera while driving

**Files:**
- Modify: `src/scene/CameraRig.tsx`

- [ ] **Step 1: Implement**

Three changes in `src/scene/CameraRig.tsx`:

a) Add a `driving` subscription next to `view`:

```ts
  const view = useStore((s) => s.config.view);
  const driving = useStore((s) => s.config.driving);
  const started = useStore((s) => s.started);
```

b) In the preset `useEffect`, handle driving — replace the `apply` function and dependency array:

```ts
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
```

and change the effect deps from `[view, rig, started]` to `[view, rig, started, driving]`.

c) In the `useFrame` turntable condition, exclude driving:

```ts
    const turntable =
      s.assembling ||
      (idle &&
        s.started &&
        s.config.view === "exterior" &&
        !s.config.driving &&
        !s.bookingOpen);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/scene/CameraRig.tsx
git commit -m "feat: chase camera preset while driving"
```

---

### Task 12: AgentPanel — guided conversation UI + new control rows

**Files:**
- Modify: `src/ui/AgentPanel.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Rewrite `src/ui/AgentPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { ASSEMBLY_DONE, useStore } from "../state/store";
import {
  DOORS,
  ENVIRONMENTS,
  ENVIRONMENT_IDS,
  INTERIOR_COLORS,
  INTERIOR_COLOR_IDS,
  INTERIOR_MATERIALS,
  PAINTS,
  PAINT_IDS,
  VIEWS,
} from "../state/palette";
import { mazdaAgent } from "../agent/agentBridge";
import { STAGES, startGuide } from "../agent/guide";
import { isVoiceMuted, setVoiceMuted, speak } from "../agent/voice";

/* The voice-agent surface: during the guided build it shows the       */
/* agent's question + suggestion chips; afterwards the full control    */
/* rows. All input paths end in mazdaAgent.say() → ConfigPatch.        */

const SpeechRecognitionImpl: (new () => SpeechRecognition) | undefined =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export default function AgentPanel() {
  const config = useStore((s) => s.config);
  const started = useStore((s) => s.started);
  const assembling = useStore((s) => s.assembling);
  const guideStage = useStore((s) => s.guideStage);
  const agentLine = useStore((s) => s.agentLine);
  const applyConfig = useStore((s) => s.applyConfig);
  const toggleDoor = useStore((s) => s.toggleDoor);
  const notify = useStore((s) => s.notify);

  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(isVoiceMuted());
  const recRef = useRef<SpeechRecognition | null>(null);

  const built = config.assemblyStep >= ASSEMBLY_DONE;
  const visible = started && !assembling && built;
  const guideActive = guideStage !== null && guideStage !== "done";

  // auto-start the guided build the first time the car is fully built
  useEffect(() => {
    if (visible && guideStage === null) startGuide();
  }, [visible, guideStage]);

  // the agent speaks whatever it says
  useEffect(() => {
    if (agentLine && visible) speak(agentLine);
  }, [agentLine, visible]);

  const runCommand = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const res = mazdaAgent.say(cmd);
    if (!("guided" in res) && res.labels.length === 0) {
      notify("Hmm — try “make it red and show me the trunk”");
    }
    setText("");
  };

  const toggleVoice = () => {
    if (!SpeechRecognitionImpl) {
      notify("Voice input isn’t supported in this browser — type instead");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognitionImpl();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      runCommand(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <div className={`panel ${visible ? "visible" : ""}`}>
      {/* agent bubble — the guide's current line */}
      {agentLine && (
        <div className="agent-bubble">
          <span className="agent-dot" />
          <p>{agentLine}</p>
          <button
            type="button"
            className="mute"
            title={muted ? "Unmute agent voice" : "Mute agent voice"}
            onClick={() => {
              setVoiceMuted(!muted);
              setMuted(!muted);
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      )}

      {/* guided mode: stage suggestion chips */}
      {guideStage !== null && guideStage !== "done" && (
        <div className="panel-row chips">
          {STAGES[guideStage].chips.map((c) => (
            <button key={c} className="chip" onClick={() => runCommand(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* freeform mode: the full control surface */}
      {!guideActive && (
        <>
          <div className="panel-row swatches">
            {PAINT_IDS.map((id) => (
              <button
                key={id}
                title={PAINTS[id].name}
                className={`swatch ${config.color === id ? "active" : ""}`}
                style={{
                  background: `radial-gradient(circle at 32% 28%, ${PAINTS[id].sheen}, ${PAINTS[id].hex} 62%)`,
                }}
                onClick={() => applyConfig({ color: id }, `Colour → ${PAINTS[id].name}`)}
              />
            ))}
            <span className="swatch-label">{PAINTS[config.color].name}</span>
          </div>

          {/* interior material + colour */}
          <div className="panel-row chips">
            {(Object.keys(INTERIOR_MATERIALS) as ("leather" | "cloth")[]).map((mId) => (
              <button
                key={mId}
                className={`chip ${config.interior.material === mId ? "active" : ""}`}
                onClick={() =>
                  applyConfig(
                    { interior: { material: mId }, view: "interior" },
                    `Interior → ${INTERIOR_MATERIALS[mId].name}`,
                  )
                }
              >
                {INTERIOR_MATERIALS[mId].name}
              </button>
            ))}
            {INTERIOR_COLOR_IDS.map((id) => (
              <button
                key={id}
                title={INTERIOR_COLORS[id].name}
                className={`swatch small ${config.interior.color === id ? "active" : ""}`}
                style={{
                  background: `radial-gradient(circle at 32% 28%, ${INTERIOR_COLORS[id].sheen}, ${INTERIOR_COLORS[id].hex} 62%)`,
                }}
                onClick={() =>
                  applyConfig(
                    { interior: { color: id }, view: "interior" },
                    `Cabin → ${INTERIOR_COLORS[id].name}`,
                  )
                }
              />
            ))}
          </div>

          {/* environments + drive */}
          <div className="panel-row chips">
            {ENVIRONMENT_IDS.map((e) => (
              <button
                key={e}
                className={`chip ${config.environment === e ? "active" : ""}`}
                onClick={() => applyConfig({ environment: e }, `Scene → ${ENVIRONMENTS[e].name}`)}
              >
                {ENVIRONMENTS[e].name}
              </button>
            ))}
            <button
              className={`chip drive ${config.driving ? "active" : ""}`}
              onClick={() =>
                applyConfig(
                  { driving: !config.driving },
                  `Drive mode → ${config.driving ? "off" : "on"}`,
                )
              }
            >
              {config.driving ? "■ Stop" : "▶ Drive"}
            </button>
          </div>

          <div className="panel-row chips">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                className={`chip ${config.view === v.id ? "active" : ""}`}
                onClick={() =>
                  applyConfig(
                    v.id === "trunk"
                      ? { view: v.id, doors: { trunk: true } }
                      : { view: v.id },
                    `View → ${v.label}`,
                  )
                }
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="panel-row chips">
            {DOORS.map((d) => (
              <button
                key={d.id}
                className={`chip door ${config.doors[d.id] ? "active" : ""}`}
                onClick={() => toggleDoor(d.id)}
              >
                {d.short}
                <span className="chip-state">{config.doors[d.id] ? "open" : "closed"}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* agent command box (always available) */}
      <form
        className="command"
        onSubmit={(e) => {
          e.preventDefault();
          runCommand(text);
        }}
      >
        <button
          type="button"
          className={`mic ${listening ? "listening" : ""}`}
          onClick={toggleVoice}
          title="Voice input"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            listening
              ? "Listening…"
              : guideActive
                ? "Answer the agent — or tap a suggestion"
                : "Ask the agent — “take me to the mountains and drive”"
          }
          aria-label="Agent command"
        />
        <button type="submit" className="send" disabled={!text.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Add styles to `src/styles.css`**

Append at the end of the file:

```css
/* --- v2: agent bubble + guided chips ------------------------------- */
.agent-bubble {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 560px;
  margin: 0 auto 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(16, 16, 20, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  color: #f1f1f4;
  font-size: 14px;
  line-height: 1.45;
}
.agent-bubble p {
  margin: 0;
  flex: 1;
}
.agent-dot {
  flex: none;
  width: 9px;
  height: 9px;
  margin-top: 5px;
  border-radius: 50%;
  background: #d4494e;
  box-shadow: 0 0 10px rgba(212, 73, 78, 0.9);
  animation: agentPulse 2.2s ease-in-out infinite;
}
@keyframes agentPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.78); opacity: 0.6; }
}
.agent-bubble .mute {
  flex: none;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.75;
}
.agent-bubble .mute:hover { opacity: 1; }
.swatch.small { width: 22px; height: 22px; }
.chip.drive.active { background: #d4494e; border-color: #d4494e; color: #fff; }
```

(If `.panel`, `.chip`, `.swatch` base styles use different selector names in `styles.css`, match the existing names — these rules only add new classes.)

- [ ] **Step 3: Type-check + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/AgentPanel.tsx src/styles.css
git commit -m "feat: guided conversation UI with agent bubble, stage chips, drive toggle"
```

---

### Task 13: Browser verification pass

**Files:** none (verification only). Follow `CLAUDE.md` browser gotchas: if the canvas goes black or `window.__three` vanishes, `preview_stop` + `preview_start` fresh; full page reload after `rigCar.ts` edits (stale rigs survive HMR).

- [ ] **Step 1: Start the dev server and load the app**

Use `preview_start`, wait for `[studio] canvas created` in console logs. Then run `window.mazdaAgent.rebuild()` via `preview_eval` and wait ~6.5s — the assembly completes, `started` becomes true, and the guide auto-starts (don't rely on clicking the intro overlay; its DOM selectors aren't part of this plan).

- [ ] **Step 2: Scripted end-to-end guide check (preview_eval)**

```js
// after assembly completes, the guide should have auto-started:
window.useStoreCheck = (() => {
  const a = window.mazdaAgent;
  a.say("bold and sporty");        // → soulRed, stage material
  a.say("leather");                 // → interior leather, view interior
  a.say("warm tan");                // → cabin tan
  a.say("we hike every weekend");   // → environment mountain, view exterior
  a.say("yes let's drive");         // → driving true
  return a.config;
})();
```

Expected `config`: `color: "soulRed"`, `interior: { material: "leather", color: "tan" }`, `environment: "mountain"`, `driving: true`. Also check via `preview_snapshot` that the agent bubble text changed at each step.

- [ ] **Step 3: Visual checks (preview_screenshot)**

1. Mountain scene with car driving — HDRI visible, ground textured, wheels not obviously backwards (screenshots lag ~3-6s; judge spin direction from two screenshots or trust the eval-based checks for timing).
2. `window.mazdaAgent.say("stop")` then `say("show it in the city")` → city HDRI.
3. `say("cloth interior in greige")` + `say("show me the interior")` → seat tint visibly lighter, rougher look.
4. `say("back to the studio")` → original dark studio.
5. `preview_resize` to portrait — panel usable, car fits.

- [ ] **Step 4: Console hygiene**

`preview_console_logs` — no errors (THREE.Clock deprecation warnings from drei are a known non-issue per CLAUDE.md).

- [ ] **Step 5: Fix anything found, then commit fixes**

```bash
git add -A && git commit -m "fix: v2 browser verification adjustments"
```

(Skip the commit if nothing changed.)

---

### Task 14: README + deploy v2 to its own Vercel project

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a V2 section to `README.md`**

Append (adjust wording to match the README's existing tone):

```markdown
## V2 — Guided voice build (branch `v2`)

V2 turns the configurator into a guided, voice-led build: the agent asks for
your vibe (→ exterior colour), interior material and cabin colour, then your
lifestyle — and reveals the car in a matching environment (mountain trail,
city streets, coastal road) where it can drive. Compare:

- **V1 (freeform):** https://test-mazda3d.vercel.app
- **V2 (guided):** https://test-mazda3d-v2.vercel.app

### Asset credits (all CC0)

- HDRI environments: [Poly Haven](https://polyhaven.com) — see `public/hdri/`
- Ground + fabric textures: [ambientCG](https://ambientcg.com) —
  Gravel023, Asphalt025C, Fabric030
```

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: tsc clean + vite build succeeds (the 1.27MB chunk warning is a known non-issue).

- [ ] **Step 3: Create the separate Vercel project and deploy**

```bash
cd "/Users/riccardo.lana/Projects/Madza/3d Experience"   # or the v2 worktree path
rm -rf .vercel   # unlink from the v1 project in this checkout
vercel link --yes --scope vml3 --project test-mazda3d-v2
vercel pull --yes --environment production
vercel build --prod
vercel deploy --prebuilt --prod
```

Expected: production URL `https://test-mazda3d-v2.vercel.app` (the project-name alias). Deployment-specific `…-vml3.vercel.app` URLs will 401 behind team SSO — that's expected, use the alias.

NOTE: if the work happened in the main checkout (not a worktree), `rm -rf .vercel` unlinks v1 — re-link with `vercel link --yes --scope vml3 --project test-mazda3d` before any future v1 deploy from `main`.

- [ ] **Step 4: Verify the public URL**

Run: `curl -sI https://test-mazda3d-v2.vercel.app | head -3`
Expected: `HTTP/2 200`.

Then load it in the browser preview and repeat Task 13 Step 2's scripted check against production.

- [ ] **Step 5: Commit and push**

```bash
git add README.md
git commit -m "docs: v2 section + asset credits; deploy to test-mazda3d-v2"
git push -u origin v2
```

---

## Out of scope (explicitly)

- **trim** still has no visual mapping (reserved by the brief, unchanged).
- Low-poly 3D scenery props (Quaternius/Kenney packs) — the HDRI + textured-ground approach delivers the effect at a fraction of the payload/complexity; props are a v2.1 candidate if the horizon seam bothers anyone (drei `Environment ground` projection is the other fallback, noted in Task 10).
- A real LLM/voice pipeline — `guide.ts` + `parseCommand.ts` remain the documented swap-points.
- A fourth environment beyond studio/mountain/city/coast — add a `LOCATIONS` entry + HDRI when a use case lands.
