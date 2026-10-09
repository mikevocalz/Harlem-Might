# Visual audit and evidence

## Baseline evidence already in the repo

The existing visual baseline lives under `docs/design/audit/`:

- `before/`: home, explore, notifications, profile, schedule, and spatial captures at 390, 768, 1280, 1440, and 1920 widths, with several night/reduced-motion variants
- `premium-p1/`: focused captures for AR, download, explore, Apollo place detail, home, today, and walks
- `IA_AUDIT.md`, `ROUTE_INVENTORY.md`, and `ANTI_REFERENCES.md` describe route and design-system context
- `docs/spatial-layout/AUDIT.md` covers the spatial-workspace audit

These are useful before evidence, but they are not the complete audit required for the visual overhaul: they do not cover every route, every native form factor, Horizon windows, visionOS, mid-tier Android, or Quest 3.

## Findings from the pre-image baseline

The codebase already had a shared image boundary (`packages/ui/Image.tsx`), Mapbox static images, and story archive figures. Most product surfaces still depended on text and map rasters rather than licensed editorial photography. The specific gaps addressed in this slice were:

- no typed rights/provenance contract on shared content records
- no CMS relationship carrying editorial images on places, walks, stories, or events
- no shared attributed editorial-image component
- no per-screen image load/error state
- no enforced rule against cover-cropping no-derivatives images

## Implemented after this pass

- `packages/assets/editorial-images.ts` adds the typed model and verified NYPL archival asset.
- `packages/payload/src/collections/Media.ts` adds provenance and rights fields.
- Places, walks, stories, and events expose `images` relationships.
- `mapEditorialImages` fails closed unless provenance, license, credit, attribution, and alt text are complete.
- `MightsEditorialImage` renders the image, source link, rights link, creator/credit, capture date, caption, and visible loading/error state.
- Web surfaces now consume normalized imagery on Home, Explore, Stories, Walks, Today, and Place Detail.

## Evidence still missing

The following required evidence has not been captured in this session:

- After screenshots for every changed screen and platform
- Horizon-window, tablet, foldable, and visionOS-style variants
- Mid-tier Android and Quest 3 FPS/memory captures
- Measured text-over-image contrast report
- Visual-regression baselines reviewed by creative direction
- A completed custom Mapbox style and marker system
- Full commissioned-photography coverage

Argent is installed, but `list-devices` showed no running Chromium target, no Android emulator, and only a shutdown iPhone Duo simulator plus a paired physical iPhone that was not connected. No device capture was claimed.
