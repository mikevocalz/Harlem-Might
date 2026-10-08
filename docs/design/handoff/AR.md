# Handoff: AR concept (`/ar`)

Phase 7 of the premium experience pack. One route, `apps/web/app/(site)/ar/page.tsx`, composed from `apps/web/components/ar/`. Sightline placement is recorded in `docs/adr/0004-sightline-placement.md`.

Checked by typecheck, lint, `components/ar/ar-status.test.ts` and a dev server on port 3242 with Playwright (Chrome, headless) at 390, 768, 1280 and 1440, plus reduced motion at 390 and 1280. axe (WCAG 2.0/2.1/2.2 A and AA tags) reported no violations at any size. The production build fails in `packages/ui/mights/MightsFooter.tsx:29` (`new Date()` during prerender), a file owned by the chrome phase, so the numbers here come from the dev server.

## What the page says, and why

No place-label AR exists in the repo. The app's only AR scene is the tabletop race (`packages/spatial/TabletopColocationScene.native.tsx`, audit §19). So the page explains a concept and says so in the lead, before any detail. It never asks for the camera and has no WebXR code (audit §21).

| Section | Job | Status words used |
|---|---|---|
| Opening | Lead with the use: know which building you're looking at. State "concept" and "no code" in the lead. | concept |
| How it would work on 125th Street | Map → sidewalk → camera → place page on one real block (Apollo Theater). Say what the view would not do: no facade tracing, no saved anchors. Camera permission in context. | concept ("AR is a concept, no capture yet") |
| Sightline, a concept render | Show the glasses idea without implying hardware. | concept |
| Where each piece stands | One row per target, five-word status, plain text. Link to `/download` ("The app"). | all five defined, none verified |

B11 (proof cluster) is struck as of 2026-10-07: a concept has no proof records, and a compatibility list is never a bento. The strike note sits in `components/ar/ArStatusList.tsx`. It comes back when a place-label AR build has the 8-point device record in `docs/XR-PLATFORM-MATRIX.md`.

## Status table with evidence

Source of truth: `components/ar/ar-status.ts:SPATIAL_STATUS`. Each row carries an `evidence` string; the test fails if any row says "verified", "works", "supported", "available now" or "runs on".

| Target | Status | Evidence |
|---|---|---|
| Place labels in the phone camera | concept | No `ViroARScene` reads `HARLEM_PLACE_PREVIEWS` (audit §19) |
| The app, iPhone and Android | integration path | `apps/mobile/eas.json`: internal distribution, empty `submit.production`; matches `/download` |
| Meta Quest, immersive scenes | in testing | `docs/META_VR_GLASSES.md` §5: "In testing on Quest only for the floor and controller work" |
| Meta VR Glasses | integration path | `docs/META_VR_GLASSES.md` §5: "Status: integration path for glasses" |
| Snap Spectacles | preview (Lens via `specs:scene`); WebView route concept | `docs/META_VR_GLASSES.md` §7; branch `codex/specs-generated-preview` (`b94e5c3`), unmerged |
| Sightline glasses | concept | `packages/spatial/sightline/README.md` |

## Composition map

| Section | Primitives (real props) | Bento |
|---|---|---|
| Opening | `MightsPage` (`title`, `lead`) | none |
| Walkthrough | `<section aria-labelledby>`, `MightsHeading` (`id`, `level`, `size="card"`), `MightsAccentFrame tone="cobalt"`, `MightsMapImage` (`center`, `zoom=18.6`, `pitch=60`, `bearing=-29`, `width=960`, `height=720`, `sizes`, `pins`, `alt`), `MightsLocationStamp` (`name`, `street`, `href=routes.place('apollo-theater')`, `tone="dark"`), `MapAttribution`, `MightsText`, `MightsButton href=routes.explore({ place: 'apollo-theater' })` | none |
| Sightline | `MightsBand title`, `MightsText`, `SightlineIsland` → `MightsAccentFrame tone="iron"`, `SightlineHeroCanvas` (`getProgress`, `reducedMotion`, `ariaLabel`, `onReady`, `onUnavailable`, `className`) | none |
| Status | `MightsBand` (`title`, `action` = `MightsButton variant="secondary" size="sm"` "The app" → `routes.download()`), `<dl>` rows of `MightsText` | none (never-bento: compatibility list) |
| Chrome | `SiteMotionShell` (navbar, dock, footer), unchanged | none |

The opening has no `MightsFigure`: there is no rights-cleared photograph of the block yet, and a map in the opening would repeat the walkthrough frame.

## Layout

| Breakpoint | Walkthrough | Sightline box | Status rows |
|---|---|---|---|
| < 768px | One column: map frame, caption, then the steps, camera note and button | `aspect-4/3` | name above status and detail |
| ≥ 768px | Map `md:col-span-7`, steps `md:col-span-5` | `md:aspect-video` | name `md:col-span-4`, status `md:col-span-8`, list capped at `max-w-content-screen` |

Source order equals reading order at every size; nothing is reordered with CSS.

## Tokens used

Colors: `bg-surface-sunken` (render box), `bg-surface-raised` (map well), `border-rule-rail` (band rule, camera note rail), `border-rule-hairline` (status rows), `text-primary` (step numerals), `text-text` / `text-text-muted` via `MightsText` tones. Type: `MightsHeading` sizes `display-md` and `card`, `MightsText` sizes `lead`, `body`, `small`, `text-label` (Sightline caption), `text-small` (map caption), `text-title` (numerals). Motion: `duration-slow` on the canvas fade, `motion-reduce:transition-none`. No new tokens; no raw hex, px or arbitrary values in the new files.

## Sightline island states

`components/ar/sightline-island.store.ts:SightlinePhase` (zustand). Scroll progress never enters the store.

| Phase | When | What renders |
|---|---|---|
| `waiting` | server render, JS off, or not yet within 400px of the viewport | reserved box with the description and "It draws here in browsers that support WebGPU." |
| `unsupported` | no `navigator.gpu` | box shrinks to the description plus "This browser doesn't support WebGPU, so the render isn't shown. Nothing else on this page needs it." |
| `loading` | chunk requested, device pending | canvas mounted at opacity 0 over "Loading the render." |
| `ready` | first frame drawn (`onReady`) | canvas at full opacity; text removed; canvas announces its `aria-label` |
| `failed` | no adapter, init threw, or device lost (`onUnavailable`) | same as `unsupported` with "The render couldn't start on this device" |

Reduced motion: one frame, no loop, redraw on resize. Three's renderer still runs its internal idle `requestAnimationFrame` after `init()` (`three/src/renderers/common/Renderer.js:842`), but nothing draws.

## Measured (dev server, headless Chrome)

| Check | Result |
|---|---|
| WebGPU in headless Chrome | `navigator.gpu` present, adapter returned, canvas drew at all six variants (1208×680 backing store at 1280) |
| LCP element | 390: the lead `<p>`; 768, 1280, 1440: the Apollo map `<img>`. Never the canvas |
| No-WebGPU path (`navigator.gpu` removed by init script) | no canvas, text fallback, box collapsed (`sightline-nogpu.png`) |
| Reduced motion | canvas drew one frame; rAF rate fell from 184/s to 60/s (three's idle loop plus page) |
| axe | no violations at any of the six variants |
| Console | one error, the footer `new Date()` prerender error above; nothing from `/ar` code |

Not measured: production LCP/INP numbers (build blocked), a real phone, and a device-loss event.

## Accessibility

| Criterion | Result | Evidence |
|---|---|---|
| 1.1.1 Non-text content | pass | map `alt`; canvas `role="img"` + `aria-label` starting "Concept render of Sightline"; text fallback carries the same description |
| 1.3.1 Info and relationships | pass | walkthrough is an `<ol>`; numerals `aria-hidden`; status is a `<dl>`; sections labelled by their headings |
| 1.4.3 Contrast | pass | axe found no contrast failures; text uses `text` / `text-muted` tokens on `surface` |
| 2.3.3 / reduced motion | pass | no loop and no fade under `prefers-reduced-motion` |
| 2.4.3 Focus order | pass | stamp link → Open the map → The app → footer, matching visual order |
| 2.5.8 Target size | pass | `MightsButton` md/sm heights; stamp link is a padded inline block |
| Camera permission | n/a on web | the page never requests it; the copy says when the app would ask |

## Copy decisions

- Title "Know which building you're looking at" leads with the use; metadata title "AR concept" matches the footer label.
- Banned openers (immersive, mixed reality, spatial computing) don't appear.
- No "Preview AR", no "Get the app": the app isn't released, so the action is "The app" → `/download`.
- Content outside the route: `content/about.ts:46`, `content/press.ts:4,13,23,37`, `content/legal.ts:51,90,161` no longer describe AR in the present tense, and press/legal say the app "has not been released" instead of "in testing", matching `/download`.

## Open items

1. Build: `MightsFooter.tsx:29` calls `new Date()` in a client component during prerender. Owner: chrome phase.
2. `content/about.ts:47` and `content/press.ts:38` still promise "real entrances, accessible entrances" and viewpoints. No such fields exist (audit §7). Not AR copy, so left alone.
3. `content/press.ts:4,13` still mention walking routes; no walk records are published yet.
4. Audit §12 rule 3 said not to name Meta VR Glasses or Specs publicly before "in testing". The Phase 7 brief asked for a status list that names them with their status words. Repo owner to confirm.
5. PICO, visionOS and Meta AI glasses rows in the XR matrix moved from "integrated"/"foundation merged" to "integration path" without fresh evidence; nobody has recorded a device run for any of them.
