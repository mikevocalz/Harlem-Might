# Harlem Might motion + spatial hero contract

## App boundary

- `apps/web` (Next.js) owns the public/product site: header, footer, homepage,
  product screens and the Kinetrell/Lenis/GSAP motion system.
- `apps/web-vite` owns the internal curator/catalogue workspace and
  Payload-backed operational tooling. It must not become a second product site.
- `packages/spatial` owns reusable spatial/WebGPU rendering surfaces shared by
  the product site and immersive routes.

## Ownership

Kinetrell owns the motion language.

Web:
- Kinetrell creates Lenis.
- Kinetrell owns the Lenis ↔ GSAP ticker bridge.
- Kinetrell attaches ScrollTrigger to the hero timeline.
- GSAP executes the DOM transform timeline.
- Three/WebGPU receives normalized progress without triggering React renders.

Native:
- use Kinetrell's `useKinetrellScroll()` and `useParallaxStyle()` for the equivalent scroll choreography.
- react-native-webgpu presents the same Sightline scene.
- Do not recreate the hero in Skia or a platform-specific 2D mock.

## Scroll chapters

0.00 — product floats as a premium industrial-design object.
0.20 — glasses turn toward the viewer; route ribbon becomes legible.
0.45 — compute puck moves closer; POI anchors rise.
0.70 — route and AR relationship dominate.
1.00 — handoff into the next editorial chapter.

Reduced motion:
- no smooth-scroll ownership
- no ambient POI pulse
- static ~55% presentation state
- content/CTAs remain fully available

## UI boundary

All semantic UI comes from `packages/ui`.
The WebGPU `<canvas>` is wrapped by `GpuCanvas` inside the UI DOM fork.
Spatial packages may use native rendering primitives such as react-native-webgpu Canvas because they do not emit raw HTML.

## Future GLB admission

Procedural geometry is deliberate for the first implementation. A later authored GLB must pass:
1. game-asset-production
2. game-visual-debugging
3. game-performance-optimization

before replacing it.
