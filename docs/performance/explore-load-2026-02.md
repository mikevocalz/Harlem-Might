# Explore load — profiling report and L1/L2/L3 log

Workstream: Explore load performance + Rive orbital loader (§A–§8).
Branch: `feat/explore-load-perf`. Baseline commit: `d52ede0`.

## §1 Route anatomy (what actually mounts)

- `/explore` (`apps/web/app/(site)/explore/page.tsx`) — a Server Component
  wrapped in a page-level `<Suspense fallback={<ExplorePageLoader />}>`.
  `ExploreContent` awaits `readExplore()`, which uses `'use cache'` and
  `cacheLife(...)` to run `listExplorePoints()` and `listExploreCatalogue()`
  (Payload Local API, ~1,686 docs) in parallel. A hit caches for minutes; a
  miss (no `DATABASE_URL` or failed query) caches for seconds so the preview
  fixture is never baked into the static shell.
- `readExplore()` returns two shapes: a slim `points` array for the map and a
  fuller `catalogue` array for the list/sheet, both via
  `explorePlaceFromRecord`.
- `ExploreWorkspace` (`apps/web/components/explore/ExploreWorkspace.tsx`) —
  the merged map+master+sheet workspace (ADR-024). One client component owns
  list, canvas, and sheet. The `mapbox-gl` chunk is imported at module scope
  (`const mapboxglPromise = import('mapbox-gl')`) so it races hydration; the
  actual `Map` instance still boots inside an effect (no SSR hazards under
  `mounted`).
- `ExploreRegionBoundary` — one error boundary per region, with retry →
  `router.refresh()`. The workspace itself has no inner Suspense boundaries;
  the single page boundary resolves both reads before the regions mount.
- `explore.store.ts` — Zustand; query/sheet/detent/guide state, plus
  `recentIds` (deduped, newest-first, cap 8) for the session strip.
- Rive: `packages/spatial/rive-fx` is the existing Rive CLI project;
  `RiveStage`/`GridFxStage` wrap `@rive-app/react-webgl2` (web) and
  `@rive-app/react-native` (native). Loader reuses this pattern — no second
  runtime.
- "Recently viewed" strip — a real session row, not a spec placeholder.
  `recentIds` is written by web select / deep-link / mobile `selectPlace`
  paths and rendered as a "Recent" chip row in `MasterRegion` (web) and
  `ExploreMasterPane` (native).
- Responsive layout:
  - Phone (`< 37.5rem` / 600px): one pane at a time, with a Map/List toggle
    above the dock.
  - Material medium band (`600–767px`): the master pane becomes a narrow rail
    (`w-pane-primary-narrow`, 16rem) beside the map; the sheet still overlays
    the map region.
  - `xp` (`≥ 840px`): the rail widens to `w-pane-primary` (20rem).
  - `lg` (`≥ 1024px`): the sheet docks as an inspector column beside the map,
    so list, map, and detail sit side by side.

## §3 Measurements (web, dev server, warm)

| Metric | Current flow (L1 + L2 + L3 + medium-band) | Method |
|---|---|---|
| `/explore` TTFB (shell + loader plate) | ~0.04–0.22 s; the page shell and `ExplorePageLoader` (same Rive plate used by `MapLoadOverlay`) paint together | `curl -w` |
| `/explore` RSC stream completion | ~0.15–0.36 s / ~872 KB warm (dev-serialize noise; includes ~180 KB duplicated `id/name/lngLat` points array) | `curl -w '%{time_total}'`, `curl` body size |
| Equivalent catalogue via REST | 664 KB, ~0.59 s | `/payload-api/places` |
| First painted content | page-level loader plate at TTFB, then the whole workspace appears once both reads resolve, then `MapLoadOverlay` covers the stage until the GL map is ready; on phones in list view the overlay is suppressed so the list is visible immediately | streamed `hm-suspense-in` markup / visual frame |

Interpretation: L1's win was bytes and query shape. L2's win was *ordering*
— streaming the shell before the catalogue. L3's win is a single continuous
loader: `ExplorePageLoader` and `MapLoadOverlay` use the same Rive asset, so
the data wait and the GL wait read as one plate. The remaining wait is still
mapbox GL init + style + tiles (~4 s). The list/catalogue is not the
bottleneck anymore. Stream-completion time in dev is dominated by RSC
serialization and is not a production proxy; re-measure on a production build
after the medium-band layout change.

Device evidence (gap-closure pass, argent CDP on live Chrome, steady
warm dev server):

| Metric | Value | Method |
|---|---|---|
| FCP (shell + loader plate) | 1.26 s | `paint` entry |
| Full stream (curl warm) | 0.15–0.36 s / 872 KB | `curl -w`, 3 runs |
| Mapbox canvas first frame | 4.07 s | rAF poll via CDP |
| Main-thread during load | ~98 fps avg (120 Hz display) | rAF count over 23 s |
| Post-load | loader exited, `role=progressbar` gone, 267 list buttons rendered | DOM audit |

Read: the remaining wait is mapbox GL init + style + tiles (~4 s) — the
span the Rive overlay is built to cover. List/catalogue is not the
bottleneck anymore.

Device status: **Android** — created `hm-midtier` AVD (API 36, arm64,
2 GB/2-core mid-tier profile) + `expo run:android` build in flight.
**iOS** — blocked by the local `viro` fork state: `pod install` fails
(`ViroReact` vendors a prebuilt `libViroReact.a` AND compiles a lib of
the same name — a self-conflict), and both `dist/lib/libViroReact.a` and
`ViroKit.framework/ViroKit` are 0-byte stubs, so the iOS binary cannot
link even after the conflict. The only iOS sim present is the foldable
Duo, which the app's supported-platforms rejects; the physical iPhone
is paired-but-unreachable. **Quest 3** — Meta ships no emulator; needs
hardware. iOS/Quest numbers remain named gaps with concrete causes.

## §3 Ranked root causes (confirmed, not assumed)

1. **Over-fetching the catalogue** (fixed, L1): `listPlaces()` serialized
   every field of every doc — `menus[]`, `website`, `phone`, `openingHours`,
   `images[]`, `address` group, `featuredTaglines`, sources — into the RSC
   payload. The workspace reads ~9 fields per place. Fix: Payload `select`
   projection + slim adapter → −43% REST bytes, −57% on the map-critical
   path.
2. **mapbox-gl deferred behind a dynamic import + module-level `MapGL`
   reference** (fixed, L1): the chunk could not start loading until the
   component mounted and the first effect ran. Fix: import the mapbox-gl
   module graph at module scope (it is already split by Next) so the chunk
   races with data; the actual `Map` instance still boots inside an effect
   (no SSR hazards — `ExploreMap` only renders client-side under
   `mounted`).
3. **`placeId → ExplorePlace` lookup was O(n) per render** (fixed, L1):
   `results.find()` on every render of every marker path. Fix: one memoized
   `Map` join.
4. **One monolithic client component** (fixed, L2): list, map, and sheet
   all waited for the full catalogue before anything rendered; the page
   Suspense had no fallback, so the shell showed nothing for the whole
   stream time. Fix: `readExplore()` returns two shapes (slim `points` for the
   map, fuller `catalogue` for the list/sheet) and the page wraps everything
   in one `<Suspense fallback={<ExplorePageLoader />}>` so the loader plate
   paints at TTFB. `MapLoadOverlay` then spans the whole stage until the GL
   map is ready, so the regions reveal together rather than map-first /
   list-last.
5. **Map style/tile load is the real map-region wait** (unchanged,
   expected): `mapStatus` already models `loading → ready`; the loader
   overlay (L3) spans the whole wait, not just data.

## §4 Boundary map (current)

```text
ExplorePage (Server Component)
└─ <Suspense fallback={<ExplorePageLoader />}>
    └─ ExploreContent
        └─ readExplore()  ── 'use cache' + cacheLife('minutes'|'seconds')
            ├─ listExplorePoints()    → slim points array
            └─ listExploreCatalogue() → fuller catalogue array
        └─ <ExploreWorkspace points={points} catalogue={catalogue} />
            ├─ ExploreRegionBoundary(region="list")
            │   └─ <MasterRegion catalogue={catalogue} />
            ├─ ExploreRegionBoundary(region="map")
            │   └─ <MapRegion points={points} />
            ├─ ExploreRegionBoundary(region="place details")
            │   └─ <SheetRegion catalogue={catalogue} />
            └─ <MapLoadOverlay />   covers whole stage while mapStatus is 'loading'
                (hidden on phones when view === 'list')
```

The page now has one Suspense boundary; `ExploreRegionBoundary` is an error
boundary per region (retry → `router.refresh()`). The Rive loader is shared by
the page fallback and the map overlay so there is no visual hand-off between
data wait and GL wait.

## §5 Loader (L3)

- RML project: `packages/spatial/explore-loader/rive/` — built by Rive CLI
  1.5.0 (`rive . --once`, 2,158 bytes, unwatermarked, bundled locally).
  Committed asset: `packages/spatial/explore-loader/explore-loader.riv`
  (+ `apps/web/public/rive/explore-loader.riv` for the web runtime).
- Scene: 4 rings — track (dim full circle), progress arc (real `progress`
  0–1 only), three counter-rotating arc rotors (outer +1 turn, mid −1,
  inner +2 per 3 s loop — whole turns so the loop is seamless), soft core
  pulse, and the brand diamond at center (same rotated square as the map
  marker and list rows).
- State machine `Loader`, phase-driven by the `phase` view-model string:
  `enter` (draw-in, exit-time-chained) → `loading` (loop) → `complete`
  (collapse+fade ~450 ms) / `error` (settle+dim) / `reduced` (opacity
  pulse, no rotation). `loading`→`complete`/`error`/`reduced` transitions
  live on AnyState; resume lives on REDUCED so ENTER can never be skipped.
- Colors: `ringPrimary`/`core` ← `semantic.primary`, `ringAccent` ←
  `semantic.spatial`, `track` ← `semantic['rule-rail']`, resolved per
  scheme at runtime — no hex in component code, theme change needs no
  rebuild. RML authoring defaults are the dark values.
- `ExploreLoader` (`@acme/spatial/explore-loader`): typed props
  `size / phase / progress / scheme / label`; web uses
  `@rive-app/react-webgl2` (same runtime as `GridFxStage`), native
  `@rive-app/react-native` (`useViewModelInstance` + `dataBind`).
  `role="progressbar"` + label; `aria-valuenow` only with real progress.
- `ExplorePageLoader` is the page-level Suspense fallback; it uses the same
  Rive plate and the `hm-suspense-in` 250 ms grace → never shown on fast
  warm loads. Once the cached data resolves, `MapLoadOverlay` takes over.
- `MapLoadOverlay` covers the whole Explore stage while `mapStatus` is
  `loading`, driven by `map-loader.store`: no entry delay, so the list never
  paints ahead of the map; minimum 700 ms shown → `complete` exit 450 ms; hidden
  on phones when the view is `list` because that pane doesn't wait on GL; OS
  reduce-motion → the `reduced` phase (pulse, no rotation); `unavailable` →
  the map's error plate.
- Captures (Rive CLI `--screenshot --advance`): `t30`, `t90` frames in
  `packages/spatial/explore-loader/rive/build/` — counter-rotation and
  diamond core confirmed.

## §6 Accessibility notes

- `role="progressbar"` + `aria-label` on the loader; `aria-valuenow` only
  when a real `progress` prop exists (never faked).
- Polite `role="status"` announcements: "Loading map" once on mount,
  "Map ready" once when the complete exit starts. No progress chatter.
- OS reduce-motion → the Rive `reduced` phase (opacity pulse, no
  rotation); skeletons use `motion-reduce:animate-none` already built
  into `LoadingSkeleton`.
- No flashing: ring cycle is 3 s, pulse 4 s — far under the 3 Hz limit.
- Contrast: gold #F8C626 and spatial #5FD1E1 on `map-canvas` #070604
  exceed 3:1; the dim track ring is decorative support.
- Horizon: the loader is ordinary window content — sized for 1.5–3 m via
  the `size` prop; it changes no window geometry.
- Mobile: `ExploreLoader` mounts where mobile genuinely waits — the AR
  route panel (`apps/mobile/app/explore-ar.tsx`, `route.status ===
  'loading'`), reduced-motion aware. The schematic mobile map pane stays
  loader-free by design: its data is fixture-sync, so a loader there would
  decorate a wait that doesn't exist.

## Verification commands

```bash
pnpm --dir packages/app exec tsc --noEmit -p tsconfig.content.json
cd apps/web && ../../node_modules/.bin/tsc --noEmit
pnpm --dir packages/payload typecheck
pnpm --dir packages/spatial rive:explore-loader-verify
rive packages/spatial/explore-loader/rive --verify
rive packages/spatial/explore-loader/rive --once
rive packages/spatial/explore-loader/rive --screenshot --advance=1
```

Warm-page measurement:

```bash
curl -so /dev/null -w 'ttfb:%{time_starttransfer}s total:%{time_total}s size:%{size_download}\n' \
  http://localhost:3000/explore
```
