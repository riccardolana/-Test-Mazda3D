# Mazda Test Drive Studio — 3D Configurator Prototype

An interactive 3D car configurator that demonstrates the experience of a future
voice-driven test drive booking app for Mazda. The user "builds" the CX-5 they
want to test drive — colour, doors, trunk, cabin — and watches a live 3D model
react in real time, then closes the loop with a (fake) booking.

Works on desktop and mobile browsers; the UI is touch-first and the canvas is
full-bleed.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). That's the entire setup —
no backend, no env vars.

## The 3D model

| | |
|---|---|
| Source | Client-supplied `2026_Mazda_CX-5_NonRigged.blend` (in `../MazdaCX-5_Blender/`) |
| License | Client asset, internal demo use only — not redistributable |
| Pipeline | Blender CLI export → glTF-Transform optimize (see below) |
| Result | `public/models/mazda-cx5.glb` — 5.8 MB, ~578k tris, meshopt-compressed, 1K WebP textures |

The model has exactly what this demo needs: separated, named nodes
(`DoorFrLeft`, `DoorFrRight`, `DoorRearLeft`, `DoorRearRight`, `DoorTrunk`,
`WheelFrLeft`…, `Interior`, `Seats`, `Dash`, `SteeringWheel`, `Headlights`,
`Taillights`, `Undercarriage`, `Body`) and a dedicated `CarPaint` material.

### Regenerating / swapping the GLB

```bash
# inspect any .blend: node hierarchy, mesh names, materials
/Applications/Blender.app/Contents/MacOS/Blender --background model.blend \
  --python tools/inspect_blend.py

# export (drops SUBSURF modifiers for web-friendly poly count)
/Applications/Blender.app/Contents/MacOS/Blender --background model.blend \
  --python tools/export_glb.py -- /absolute/path/raw.glb

# optimize — keep --join false --flatten false or the named nodes
# (and with them every animation) are destroyed
npx gltf-transform optimize raw.glb public/models/mazda-cx5.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 \
  --join false --flatten false --simplify false --palette false
```

To swap in a **different car**, drop the GLB at `public/models/mazda-cx5.glb`
and update `NAME_MAP` in [src/scene/rigCar.ts](src/scene/rigCar.ts) to the new
model's node names. Everything else is discovered at load time from bounding
boxes: car orientation (via the headlights node), door hinge lines, wheel
axles, camera presets, unit scale. If the new model lacks separated doors,
remove those entries from `NAME_MAP.doors` — door chips/commands degrade
gracefully (the brief's camera-move fallback applies: views still work).

## Architecture: voice agent → state → scene

The entire scene reacts to **one structured state object** — never to raw
text. The UI chips, the text command box, and (later) a real voice agent are
all just producers of `CarConfig` patches.

```ts
interface CarConfig {
  color: PaintId;        // "soulRed" | "machineGrey" | "snowWhite"
                         //   | "crystalBlue" | "jetBlack" | "zirconSand"
  view: ViewName;        // "exterior" | "interior" | "trunk" | "front"
                         //   | "rear" | "wheels"
  doors: {
    frontLeft: boolean;  // driver door
    frontRight: boolean; // passenger door
    rearLeft: boolean;
    rearRight: boolean;
    trunk: boolean;      // liftgate
  };
  trim: "base" | "premium"; // reserved, no visual mapping yet
  assemblyStep: number;     // 0 = staged parts, 5 = fully built
}
```

Data flow:

```
chips / text box / Web Speech ──▶ parseCommand() ──▶ ConfigPatch ─┐
                                                                  ├─▶ zustand store (CarConfig)
window.mazdaAgent.apply(patch) ───────────────────────────────────┘        │
                                                                           ▼
                                                   useFrame in CarModel / CameraRig
                                                   (paint tween, hinge damps, assembly,
                                                    camera presets — all read CarConfig)
```

### Wiring a real voice agent

Everything an agent needs is exposed in
[src/agent/agentBridge.ts](src/agent/agentBridge.ts) (also on
`window.mazdaAgent` for console experiments):

- `mazdaAgent.apply(patch, intentLabel?)` — emit a structured patch, exactly
  what an LLM tool-call should produce.
- `mazdaAgent.say(text)` — route free text through the demo keyword parser
  ([src/agent/parseCommand.ts](src/agent/parseCommand.ts)); replace this file
  with the real pipeline (speech → LLM → `ConfigPatch`) and nothing else
  changes.
- `mazdaAgent.rebuild()` — replay the assembly intro.

Out of scope by design (the brief): real LLM/voice integration (the mic button
uses the browser's Web Speech API in Chrome and degrades gracefully), backend,
auth, real booking, multiple car models. Each would slot in behind the same
`ConfigPatch` interface — a booking service would consume the same store the
fake summary card reads today.

## Features

- **Assembly intro** — body drops in, wheels roll in (with rolling spin),
  cabin and seats lower, doors/liftgate/lights fly in; captions narrate each
  step. Replay with the command "build it again".
- **Live paint** — 6 Mazda-inspired finishes tweened on a shared
  `MeshPhysicalMaterial` (clearcoat automotive look); glass/chrome/trim
  untouched.
- **Camera presets** — exterior, front, rear, wheels, interior, trunk; always
  animated (camera-controls `setLookAt`), portrait-aware framing, wider lens
  inside the cabin, idle turntable that pauses on interaction.
- **Doors** — real hinge pivots computed from bounding boxes (front-edge
  vertical hinges for doors, top-edge lateral hinge for the liftgate), eased
  open/close.
- **Agent panel** — colour swatches, view chips, door toggles, and a command
  box with keyword parsing ("make it red and show me the trunk") + parsed
  intent confirmation toast + Web Speech mic in Chrome.
- **Booking moment** — summary card with a live canvas snapshot, colour name
  and a fake slot confirmation.

## V2 — guided voice build, environments & realism

The `v2` branch (deployed separately, see below) layers the conversational
demo on top of the configurator:

- **Guided build** — after assembly the agent walks you through five stages
  (exterior vibe → interior material → cabin colour → lifestyle → reveal),
  each answer parsed into the same `ConfigPatch` objects. Suggestion chips
  double as example utterances; free text and the mic work at every stage.
- **Lifestyle environments** — studio, mountain trail, city streets, coastal
  road. Local HDRI backdrops + matching ground; in drive mode the ground
  scrolls and a chase camera kicks in.
- **Real CX-5 interior materials** — Urban Cloth, Leatherette + Microsuede
  (as on the real S Select trim), Leather and Nappa Leather, in Obsidian
  Black / Sports Tan / Cognac Brown / Parchment. Each material gets its own
  surface response (roughness, clearcoat, sheen, normal maps); the factory
  obsidian leather colourway keeps the GLB's original baked textures.
- **Realism pass** — Khronos Neutral tone mapping, real-time shadows, HDRI
  studio lighting, N8AO ambient occlusion + subtle bloom/vignette.
- **Agent voice** — the guide speaks its lines via the Web Speech synthesis
  API (mutable from the agent bubble).

### Deployment access

The V2 deployment (`test-mazda3d-v2.vercel.app`) sits behind HTTP Basic Auth
via a Vercel Edge Middleware ([middleware.ts](middleware.ts)): any username,
password `mazda3D`. The password is hardcoded in the middleware — a
deliberate, demo-grade gate, not real security. Local `npm run dev` is
unaffected.

### CC0 asset credits

| Asset | Source |
|---|---|
| `hdri/mountain_2k.hdr` | [Fouriesburg Mountain Lookout](https://polyhaven.com/a/fouriesburg_mountain_lookout) — Poly Haven, CC0 |
| `hdri/city_2k.hdr` | [Potsdamer Platz](https://polyhaven.com/a/potsdamer_platz) — Poly Haven, CC0 |
| `hdri/coast_2k.hdr` | [Simon's Town Road](https://polyhaven.com/a/simons_town_road) — Poly Haven, CC0 |
| `hdri/studio_2k.hdr` | [Studio Small 09](https://polyhaven.com/a/studio_small_09) — Poly Haven, CC0 |
| `textures/gravel_*.jpg` | [Gravel023](https://ambientcg.com/view?id=Gravel023) — ambientCG, CC0 |
| `textures/asphalt_*.jpg` | [Asphalt025C](https://ambientcg.com/view?id=Asphalt025C) — ambientCG, CC0 |
| `textures/fabric_normal.jpg` | [Fabric030](https://ambientcg.com/view?id=Fabric030) — ambientCG, CC0 |
| `textures/suede_normal.jpg` | [Leather039](https://ambientcg.com/view?id=Leather039) — ambientCG, CC0 |

## Project layout

```
src/
  state/store.ts        CarConfig + zustand store (the heart)
  state/palette.ts      paint presets, view & door labels
  agent/parseCommand.ts free text → ConfigPatch (stand-in for the voice agent)
  agent/agentBridge.ts  window.mazdaAgent — the future agent's API surface
  scene/rigCar.ts       part discovery, hinge pivots, camera presets (data-driven)
  scene/CarModel.tsx    per-frame animation: paint, doors, assembly
  scene/CameraRig.tsx   camera-controls + presets + turntable + fov
  scene/Experience.tsx  canvas, procedural studio lighting (no network HDRIs)
  ui/                   panel, intro, toast, booking modal, top bar
tools/                  Blender inspect/export scripts (asset pipeline)
```
