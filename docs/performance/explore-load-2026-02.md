# Explore load — profiling report and L1/L2/L3 log

Workstream: Explore load performance + Rive orbital loader (§A–§8).
Branch: `feat/explore-load-perf`. Baseline commit: `d52ede0`.

## §1 Route anatomy (what actually mounts)

- `/explore` (`apps/web/app/(site)/explore/page.tsx`) — a client-first Server
  Component: `connection()` → `listExploreCatalogue()` (Payload Local API,
  ~1,686 docs) → `explorePlaceFromRecord` ×N → `<Suspense>` (no fallback) →
  `ExploreWorkspace`.
- `ExploreWorkspace` — the merged map+master+sheet workspace (ADR-024). One
  client component owns list, canvas, and sheet; `mapbox-gl` is a dynamic
  import inside an effect.
- `explore.store.ts` — Zustand; query/sheet/detent/guide state.
- Rive: `packages/spatial/rive-fx` is the existing Rive CLI project;
  `RiveStage`/`GridFxStage` wrap `@rive-app/react-webgl2` (web) and
  `@rive-app/react-native` (native). Loader reuses this pattern — no second
  runtime.
- "History Bar" from the spec: **no such region exists** in the codebase.
  Boundary map below covers the three regions that do exist.

## §3 Measurements (web, dev server, warm)

| Metric | Before (`d52ede0`) | After L1 | Method |
|---|---|---|---|
| `/explore` TTFB | ~0.04–0.14 s | ~0.04–0.14 s | `curl -w '%{time_starttransfer}'` |
| `/explore` RSC stream completion | ~5.7 s | ~3.4–4.7 s | `curl -w '%{time_total}'` |
| `/explore` HTML+flight bytes | 879 KB | 793 KB | `curl` body size |
| Equivalent catalogue via REST | 1.53 MB, ~1.24 s | 664 KB, ~0.59 s | `/payload-api/places` full vs `select` |

Device targets (mid-tier Android, iPhone, Quest 3): **not measured** — no
devices were available in this environment. Web numbers above are the
evidence base; device numbers are a named gap.

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
   stream time. Fix: two promises (map points, slim; catalogue, fuller) +
   per-region boundaries + skeleton fallbacks.
5. **Map style/tile load is the real map-region wait** (unchanged,
   expected): `mapStatus` already models `loading → ready`; the loader
   overlay (L3) spans the whole wait, not just data.

## §4 Boundary map (L2)

```text
ExploreWorkspace (client, no data deps)
├─ FilterBar + Master list   ── Suspense(cataloguePromise)  fallback: row skeletons
├─ Map region                ── Suspense(pointsPromise)     fallback: none — Rive overlay
│   └─ visibleIds syncs from the list region via explore.store (map never waits on catalogue)
├─ Sheet (place detail)      ── Suspense(cataloguePromise)  fallback: null (mounts only when selected)
└─ each boundary wrapped in ExploreRegionBoundary (retry → router.refresh())
```

Anti-flicker: map overlay appears only after `LOAD_DELAY_MS` (250 ms) and,
once shown, runs the loader's `complete` exit; skeletons fade in via CSS
delay so sub-250 ms loads render no skeleton.

## §5 Loader (L3)

- RML project: `packages/spatial/explore-loader/rive/` (new Rive CLI
  project, mirrors `rive-fx` layout).
- Built `.riv`: `packages/spatial/explore-loader/explore-loader.riv`
  (committed) + copied to `apps/web/public/rive/explore-loader.riv`.
- View model `ExploreLoader` — colors `ringPrimary` / `ringAccent` / `core`
  / `track` bound from theme tokens at runtime; `phase` string drives the
  state machine (`enter` → `loading` → `complete` / `error` /
  `reducedMotion`); `progress` number binds the outer trim ring.
- `ExploreLoader` component in `packages/spatial` — web via
  `@rive-app/react-webgl2` (same runtime as `GridFxStage`), native via
  `@rive-app/react-native`.

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
