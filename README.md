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
