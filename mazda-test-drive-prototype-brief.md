# Mazda Test Drive Configurator — Prototype Brief

## What you are building

An interactive 3D car configurator prototype that demonstrates the experience of a future voice-driven test drive booking app for Mazda. A user "builds" the car they want to test drive — choosing color, opening doors, inspecting the trunk and interior — and watches a live 3D model react in real time.

This is a **demo of the experience**, not production software. Optimize for a convincing, smooth, visually polished demo over architecture purity. It should run locally in a browser with one command.

## Input you will receive

A 3D car model file, ideally `.glb` or `.gltf`. If no model has been provided yet, your first task is to find one online:

- Search free model repositories (Sketchfab downloadable/CC-licensed models, Poly Haven, Khronos glTF sample assets, free tiers of CGTrader/TurboSquid).
- **Selection criteria, in priority order:**
  1. GLB/glTF format (or convertible)
  2. Separated, named meshes — doors, hood, trunk, wheels, seats as distinct nodes. This matters more than visual fidelity.
  3. Permissive license (CC0, CC-BY, or royalty-free). Record the license and attribution in the README.
  4. Reasonable poly count (< ~300k triangles)
- A generic sedan/hatchback is fine. Do NOT use a model explicitly ripped from a game or marked non-commercial.
- If the only good model available has fused geometry, take it anyway and apply the fallback strategies below.

### Inspecting the model

Before writing app code, load the model and print its node hierarchy, mesh names, and material slots (a small Node script with `@gltf-transform/core`, or log `scene.traverse` names in the browser). Map what you find to the features below. Do not assume part names — discover them.

### Fallbacks if the model lacks separated parts

- **No separate doors/trunk:** skip hinge animations; replace with camera moves ("look inside" = camera dollies through the side window to an interior view).
- **No separate paint material:** identify the body material(s) by inspecting which meshes/materials cover the largest body area, and recolor those. If body and trim share a material, recolor anyway — acceptable for a demo.
- **No interior/seats:** fake the "seats" step with a simple placeholder seat mesh (a primitive-based seat is fine) used only in the assembly intro animation.

## Tech stack

- **Vite + React + react-three-fiber + drei** (or plain three.js if you judge it simpler — your call, but r3f + drei gives camera controls, staging, and GLTF loading nearly for free).
- No backend. No build complexity. `npm install && npm run dev` must be the entire setup.
- State management: a single plain configuration state object (React context or zustand). This object is the heart of the design — see below.

## Core architectural concept: voice agent → state → scene

In the real product, a voice agent will interpret speech and emit structured configuration updates. The 3D scene must react ONLY to a structured state object, never to raw text. This separation is the whole point of the prototype.

```ts
interface CarConfig {
  color: string;            // hex or named preset, e.g. "#8b0000" / "soulRed"
  view: "exterior" | "interior" | "trunk" | "front" | "rear" | "wheels";
  doors: { frontLeft: boolean; frontRight: boolean; trunk: boolean };
  trim?: "base" | "premium";
  assemblyStep?: number;    // for the intro build-up sequence
}
```

Anything that changes the scene goes through this object. The UI (and later, a voice agent) only mutates `CarConfig`.

## Features (in build order)

### 1. Viewer foundation
- Load the GLB, center and scale it, neutral studio environment (drei `<Stage>` or an HDRI + soft shadows on a ground plane).
- OrbitControls: rotate and zoom, with sane limits (no going under the floor, min/max zoom).
- Subtle idle turntable rotation that pauses when the user interacts.

### 2. Live color change
- 5–6 Mazda-inspired paint presets (e.g. Soul Red Crystal `#a01e22`, Machine Grey `#54565a`, Snowflake White Pearl `#f2f3f4`, Deep Crystal Blue `#16304d`, Jet Black `#0c0c0c`, Zircon Sand `#b5ab94`).
- Smoothly tween the body material color (lerp over ~0.6s), keep glass/chrome/tires untouched.
- Make the paint look automotive: metalness ~0.7–0.9, low roughness, clearcoat if using MeshPhysicalMaterial.

### 3. Camera presets
- Named camera positions for each `view` value: exterior 3/4 front, interior, trunk, front, rear, wheel close-up.
- Animated transitions between presets (tween position + target over ~1s with easing). Never teleport the camera.

### 4. Door / trunk animation
- If meshes are separated: rotate doors/trunk around their hinge edge. Compute or hand-tune the pivot; if the mesh origin is wrong, reparent to an empty/group placed at the hinge line.
- Animate open/close with easing (~0.8s).
- If not separated, use the camera fallback described above.

### 5. Assembly intro ("build your Mazda" moment)
- On load or on a "Start building" action: parts animate into place — e.g. wheels roll in, seats drop in, body fades/scales in, doors attach. Order and theatrics are your call; 4–8 seconds total.
- If the model is one fused mesh: do a stylized reveal instead (wireframe-to-solid, or rising from particles/fog, or section-by-section opacity sweep). It must still feel like the car is being "built."

### 6. Agent simulation panel
This stands in for the future voice agent. Two layers:

- **Quick-action chips/buttons:** color swatches, view buttons, open/close door toggles. These mutate `CarConfig` directly and prove the state-driven design.
- **Text command box** styled like a chat/voice input: free-text like "make it red and show me the trunk" parsed by lightweight keyword matching (color names, "trunk", "inside", "open the door", etc.). No LLM call needed — keyword parsing is enough for the demo. Show the parsed intent as a small confirmation ("✓ Color → Soul Red, View → Trunk") so observers see the agent concept.
- **Stretch (only if everything else works):** wire the text box to the Web Speech API for actual voice input in Chrome. Degrade gracefully where unsupported.

### 7. Booking moment (tiny)
- A "Book test drive" button that opens a summary card: chosen color name, an image-like 3D snapshot or just the live canvas, and a fake confirmation. No real form/backend. This closes the narrative loop of the demo.

## Look and feel

- Dark, premium, minimal UI — think automotive configurator: near-black background or soft studio gradient, thin sans-serif type, generous spacing, white/red accents (Mazda red `#910a2d` as accent).
- UI overlays the 3D canvas (canvas is full-bleed; controls float on top).
- 60fps target on a laptop. If the model is heavy, decimate or reduce texture sizes rather than shipping a janky demo.

## Acceptance checklist

- [ ] `npm install && npm run dev` → working demo, no extra steps
- [ ] Rotate + zoom with mouse/touch
- [ ] Color changes smoothly via swatches AND via text command
- [ ] At least 3 camera preset views with animated transitions
- [ ] Doors or trunk open (or the documented camera fallback)
- [ ] Assembly/reveal intro sequence
- [ ] All scene changes flow through the single `CarConfig` state object
- [ ] README: model source + license, how to run, how to swap in a different GLB, and the `CarConfig` schema documented for the future voice-agent integration

## Out of scope

Real voice/LLM integration, backend, auth, real booking, mobile app packaging, multiple car models. Mention in the README how each would slot in, but do not build them.
