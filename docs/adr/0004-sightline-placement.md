# ADR 0004: Sightline lives on /ar only

**Status:** Accepted
**Date:** 2026-10-07
**Deciders:** Mike Allen (repo owner)

## Context

`packages/spatial/sightline` renders original Harlem Might concept hardware: slim glasses, a separate compute puck, a route ribbon and place markers. It uses one `THREE.WebGPURenderer` and one TypeGPU root on the same `GPUDevice` (`SightlineHeroRenderer.ts`). Until this phase nothing imported it, and its README called it "the Harlem Might hero".

The pack offered four homes: a later homepage chapter, `/ar`, `/download`, or a dedicated spatial page. Facts that decide it:

- The homepage tells the real block and map story with static Mapbox images, and its LCP budget is tight (architecture doc, performance table). A WebGPU chunk there costs every visitor, including the ones who only came for the map.
- The hardware does not exist. The phone AR it sketches does not exist either: no `ViroARScene` reads the place catalogue; the app's only AR scene is the tabletop race (audit §19). Whatever page shows Sightline has to say "concept" right next to it.
- `/download` is a conversion page and a never-bento page. A render of glasses there would read as something you can download.
- A dedicated spatial page would be a nav item for one render, which the do-not-build list rules out (audit §21: no new nav for empty sections).
- `/ar` already exists, is linked from the footer ("AR concept") and the homepage sidewalk chapter, and its whole job is to explain the concept honestly.

## Decision

1. Sightline mounts on `/ar` only, never on `/`, `/download` or a new route.
2. It is a lazy client island (`apps/web/components/ar/SightlineIsland.tsx`). `next/dynamic` with `ssr: false` loads `@acme/spatial/sightline` only after an `IntersectionObserver` (400px root margin) sees the band, and only when `navigator.gpu` exists. It sits in the third section, far below the LCP element (the h1 lead on phones, the Apollo map image from 768px up).
3. Progress is one normalized number read from the band's layout inside the render loop (`getProgress`, stable `useCallback`). It never enters React state or a store. The island reads layout directly instead of a GSAP ScrollTrigger so the chunk does not pull GSAP in; Lenis moves the real scroll position, so the reading matches.
4. One renderer, one device, one TypeGPU root per page. DPR is capped at 2. Unmount stops the loop, disposes geometry, materials, the TypeGPU root and the renderer, then destroys the device.
5. Reduced motion renders one static frame and starts no loop; a resize redraws that frame.
6. No `navigator.gpu`, no adapter, a failed init or a lost device: the canvas is never shown blank. `SightlineHeroCanvas` calls `onUnavailable`, and the island shows the same description as text with the reason, shrinking its box to fit.
7. The canvas is `role="img"` with an `aria-label` that starts "Concept render of Sightline". The caption says the hardware does not exist.

## Consequences

- Home LCP and INP carry no WebGPU cost. `/ar` initial JS does not include three or TypeGPU.
- The status list on `/ar` names Sightline as **concept** alongside the other targets.
- This places a glasses render on a public page, which audit §21 ("no glasses or Specs claims, renders or waitlist on public pages until a build passes the device bar") ruled out. The Phase 7 brief overrides that for this one render on the condition that it is labelled a concept everywhere. If the repo owner prefers the audit line, deleting `<SightlineIsland />` and its band from `apps/web/app/(site)/ar/page.tsx` removes it with no other change.
- `SightlineHeroCanvas.native.tsx` did not get `ariaLabel`, `onReady` or `onUnavailable`. Nothing native mounts it today.
- Three's `WebGPURenderer` keeps its own idle `requestAnimationFrame` loop after `init()` even with no user loop, so a reduced-motion page still schedules frames without drawing. Stopping that needs a private API; left as is.
- Revisit when a place-label AR build has the 8-point record in `docs/XR-PLATFORM-MATRIX.md`. That is when `/ar` could carry proof (the B11 cluster) and Sightline could move or go.
