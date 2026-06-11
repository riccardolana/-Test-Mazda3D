# Addendum — Realism Polish ("not a render" pass)

> **Run AFTER the main v2 plan's Tasks 0–12 are complete (Cowork) and merged into the working tree.** These tasks modify `Experience.tsx`, `EnvironmentStage.tsx`, `rigCar.ts`, and `CarModel.tsx` — files the main plan also touches. Execute in Claude Code (needs browser verification). Do NOT run `npm install` or any git command while the Cowork session is still active.

**Why:** feedback that the interiors look "fake / like a render". Diagnosis of the current renderer:

1. **No ambient occlusion** — the GLB interior materials carry baseColor + normal maps but no AO, and there's no SSAO pass; seams, footwells and dash joins receive full light. This is the #1 CG tell.
2. **No real-time shadows** — both directional lights have `castShadow` off; only ground `ContactShadows` exist, so nothing inside the cabin shades anything.
3. **Procedural Lightformer environment** — clean but sterile omnidirectional glow; real HDRI studios have the gradient falloff that sells leather and paint.
4. **Default ACES tone mapping** — saturated/punchy; Khronos *Neutral* tone mapping (designed for product-configurator color accuracy, in three since r162) reads far more photographic.

All packages/assets below were verified live on 2026-06-11:
- `@react-three/postprocessing@3.0.4` — peers: r3f ^9, react ^19, three ≥0.156 ✓; bundles `n8ao@^1.9.4` (SSAO) and `postprocessing@^6.36.6` (three <0.185 ✓ — **pin three to 0.184.x; don't bump three past 0.184 without re-checking this peer range**).
- Poly Haven studio HDRIs (CC0, 2K .hdr, HTTP 200): `studio_small_09` (6.0 MB, the classic car-paint studio), alternates `brown_photostudio_02` (6.2 MB, warmer), `autoshop_01` (6.2 MB, literal workshop — on-brand but busier).

---

### Task R1: Install postprocessing + download the studio HDRI

**Files:**
- Modify: `package.json`
- Create: `public/hdri/studio_2k.hdr`

- [ ] **Step 1: Install (only once Cowork is done)**

```bash
cd "/Users/riccardo.lana/Projects/Madza/3d Experience"
npm install @react-three/postprocessing
```

- [ ] **Step 2: Download the studio HDRI**

```bash
curl -L --retry 3 -o public/hdri/studio_2k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_09_2k.hdr"
file public/hdri/studio_2k.hdr   # expect: Radiance HDR image data
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json public/hdri/studio_2k.hdr
git commit -m "feat: postprocessing deps + CC0 studio HDRI (Poly Haven studio_small_09)"
```

---

### Task R2: Neutral tone mapping, shadows, and the effect stack

**Files:**
- Modify: `src/scene/Experience.tsx`

- [ ] **Step 1: Update the Canvas + lights + add EffectComposer**

In `src/scene/Experience.tsx`:

a) Add imports:

```tsx
import * as THREE from "three";
import { EffectComposer, N8AO, Bloom, Vignette } from "@react-three/postprocessing";
```

b) Change the `<Canvas>` props — `antialias: false` (the composer's MSAA takes over), Neutral tone mapping, shadows on, dpr capped at 1.75 (N8AO at dpr 2 is wasteful):

```tsx
    <Canvas
      dpr={[1, 1.75]}
      shadows
      camera={{ position: [8.5, 3.2, 10.5], fov: 38, near: 0.05, far: 250 }}
      gl={{
        antialias: false,
        preserveDrawingBuffer: true,
        toneMapping: THREE.NeutralToneMapping,
        toneMappingExposure: 1.0,
      }}
```

c) Make the key light cast shadows:

```tsx
      <directionalLight
        position={[5, 9, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
      />
```

d) Add the effect stack inside the Canvas, after `</Suspense>`:

```tsx
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={0.35} intensity={2.5} distanceFalloff={1} quality="medium" halfRes />
        <Bloom mipmapBlur intensity={0.12} luminanceThreshold={1.1} />
        <Vignette eskil={false} offset={0.18} darkness={0.5} />
      </EffectComposer>
```

Numbers are starting points: `aoRadius` 0.35 is tuned for a ~4.6-unit car (cabin-scale crevices); raise `intensity` toward 3.5 if the cabin still looks flat, drop to 2 if it looks dirty. Bloom's threshold >1 means only genuinely bright highlights (HDRI sun, chrome glints) bloom.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` — expected clean.

- [ ] **Step 3: Browser check (per CLAUDE.md gotchas — fresh preview, full reload)**

Interior view: seat seams/footwells should show soft darkening (N8AO). Verify the booking-card snapshot still works (`useStore.getState().capture()` returns a data URL with the car visible — `preserveDrawingBuffer` + composer can interact; if the capture comes back black, set `<EffectComposer enableNormalPass={false}` aside and instead capture via `gl.domElement.toDataURL` right after a manual `gl.render` — flag it rather than ship a black booking card).

- [ ] **Step 4: Commit**

```bash
git add src/scene/Experience.tsx
git commit -m "feat: neutral tone mapping, key-light shadows, N8AO/bloom/vignette stack"
```

---

### Task R3: Real studio HDRI lighting + shadow flags on the model

**Files:**
- Modify: `src/scene/EnvironmentStage.tsx`
- Modify: `src/scene/rigCar.ts`

- [ ] **Step 1: Swap Lightformers for the local HDRI (lighting only — keep the dark backdrop look)**

In `EnvironmentStage.tsx`'s `Studio()` component, replace the whole `<Environment resolution={256} frames={1}>…</Environment>` Lightformer block with:

```tsx
      <Environment files="/hdri/studio_2k.hdr" environmentIntensity={0.9} />
```

(No `background` prop — the dark `#0a0a0d` studio backdrop and fog stay; only reflections/ambient light come from the HDRI. The file is local, so the offline-safe rule in CLAUDE.md still holds — update that line in CLAUDE.md when committing: the constraint is "no *network* HDRIs", not "no HDRIs".) Remove the now-unused `Lightformer` import.

- [ ] **Step 2: Enable shadow casting/receiving on the car**

In `rigCar.ts`, inside the existing `scene.traverse((o) => {` material-swap block, after the `if (!(o as THREE.Mesh).isMesh) return;` line add:

```ts
    mesh.castShadow = true;
    mesh.receiveShadow = true;
```

(`mesh` is already defined on the next line in the current code — move the `const mesh` declaration above these two lines.)

- [ ] **Step 3: Browser check**

Full page reload (rigCar mutates the cached GLTF scene — stale rigs survive HMR). Exterior: paint reflections should show the studio's softbox gradients instead of uniform rectangles; door-open shots should drop a soft interior shadow. Check all 4 environments still light correctly (each Location's own `<Environment>` overrides the studio one).

- [ ] **Step 4: Commit**

```bash
git add src/scene/EnvironmentStage.tsx src/scene/rigCar.ts CLAUDE.md
git commit -m "feat: HDRI studio lighting and car shadow flags"
```

---

### Task R4: Cabin material realism

**Files:**
- Modify: `src/scene/rigCar.ts`
- Modify: `src/scene/CarModel.tsx`

The main plan's cabin tint drops the baseColor textures, which flattens the baked-in grain/AO variation. Refinement: **keep the factory textures whenever the user picks the default obsidian leather** (the GLB's own dark leather is the most realistic thing we have), and use flat-tint-plus-normal-map only for the non-factory colourways. Plus subtle leather clearcoat.

- [ ] **Step 1: Preserve the source maps in `rigCar.ts`**

In the cabin-material block added by main-plan Task 8, next to `live.userData.leatherNormal = src.normalMap ?? null;` add:

```ts
          live.userData.srcMap = src.map ?? null;
```

- [ ] **Step 2: Map/tint switching + leather clearcoat in `CarModel.tsx`**

Replace the cabin `forEach` body (main-plan Task 9, section "2. cabin") with:

```tsx
    const cloth = config.interior.material === "cloth";
    const factory = !cloth && config.interior.color === "obsidian";
    tmpColor.set(factory ? "#ffffff" : INTERIOR_COLORS[config.interior.color].hex);
    rig.cabinMats.forEach((m) => {
      easing.dampC(m.color, tmpColor, 0.25, delta);
      easing.damp(m, "roughness", cloth ? 0.92 : 0.55, 0.25, delta);
      easing.damp(m, "clearcoat", cloth ? 0 : 0.12, 0.25, delta);
      m.clearcoatRoughness = 0.7;
      const wantMap = factory ? ((m.userData.srcMap as THREE.Texture | null) ?? null) : null;
      if (m.map !== wantMap) {
        m.map = wantMap;
        m.needsUpdate = true;
      }
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
```

(With the factory map active, the colour damps to white so the texture shows untinted; switching to tan/greige drops the map and tints the flat material — the N8AO pass from Task R2 restores the depth the baked texture used to provide.)

- [ ] **Step 3: Type-check + browser check**

`npx tsc --noEmit`, then in the browser: interior view, cycle black → tan → cloth greige → back to black leather. Black leather should look exactly like the original GLB (factory maps back on); tinted versions should show grain via normals + AO, no waxy flatness.

- [ ] **Step 4: Commit**

```bash
git add src/scene/rigCar.ts src/scene/CarModel.tsx
git commit -m "feat: factory cabin textures for default colourway, leather clearcoat"
```

---

### Task R5: Verification + performance gate

- [ ] **Step 1: FPS check** — `preview_eval` a 3-second `requestAnimationFrame` counter in exterior view, interior view, and mountain+driving. Expected ≥45 fps on this machine. If below: `quality="performance"` on N8AO, then `multisampling={2}`, then dpr `[1, 1.5]`, in that order.
- [ ] **Step 2: Screenshot tour** — studio exterior, interior (black leather), interior (tan), mountain drive — compare against pre-polish screenshots for the "less CG" verdict.
- [ ] **Step 3: `npm test && npm run build`** — all green (no logic was touched, but the build must pass with the new deps).
- [ ] **Step 4: Commit any tuning, then this addendum's checkboxes**

---

## Considered and rejected (for now)

- **Real glass transmission** (`MeshPhysicalMaterial.transmission`) — proper refraction on 6 glass materials is a big perf hit on a 578k-tri model; the current alpha-blend glass reads fine once AO/shadows land.
- **DoF / tilt-shift** — fights the user-driven camera; revisit only for marketing screenshots.
- **Re-texturing seats with ambientCG leather** — the GLB's own leather maps are higher quality than generic tileables; we keep them (Task R4) instead of replacing them.
- **AgX tone mapping** — also good; Neutral chosen because it's purpose-built for configurator colour fidelity (Mazda paint names must stay recognizable). One-line swap if Neutral feels too flat: `THREE.AgXToneMapping`.
