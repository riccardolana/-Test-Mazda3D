# Product

## Register

product

## Users

Two audiences. Primary: VML/Mazda stakeholders watching or driving a live demo (desktop or phone, often in a meeting room with a projector — bright ambient light, no time to learn UI). Secondary: the prospective Mazda buyer the demo role-plays — someone configuring the CX-5 they want to test drive, guided by a voice agent, finishing in a booking. Both need the interface to be instantly legible and impossible to get lost in; the demo lives or dies in the first 60 seconds.

## Product Purpose

A working prototype of a future voice-driven test drive booking app. It exists to prove one architectural argument — speech becomes structured `CarConfig` state, and the 3D scene reacts only to that state — and to make that argument feel desirable: a guided build (vibe → interior → lifestyle) that reveals the car in a matching environment and ends in a booking. Success = the flow runs smoothly end-to-end and the audience asks "when can we ship this?".

## Brand Personality

Dynamic, precise, alive. Mazda's "Jinba Ittai" (horse and rider as one) — the interface should feel responsive and eager the way the car does, not like a quiet luxury showroom. Soul Red is the energy carrier on near-black studio surfaces; motion is part of the brand voice (the assembly choreography, the drive mode, the camera work), always controlled and exact, never bouncy or playful.

## Anti-references

- Toy-like web configurators (oversized candy buttons, confetti moments, cartoon physics).
- Gamer-RGB aesthetics (neon glows, animated gradients, dark-mode-as-costume).
- Generic SaaS dashboard grammar (card grids, eyebrow labels, hero metrics) — this is a stage for a car, not an admin panel.
- Dead, static product pages — if nothing moves, it isn't Mazda.

## Design Principles

1. **The car is the interface.** Chrome stays out of the way: one panel, one toast, one modal. Every pixel of UI must justify displacing the 3D scene.
2. **State is the single voice.** Chips, text, and speech all converge on `CarConfig`; the UI never fakes a result the store doesn't hold.
3. **Motion with intent.** Animations communicate state change (doors, paint, environments) with exact, eased timing — and every one has a reduced-motion fallback.
4. **Guided first, free always.** The agent leads newcomers stage by stage, but freeform control is one utterance away at all times.
5. **Demo-honest.** No fake loading states, no placeholder lorem; what's shown works, what doesn't exist isn't shown.

## Accessibility & Inclusion

Pragmatic WCAG AA for the 2D UI layer: text contrast ≥4.5:1 (including placeholder and dim text), visible focus states on all interactive elements, aria-labels on icon-only buttons, `prefers-reduced-motion` alternatives for UI animation. The 3D canvas itself is demo-grade (no canvas-content alternatives), accepted for a prototype.
