# Premium experience architecture (Phase 2)

Phase 2 of prompt pack v3 (`02-architecture-motion-performance.md`). Written 2026-10-07 against `main` after `cc5d386`. Inputs: `docs/design/PREMIUM_EXPERIENCE_AUDIT.md` (cited as "audit §n"), `docs/adr/0002-integrate-site-motion-perf-pr15.md`, `docs/design/PRODUCT_SITE_MOTION.md`, `docs/ADAPTIVE_EXPLORE_LAYOUT.md`.

Seams are cited as `path:symbol`. Line numbers drift while Phase 2 agents edit `packages/theme`, `packages/ui/mights`, `packages/payload` and `packages/app`, so symbols are the stable reference.

## Installed versions this doc is written against

| Package | Version | Source |
|---|---|---|
| `next` | 16.3.8 | `node_modules/next/package.json:version` |
| `react` | 19.3.0 | `node_modules/react/package.json:version` |
| `mapbox-gl` | 3.32.0 | `node_modules/mapbox-gl/package.json:version`; `exports` has `"."` (UMD `dist/mapbox-gl.js`, 1.8 MB) and `"./esm"` (`dist/esm/*`, split into `core`, `shared`, `standard.*`, `lite.main`, `worker` chunks) |
| `gsap` | 3.15.0 | `node_modules/gsap/package.json:version` |
| `lenis` | 1.3.26 | `pnpm-workspace.yaml` catalog `lenis` |
| `kinetrell` | `github:mikevocalz/Kinetrell#344de51` | `pnpm-workspace.yaml` catalog `kinetrell` |
| `three` | 0.186.1 | `pnpm-workspace.yaml` catalog `three` |
| `typegpu` | 0.12.6 | `node_modules/typegpu/package.json:version`; `@typegpu/three` 0.12.1 |
| `zustand` | 5.0.15 | `node_modules/zustand/package.json:version` |

## Standing decisions recorded here

| ID | Decision | Where it lands |
|---|---|---|
| D1 | Public site is dark by default, gold primary. Light values stay for the mobile app's light mode. | `packages/theme/tokens.ts` (Design-System Steward) |
| D2 | Map-style test compares `mapbox/dark-v11` with a warm-dark style built from tokens. No light-map prototype. | ADR-04; Phase 4 runs the test (audit §16) |
| ADR 0002 | #15 and #14 merged to `main` first; every phase branches from `main`. | `docs/adr/0002-integrate-site-motion-perf-pr15.md` |
| D6/D7 | Walks, Stories and Events get Payload collections and server-only readers in `packages/app/content` that return `{ status: 'ok' } \| { status: 'unavailable' }`. Places stay on the explore fixture until Payload Places are seeded. | ADR-01, "Data ownership" |
| D8 | B12 Profile/Saved is struck. | Rendering map (no route) |
| D11 | One PR per phase, merged to `main` when its gates pass. | All ADRs |

## ADRs

Format per ADR: context, decision, consequences. ADR 0002 (PR #15 integration) is accepted and not repeated; every ADR below builds on `main` with #15's motion layer, responsive static maps and CLS 0 as the floor.

### ADR-01: Server-first rendering, client islands only where state or GPU lives

**Context.** `ProductHome` is `"use client"` for the whole page (`apps/web/components/site/ProductHome.tsx` first line) because it calls `useHomeMotion` and `useBrowserReducedMotion`. Every heading, paragraph and bento on `/` therefore ships as client JS. Place, Walks, Stories, Today and AR are already server pages (audit §18 "Rendering map today"). Explore is a server page wrapping the client `ExploreWorkspace` in `Suspense` (`apps/web/app/(site)/explore/page.tsx:ExplorePage`).

**Decision.**
- Route `page.tsx` files stay Server Components. Headings, editorial copy, place facts, story prose, event lists, sources and credits, nav links and bento module content render on the server. The bento grid is CSS (`MightsPlaceBento` spans), never a client layout.
- Client islands are limited to: the Explore workspace and GL map, search/filter controls, saved state, the motion binder, WebGPU (Sightline), the AR capability check, and any future profile surface.
- Home splits into a server `ProductHome` and one client `HomeMotion` island that calls `useHomeMotion(reduced)` and renders nothing. `motion.ts` binds by marker id over `document` (`useHomeMotion` comment: "the document is a safe query scope"), so the island does not need to wrap the content.
- CMS reads (D6/D7) run on the server through `packages/app/content` readers marked `server-only`. A reader never throws to the page. It returns `{ status: 'unavailable' }`, and the route renders its honest empty state.
- `/today` stays request-time (`connection()` in `today/page.tsx`). Other content routes are static or ISR once Payload is the source.

**Consequences.** Home initial JS should drop by the RNW text and Mights tree that today hydrates for no reason; Phase 3 measures it against the 292 KB gzip baseline (audit §18 "Bundle"). Solito `Link` still makes cards client components (audit §18), which is acceptable because they hold no state. Any new `"use client"` at page level needs a line in this doc's rendering map saying why.

### ADR-02: State topology (Zustand slices, URL, imperative refs)

**Context.** Explore state is URL-owned for `view`, `q`, `category`, `place` (`apps/web/components/explore/ExploreWorkspace.tsx:ExploreWorkspace`). `useExplore` (`packages/app/features/explore/explore.store.ts:useExplore`) holds `query` plus fields only mobile reads (`category`, `selectedPlaceId`, `savedPreviewIds`). Web and mobile own selection differently (audit §18 "URL workspace state and Zustand"). The roster bans bare `useState`/`useReducer`. Four violations remain in `packages/ui/backgrounds/*.skia.tsx` and `SkiaWebGate.tsx` (audit §18).

**Decision.**

| State | Owner | Notes |
|---|---|---|
| Search draft | Zustand slice `explore.search` (`draft`, `setDraft`) | Separate from committed `?q`. Debounced `history.replaceState` commits it (250 ms, current behaviour) |
| View, q, category, place | URL | Read via `useSearchParams`. On web the store mirrors them read-only; it never writes them back |
| Sheet / inspector | Zustand slice `explore.sheet` (`open`, `detent: 'peek' \| 'half' \| 'full'`, `returnFocusId`, added with the Phase 4 sheet) | `open` derives from `?place`; detent is UI-only and never in the URL. Focus moves imperatively (see Accessibility) |
| Location permission | Zustand slice `explore.location` (`permission: 'unknown' \| 'prompt' \| 'granted' \| 'denied' \| 'unsupported'`) | Written from the Permissions API and the geolocation callback only |
| Saved ids | `useExplore.savedPreviewIds` + `toggleSavedPreview` (`explore.store.ts`) | In memory only. Durable saves belong to Payload `saved-places`, per member and keyed by CMS place id (`docs/AUTH_PROFILE.md`); persisting fixture slugs locally would drift from that list, and `explore.store.ts` is imported by server code, so it cannot pull in MMKV |
| Map camera | Imperative ref on the `mapboxgl.Map` (`ExploreMap.tsx` `mapRef`) | Never React state, never a store. Selection drives `flyTo`/`jumpTo` through `applySelection` |
| Scroll progress, GPU uniforms | Refs / getter callbacks | `SightlineHeroCanvas` already takes `getProgress: () => number` |

- Slices compose into the existing `useExplore` store so mobile keeps one import. Per-instance state in shared primitives uses `packages/ui/use-instance-store.ts:useInstanceStore`.
- React 19 `useOptimistic` and `useActionState` are allowed for save and sign-in flows.
- The four Skia `useState` calls move to `useInstanceStore` in the phase that next touches `packages/ui/backgrounds`. They are not on any web route today.
- The local `matches` in `ExploreWorkspace` is deleted in favour of `explore.store.ts:filterHarlemPlacePreviews`.

**Consequences.** One owner per value, so the store can never disagree with the address bar on web. Mobile keeps store-owned selection because native navigation has no URL; this platform difference is intentional and documented in "Explore state contract". Camera stays out of React, so pan and zoom never trigger renders.

### ADR-03: Mapbox strategy

**Context.** `ExploreMap` lazy-imports `mapbox-gl` inside an effect (512 KB gzip, 1.86 MB raw) and creates one DOM `<button class="mights-marker">` per mapped place (6 today). Mapbox's `Marker` sets `role="img"` on any element without a role: `node_modules/mapbox-gl/dist/mapbox-gl-dev.js` `Marker` constructor, `if (!this._element.hasAttribute("role")) this._element.setAttribute("role", "img")` (line 111910 in 3.32.0). Axe fails `aria-allowed-attr` ×6 because `aria-pressed` is invalid on an img (audit §17).

**Decision.**
1. **DOM markers now.** Each marker element gets `el.setAttribute('role', 'button')` before `new mapboxgl.Marker({ element: el })`, so the constructor's `hasAttribute("role")` check leaves it alone. `aria-pressed` reflects selection. Keep the visible 28×28 diamond and add a transparent hit area to 44×44.
2. **Move to a GeoJSON source plus symbol layer** when any of these holds: more than 150 mapped places in one view, a clustering need, or a marker-diff cost above 16 ms on a 4× CPU trace. Selection and hover then use `map.setFeatureState`. Keyboard parity moves to the list (map/list contract below), because layer features are not focusable. Never one React component per map feature.
3. **ESM build: measure first.** `mapbox-gl/esm` exists in the `exports` map. Switch only if, on the section 18 protocol plus 3 DevTools traces, it improves at least one of transferred JS, parse/eval time, `map-idle`, or first-marker-click INP by 10% or more without breaking the worker under Turbopack. Report all four either way. No switch on reading alone.
4. **One style source.** The style string moves out of `MightsMapImage.tsx:STYLE` and `ExploreMap.tsx` into a single token (audit §16), so the D2 test is a one-line swap and static and GL can't drift.
5. **Camera** stays in `mapRef`. `applySelection` keeps `jumpTo` under reduced motion and `flyTo({ essential: false })` otherwise. The inspector inset reads one layout token instead of the `rightInset={460}` magic number.
6. **Catalogue updates.** Markers are read once on mount today. When places come from Payload, markers diff by id (add, remove, move) inside the same effect.
7. `mapboxgl.prewarm()` on "Open the map" hover/focus is allowed if the `map-idle` mark shows entry latency is the problem.

**Consequences.** The critical axe failure clears with a one-line change. The layer migration has a measurable trigger instead of a debate. Attribution stays visible on every map (Mapbox ToS).

### ADR-04: Static maps and the D2 style test

**Context.** Every image on every audited route is a Mapbox Static raster: 10 on `/`, 25+ across 9 routes (audit §1, §13). `MightsMapImage` emits `srcSet` only when the caller passes `sizes` (`packages/ui/mights/MightsMapImage.tsx:MightsMapImage`, `mapboxStaticSrcSet`). `places/[slug]/page.tsx` and `ar/page.tsx` pass none, so phones get one @2x raster: 847 KB and 677 KB, the LCP images behind mobile LCP 14.3 s and 9.0 s (audit §18).

**Decision.**
- Keep static maps where orientation is the point: the home hero field, place location, walk route, AR context.
- Pass `sizes` on every `MightsMapImage` caller. First: the place hero and `/ar`.
- Maps stop being the default bento fill. A bento module group carries at most one map raster; `map-dominant` renders one lead map with text-first supports (audit §14 variant table). Photographs come through `MightsFigure` under `docs/IMAGE_POLICY.md`.
- Placeholder bentos on `/walks`, `/stories`, `/today` are removed until data exists (audit §14 B6/B8/B10).
- Pitch ≤ 30 on informational maps (audit §9 H5).
- D2: Phase 4 compares `mapbox/dark-v11` against a token-derived warm-dark Studio style with the six measures in audit §16 and records the result as an ADR. No light prototype.
- First-party cached map derivatives are considered only if, after `sizes` and font subsetting, the section 18 protocol still shows the Mapbox raster as the LCP cost on a route.

**Consequences.** Mapbox request count on `/` drops from 10 toward 3 or 4. Place and AR LCP should fall to the ≤ 4 s target without touching Mapbox. The style token keeps static and GL in lockstep.

### ADR-05: Motion ownership and budget

**Context.** `apps/web/components/site/motion.ts` is the only file allowed to import `gsap` (restricted-imports rule in `apps/web/eslint.config.mjs`). `SiteMotionShell.tsx:SiteMotionShell` creates one Lenis through `kinetrell/web/lenis:createKinetrellLenis` and connects the GSAP clock via `kinetrell/web/gsap-lenis:connectGsapLenis`. Lenis is skipped on Explore and under reduced motion, but the GSAP (45.0 KB gzip) and Lenis + Kinetrell (17.3 KB) chunks still load on every route, including `/explore` (audit §18 "Bundle"). The sidewalk scrub reverses on scroll-up and leaves an 800 px blank band in captures (audit §9).

**Decision.**
- `motion.ts` stays the sole GSAP owner. New sections register by marker id through `motion-markers.ts:parseMotionMarker` (`mfx-` entrance, `mpx-` transform-only scrub, `trg-` trigger). No page-level `useEffect` + `gsap`.
- **Bento group reveal.** A bento is one `trg-bento-<id>` trigger. Modules carry `mfx-bento-<id>-<n>` with `n = 0` the dominant module. One timeline per bento: dominant first, supports after a short stagger. No per-module ScrollTrigger.
- **One Lenis, one clock.** No smooth scroll on Explore. Reduced motion means no Lenis at all.
- **Explore ships no GSAP or Lenis.** The shell loads the motion stack with a dynamic `import()` only on routes that animate, so `/explore` drops about 62 KB gzip of initial JS. Verified by the chunk list in the served HTML.
- Scrubbed reveals that hide content become one-way (`once: true`) entrances. Scrubs are allowed only on transform-only `mpx-` targets.
- Per-route budget lives in `PRODUCT_SITE_MOTION.md` ("Per-route motion budget").

**Consequences.** Motion review is a diff of one file plus marker ids. The dynamic import adds a chunk fetch on animated routes, which is fine because the pre-hide CSS only applies once `motion-armed` is set.

### ADR-06: Sightline ownership

**Context.** `@acme/spatial/sightline` has no importer outside its folder (audit §19). `SightlineHeroCanvas.web.tsx:SightlineHeroCanvas` requests an adapter and device, configures the context, creates `SightlineHeroRenderer` (one `THREE.WebGPURenderer` sharing the device, `tgpu.initFromDevice` for one TypeGPU root), caps canvas DPR at 2, and on unmount disposes the renderer (`SightlineHeroRenderer.ts:dispose` destroys the TypeGPU root and renderer) then `device.destroy()`. Progress enters through `getProgress()` read inside `setAnimationLoop`. Its README calls it the shipped hero.

**Decision.**
- Sightline mounts on `/ar` only, as a lazy client island below the LCP element (`next/dynamic`, `ssr: false`, mounted when its container enters the viewport). It is never the LCP element and never on `/`.
- Progress is normalized 0–1 and read through `getProgress`; it comes from the `motion.ts` ScrollTrigger progress held in a ref. No React re-render per frame.
- One renderer, one `GPUDevice`, one TypeGPU root per page. A second GPU surface on the same page shares the device or does not ship.
- `getProgress` must be referentially stable (module-level getter or `useRef`-backed), because it is an effect dependency and a new function would rebuild the device.
- Under reduced motion the canvas renders one static frame (`render(now, true)`) and stops the loop. Without `navigator.gpu`, a `MightsFigure` still with a "concept" caption takes its place.
- The `aria-label` and README drop "Mights" and describe the frame as a concept until a place-label AR build is verified (audit §19).

**Consequences.** WebGPU cost never touches home LCP or INP. `/ar` gets one visible sequence. Device loss or a missing adapter falls back to an image, never to a blank canvas.

## Route rendering map

Every route sits inside `SiteMotionShell` (navbar, dock, footer except on Explore). "Viro" is never on web: `@reactvision/react-viro` runs in `apps/mobile` only. Rive has no importer in `apps/web` source today; any future Rive use is presentation only (View Models bound to store state, never a second state owner). Every route renders inside a `<main>` landmark (see Accessibility). Error path for all routes is `apps/web/app/(site)/error.tsx`; unknown slugs call `notFound()`.

| Route | Server page | Client islands | Mapbox | Three/WebGPU | Static image | CMS data | Zustand | URL state | Hydration risk | Reduced-motion path | Error / offline | Bento |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Yes (after ADR-01 split) | `HomeMotion` (renders null), nav/dock | Static: hero field + B2 lead only | No | Hero preload (`fetchPriority=high`, `sizes`), `MightsFigure` photos | Places fixture now; Stories reader for B3 later | none | none | RNW atom mirror must cover any new shell atoms (`globals.css`); pre-hide only under `motion-armed` | `useHomeMotion` binds nothing; content at rest | Static HTML works with JS off; images have alt | B1, B2 (B3 alternate, not built; B4 deferred) |
| `/explore` | Yes, `Suspense` wrapper | `ExploreWorkspace`, `ExploreMap` | GL, lazy `import('mapbox-gl')` | No | none | Places fixture until Payload Places seeded | `explore.search`, `explore.sheet`, `explore.location` | `view`, `q`, `category`, `place` | `useSearchParams` forces client bailout to the Suspense boundary; fallback must reserve layout (CLS 0) | `jumpTo` instead of `flyTo`; no sheet slide; no Lenis | GL failure or no WebGL: list view with banner "Map unavailable, the list has every place"; list works offline once loaded | none (never-bento) |
| `/places/[slug]` | Yes, `generateStaticParams` | save button (mobile web later), nav | Static, `sizes` required, pitch ≤ 30 | No | `MightsFigure` then/now, map below | Fixture now; Payload Places later; Stories/Walks relations via readers | `savedPreviewIds` (when saving ships) | none | Solito `Link` cards are client; `priority` image must not be prefetch-preloaded from other routes (audit §18, confirm first) | B5 single group reveal or none | `notFound()`; missing coordinates show "Location pending verification" | B5 |
| `/walks` | Yes | none | Static per walk card when data exists | No | Walk lead figure | Walks reader `{status}` | none | none | low | none needed | `unavailable` → honest empty state + "Open the map" | B6 only with published walks |
| `/walks/[slug]` | Yes, static params from reader | stop list anchors (no JS needed) | Static route map, one raster | No | Stop figures | Walks reader, stops relate to place ids | none | `#stop-n` hash only | low | B7 reveal or none | `notFound()` when reader has no slug; `unavailable` → 503-style message, not a fake walk | B7 |
| `/stories` | Yes | none | none by default | No | Archive figure per story | Stories reader | none | none | low | none | `unavailable` → empty state | B8 only with published stories |
| `/stories/[slug]` | Yes | none | Optional small location map at end | No | `MightsFigure` archival, credits | Stories reader with place relations and sources | none | none | low | no parallax on prose | `notFound()`; sources block always rendered | B9 |
| `/today` | Yes, request-time (`connection()`) | none | none | No | Event image only with rights | Events reader; `endsAt` expiry | none | none (no `/today/[date]` yet) | date must render in the server's `America/New_York` day to match the H1 | none | `unavailable` or zero events → empty state, no place cards | B10 only with events |
| `/ar` | Yes | `SightlineHeroCanvas` lazy below LCP, capability check | Static context map with `sizes` | Sightline: one renderer, one TypeGPU root | Concept `MightsFigure` fallback | none | none | none | island mounts after paint, so no SSR mismatch | one static Sightline frame | No `navigator.gpu` → figure; copy uses concept status | B11 gated (audit §19) |
| `/download` | Yes | none | none | No | none | none | none | none | low | none | n/a | none |
| `/about` | Yes | none | none | No | `MightsFigure` | `apps/web/content/about.ts` | none | none | low | none | n/a | none |
| `/press` | Yes | none | none | No | `MightsFigure` | `apps/web/content/press.ts` | none | none | low | none | n/a | none |
| `/legal/[doc]` | Yes, `generateStaticParams` | none | none | No | none | `apps/web/content/legal.ts` | none | none | low | none | `notFound()` | none |

## Data ownership

One canonical path per object. Routes read through server-only readers; no route component holds content literals beyond UI copy.

| Object | Canonical source now | Canonical source target | Stable identity | Freshness fields | Reader |
|---|---|---|---|---|---|
| Place | `packages/app/features/explore/explore.store.ts:HARLEM_PLACE_PREVIEWS` | `packages/payload/src/collections/Places.ts` once seeded; the fixture is deleted in the same PR | `slug` (equals fixture `id`) | record: `dataQuality.state`, `lastReviewedAt`; per field: `hoursVerifiedAt`, `statusVerifiedAt`, `locationAccuracy` (audit §7 gaps) | fixture accessors now; `packages/app/content` place reader later |
| Walk | none | Payload `Walks` (D6) | `slug`; stops are ordered place relations | `publishedAt`, `lastReviewedAt` | `packages/app/content` walks reader → `{ status: 'ok', walks } \| { status: 'unavailable' }` |
| Story | none (`Pages` has no place relation) | Payload `Stories` (D6) with `places[]` relation and `sources[]` | `slug` | `publishedAt`, `lastReviewedAt`, per-source `accessedAt` | stories reader, same result shape |
| Event | none | Payload `Events` (D7) with venue place relation | id + `slug` | `startsAt`, `endsAt` (required), `sourceUrl`, `lastVerifiedAt` | events reader; filters `endsAt > now` server-side |
| Saved place | mobile store `savedPreviewIds` | `savedPreviewIds` in memory now; `packages/payload/src/collections/SavedPlaces.ts` when accounts ship | place `slug` | `savedAt` | client store |
| Media | Mapbox Static URLs | Payload `Media` + rights fields | asset id | `credit`, `license`, `rightsHolder`, `allowedUses`, capture date | via owning record |

**Never hardcoded in route or component source:** hours, open-now, current status, ratings, prices, ticket availability, accessibility facts, event listings, closures, entrances, "worth the trip today" claims, place facts duplicated from the place record (home copy links to the record instead of restating it). When a time-sensitive field is missing or past its window, the UI shows nothing or a source link (audit §7 "Never invent").

## Explore state contract

The URL is the source of truth on web. The rules below keep today's behaviour from `ExploreWorkspace.tsx` (`select`, `close`, `replace`, `onType`) and add the sheet and focus pieces.

| Action | History | Store effect | Focus |
|---|---|---|---|
| Type in search | `history.replaceState` after 250 ms debounce | `explore.search.draft` updates every keystroke | stays in the field |
| Submit search / clear | `router.replace` | draft equals committed `q` | stays |
| Pick category chip | `router.replace` | none (URL read) | stays on chip; live region announces "N places" |
| Toggle map/list | `router.replace` | none | stays on toggle |
| Select place (row or marker) | `router.push` `?place=` | `explore.sheet.open = true`, `returnFocusId` = id of the row or marker | moves to sheet heading |
| Close sheet (button or Escape) | `router.back()` if this session pushed, else `router.replace` without `place` | `open = false`, detent reset | returns to `returnFocusId`; falls back to the list row for that place |
| Browser Back with sheet open | handled by the router | sheet closes from URL | same return rule |
| Reload / shared link | none | store seeded once from URL (`q` → draft) | sheet heading if `place` is set, else page `<h1>` |
| Change sheet detent | none (never in URL) | `explore.sheet.detent` | unchanged |
| Pan / zoom | none | none (camera in `mapRef`) | unchanged |
| Locate me | none | `explore.location.permission` | button announces result |

Rules: one owner per row in ADR-02's table. Invalid `category` or `place` values fall back to `All` and no selection without rewriting the URL. Mobile native keeps store-owned selection and maps it to its own navigator; the shared panes read through selectors so the same components work on both.

## Adaptive layout

Width classes and foldable rules come from `docs/ADAPTIVE_EXPLORE_LAYOUT.md`; the native implementation is `apps/mobile/src/navigation/split-view/*` (`fold-layout.ts`, `index.web.tsx`). Web keeps those semantics and does not hardcode desktop pixel widths.

- **Desktop (≥ 1024 on web, expanded/large classes).** Master (search, chips, results) | map | inspector. The inspector docks as a column beside the master list, not floating at the far edge (audit §10), so row, marker and detail stay visually bound. Its width is one layout token that also feeds `ExploreMap`'s inset, replacing `rightInset={460}` and `lg:w-[440px]`.
- **Tablet and foldable.** Follow the size-class table: medium shows map + detail, expanded adds a narrow master rail. Book posture: master + map on the leading segment, detail on the trailing one, hinge as a non-interactive gap; the inspector overlays only the trailing segment. Tabletop: map above the fold, detail and controls below. Segment geometry comes from JS (Viewport Segments API with width-class fallback), never from a pile of breakpoints.
- **Mobile (< 600).** Map and list are peer modes behind one toggle placed bottom, above the dock, in thumb reach. Search is reachable from the map view. A selected place opens the sheet with detents `peek | half | full`, sized to content with a max height (no empty half sheet at 768). Dock and sheet respect `env(safe-area-inset-bottom)`. When the keyboard opens for search, the sheet drops to `peek` and the field stays above the keyboard (`interactive-widget=resizes-content` in the viewport meta).

## Accessibility architecture (WCAG 2.2 AA)

**Sheet and inspector as a dialog-like region.** Render the selected-place panel as a labelled region (`role="dialog"`, `aria-labelledby` = its heading, `aria-modal="false"` on desktop where the map stays usable; `true` on mobile `full` detent, with the rest of the page `inert`). On open, focus moves to the heading (`tabIndex={-1}`). Escape closes. On close, focus returns to `explore.sheet.returnFocusId` (marker or row). This fixes the audit's 2.4.3 failures: Close as the 15th Tab stop and focus dropping to `<body>` (audit §17). The existing `dialog.mights-sheet` CSS (`apps/web/app/globals.css`) is the styling hook.

**Focus not obscured (2.4.11).** `html { scroll-padding-top: 4rem; scroll-padding-bottom: calc(56px + env(safe-area-inset-bottom)); }` so the sticky navbar and fixed dock never cover a focused control. Today the dock covers 40 of 54 px of the focused "Open the map" at 390 (audit §17). Values come from the navbar and dock height tokens, not literals, and are re-measured with `tool/obs.js` after any shell change.

**Map/list parity contract.**
- Every place on the map is in the list; places without coordinates are in the list and the map states "N places have no map location yet".
- Every map outcome (select, open detail) is reachable from the list and keyboard. Markers are `role="button"` with `aria-pressed` and a name (ADR-03). Dragging is never required (2.5.7): zoom has ± controls.
- Filter and search results are announced through one `aria-live="polite"` region ("3 places") (4.1.3).
- If the map moves to symbol layers, markers lose focusability and the list becomes the keyboard surface; the map then exposes selection through the same live region.

**Reduced-motion plumbing.** One reader: `kinetrell/web/react:useBrowserReducedMotion('system')`, plus the synchronous `matchMedia` check already in `useHomeMotion`. Consumers: `SiteMotionShell` (no Lenis), `motion.ts` (no binds, no `motion-armed`), `ExploreMap.applySelection` (`jumpTo`), sheet transitions (none), Sightline (one static frame), CSS (`globals.css` view transitions to 0 s, beam static). Verify the Lenis-off path, which audit §17 left open.

**Landmarks.** Every route has exactly one `<main>`, owned by the page. Content routes already get it from `packages/ui/mights/MightsPage.tsx:MightsPage` (`<main>`), and home from `ProductHome`'s `Main`. Explore has none, which is why it fails `landmark-one-main`: `ExploreWorkspace`'s root becomes `Main` from `@acme/ui/tw`. `SiteMotionShell`'s wrapper stays a non-landmark `View` so no route ever nests two. The skip link targets `#main` on that wrapper today; it moves to the page's `<main>` (`id="main"`, `tabIndex={-1}`) so activation lands focus inside the landmark. Drop `role="region"` from unlabelled `Section`s (axe `aria-allowed-role`).

**Targets and contrast.** Map markers get a 44×44 hit area; chips and inputs get a ≥ 3:1 outline (1.4.11, audit §17). Focus bracket `.mights-focus` stays the single focus style.

## Performance budgets

Baseline: audit §18, Lighthouse 13.5.0 mobile preset (simulated throttling, 4× CPU, Moto G Power), production build, medians. "Gate" blocks merge. "Target" is where the named fixes should land; missing a target is reported, not blocking. JS is initial JS from the served HTML, gzip -9 per chunk.

| Route | LCP now → gate / target | CLS gate | TBT now → gate | INP (lab trace / field p75) | Initial JS now → gate / target |
|---|---|---|---|---|---|
| `/` | 9.29 s → no regression / ≤ 6 s | 0 | 48 ms → ≤ 100 ms | ≤ 200 ms on "Open the map" | 292 KB → ≤ 300 / ≤ 250 (ADR-01 split) |
| `/explore` | 5.27 s → no regression / ≤ 4 s | 0 | 342 ms → ≤ 300 ms (median of 5, max reported) | first marker click → sheet open ≤ 200 ms | 292 KB → ≤ 300 / ≤ 235 (no GSAP/Lenis); `mapbox-gl` lazy ≤ 520 KB |
| `/places/[slug]` | 14.29 s → no regression / ≤ 4 s | 0 | 83 ms → ≤ 100 ms | ≤ 200 ms | ≤ 300 |
| `/walks`, `/stories`, `/today` | 7.22 s (`/walks`) → no regression / ≤ 3 s once placeholder bentos go | 0 | 47 ms → ≤ 100 ms | ≤ 200 ms | ≤ 300 |
| `/ar` | 8.97 s → no regression / ≤ 4 s | 0 | 49 ms → ≤ 100 ms (Sightline lazy, not in initial JS) | ≤ 200 ms | ≤ 300; Sightline chunk measured separately |
| `/download`, `/about`, `/press`, `/legal/[doc]` | measure in Phase 3 → no regression | 0 | ≤ 100 ms | ≤ 200 ms | ≤ 300 |

Desktop preset: CLS 0 and no regression against the audit §18 desktop table on every route.

**Map-ready mark.** Canvas never counts as LCP, so Explore gets `performance.mark('hm:map-create')` right before `new mapboxgl.Map`, `performance.mark('hm:map-idle')` on the first `map.once('idle')` in `ExploreMap`, and `performance.measure('hm:map-ready', 'hm:map-create', 'hm:map-idle')`. Phase 2 records its baseline; Phase 4 sets the budget from it. The mark ships in production code (it costs one call) and is read from the Lighthouse trace `user-timings` audit.

### Measurement protocol

- Run `tooling/perf/lighthouse-baseline.sh <base-url> <out-dir>` against `next start` on the audit's machine and Chrome (audit §18 "Protocol"), then `node tooling/perf/lighthouse-medians.mjs <out-dir>`.
- 3 runs per route per preset; **5 runs on `/explore`**, reporting median and max (run 1 there was a 4952 ms TBT outlier).
- INP is not in navigation-mode Lighthouse. Lab INP: DevTools Performance trace, CPU 4×, 3 runs, scenario "load /explore → tap Apollo marker → sheet open", read the interaction's duration. Field INP: `web-vitals` `onINP` once traffic exists.
- One fix per measurement. Re-run the protocol after each named fix and record the before/after row in the phase PR.
- Mapbox requests hit the live API, so note Mapbox cache state (first vs warm run) for any LCP claim on map routes.

### Named fixes queue (in order)

1. `sizes` on `MightsMapImage` in `places/[slug]/page.tsx` and `ar/page.tsx` (ADR-04). Expected: place LCP 14.3 s and AR 9.0 s fall toward target.
2. Subset Mona Sans (`apps/web/app/fonts.ts`, `MonaSans-Variable.woff2`, 422 KB at High priority on every route) to Latin plus the axes in use. Same check for Newsreader once a route uses it.
3. Stop shipping GSAP and Lenis on `/explore` (ADR-05). Verify by the chunk list in `/explore` HTML.
4. Map-ready custom timing mark (above).
5. Marker `role="button"` (ADR-03). Not a perf item, but it clears the `/explore` a11y score drop (95/93 → 100) under the same protocol.
6. Confirm, then fix, the `/walks` prefetch that downloads the 847 KB Apollo place hero (audit §18, cause unconfirmed).
