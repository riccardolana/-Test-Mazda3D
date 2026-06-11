# CLAUDE.md — Mazda Test Drive Studio

3D Mazda CX-5 configurator prototype demonstrating a future **voice-driven test
drive booking app**. Demo-quality on purpose (per `mazda-test-drive-prototype-brief.md`,
the original spec — kept in repo root): no backend, no auth, no real booking.
User-facing docs live in `README.md`; this file is the working map for code sessions.

## Commands

```bash
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # tsc -b && vite build → dist/
npx tsc --noEmit   # type-check only

# Deploy (Vercel project vml3/test-mazda3d → https://test-mazda3d.vercel.app)
vercel pull --yes --environment production   # only needed once per machine
vercel build --prod && vercel deploy --prebuilt --prod
```

- GitHub: `riccardolana/-Test-Mazda3D` (leading dash is intentional; it breaks
  Vercel's GitHub auto-connect — harmless, we deploy via CLI prebuilt).
- The production **alias** is public; deployment-specific `…-vml3.vercel.app`
  URLs return 401 (vml3 team SSO) — that's expected, don't fight it.

## Architecture invariant (the whole point of the prototype)

**The 3D scene reacts ONLY to the `CarConfig` state object — never to raw text.**
UI chips, the command box, and the future voice agent are all just producers of
`ConfigPatch` objects. If a change makes the scene read anything other than the
zustand store, it breaks the demo's core argument.

```
chips / text box / Web Speech ─▶ parseCommand() ─▶ ConfigPatch ─┐
window.mazdaAgent.apply(patch) ─────────────────────────────────┼─▶ zustand store (CarConfig)
                                                                ▼
                              useFrame in CarModel / CameraRig reads the store
                              (paint tween, hinge damps, assembly, camera presets)
```

### File map

| File | Role |
|---|---|
| `src/state/store.ts` | `CarConfig` + zustand store + assembly step timer. The heart. |
| `src/state/palette.ts` | 6 Mazda paints, view/door labels |
| `src/agent/parseCommand.ts` | keyword parser: free text → `ConfigPatch` (stand-in for LLM/voice; swap this file for the real pipeline) |
| `src/agent/agentBridge.ts` | `window.mazdaAgent` — `.apply(patch)`, `.say(text)`, `.rebuild()`, `.config`. The agent API surface AND the console test harness |
| `src/scene/rigCar.ts` | load-time discovery: orientation, door hinge pivots, wheel axles, camera presets, paint material swap, normalization wrapper |
| `src/scene/CarModel.tsx` | per-frame animation (maath damps): paint color, door angles, assembly staged→home |
| `src/scene/CameraRig.tsx` | drei `CameraControls`: animated presets, portrait aspect compensation, interior FOV widening, idle turntable |
| `src/scene/Experience.tsx` | Canvas, shadows + N8AO/bloom/tone-mapping/vignette composer, ContactShadows, dev `window.__three` handle. Tone mapping is per-environment (ACES_FILMIC in studio, NEUTRAL in HDRI locations) and MUST live inside the composer as a `<ToneMapping>` effect — the EffectComposer forces `gl.toneMapping = NoToneMapping`, so renderer-level tone mapping silently does nothing. Studio is lit by a procedural Lightformer rig; location HDRIs are LOCAL files in `public/hdri/` (no *network* HDRIs — keeps demo offline-safe) |
| `src/agent/voice.ts` | agent speech: Gemini TTS REST (`gemini-2.5-flash-preview-tts`, voice Sulafat, key in `.env.local` as `VITE_GEMINI_API_KEY`) with Web Speech fallback on missing key or any fetch/decode error — demo still talks offline |
| `src/ui/*` | TopBar, IntroOverlay (+assembly captions), AgentPanel, IntentToast, BookingModal |

## The GLB and its trap

`public/models/mazda-cx5.glb` (5.8 MB, ~578k tris, meshopt + 1K WebP) comes from
the client's `../MazdaCX-5_Blender/2026_Mazda_CX-5_NonRigged.blend` (138 MB, NOT
in this repo, not redistributable — the deployed GLB being public is a known
accepted tradeoff).

**Trap:** in this GLB every part is a child of a **millimetre-scaled `Body`
node** (and node frames may carry the Y-up conversion). Any world-space offset
or rotation axis MUST be converted into the pivot's parent-local space —
`rigCar.ts` does this via `worldToLocal` (points) and `transformDirection`
(axes). Naive world-units offsets silently become ~1000× too small (invisible).
This bug shipped once; don't reintroduce it.

### Regenerate / swap the model

Blender 5.1.2 is at `/Applications/Blender.app` (user-installed; don't brew).

```bash
# inspect node names/materials of any .blend
/Applications/Blender.app/Contents/MacOS/Blender --background model.blend \
  --python tools/inspect_blend.py

# export GLB — script strips SUBSURF modifiers (2.3M tris with, 578k without)
/Applications/Blender.app/Contents/MacOS/Blender --background model.blend \
  --python tools/export_glb.py -- /abs/raw.glb

# optimize — --join false --flatten false is NON-NEGOTIABLE
# (joining/flattening destroys the named nodes = kills every animation)
npx gltf-transform optimize raw.glb public/models/mazda-cx5.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 \
  --join false --flatten false --simplify false --palette false
```

For a different car: update `NAME_MAP` in `src/scene/rigCar.ts`. Everything
else (orientation via headlights bbox, hinges, axles, presets, unit scale) is
discovered at load. Missing doors? Remove them from `NAME_MAP.doors` — UI and
parser degrade gracefully.

## Verifying changes in the browser

- `window.mazdaAgent.say('make it red and open the trunk')` drives the full
  pipeline from the console; `.config` reads state; `.rebuild()` replays the
  assembly intro.
- `window.__three` (dev only) exposes the r3f state for scene inspection; the
  car rig lives at `scene.userData.carRig` on the GLTF scene node.
- **Claude Preview panel gotcha:** HMR accumulates connected page instances
  (duplicate `[vite] connecting` logs); eval/screenshot can hit a stale ghost
  instance (unsized 300×150 canvas, lost WebGL context). If the canvas goes
  black or `window.__three` vanishes, `preview_stop` + `preview_start` fresh
  instead of debugging.
- Screenshots through the preview pipe lag ~3-6s — don't trust them for timing
  a 6s animation; sample `assemblyStep`/DOM via timed `eval` instead.
- `useGLTF` caches the scene across HMR, and `rigCar` mutates it (pivot
  reparenting). It's guarded by `scene.userData.carRig`, but stale rigs survive
  HMR — after editing `rigCar.ts`, do a full page reload, not just HMR.

## Known non-issues

- `THREE.Clock` deprecation warnings in console — from drei internals, ignore.
- Vite build warns about the 1.27MB chunk (355KB gzip) — acceptable for a 3D
  demo, code-splitting not worth it here.
- `trim` exists in `CarConfig` but has no visual mapping yet (reserved by the
  brief's schema).
