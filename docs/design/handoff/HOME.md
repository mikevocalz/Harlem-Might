# Handoff: homepage (`/`)

Phase 3 of the premium experience pack. Source: `apps/web/components/site/ProductHome.tsx` (server component), `apps/web/components/site/home/HomeMotion.tsx` (the only client island), `apps/web/components/site/motion.ts` (choreography). Checked at 390, 430, 768, 884, 1024, 1280 and 1440, plus 390 and 1280 with reduced motion. Axe (wcag2a/2aa/21aa/22aa) reported 0 violations at every width.

## What the page does

It sells one block of Harlem and sends people to the map. "Open the map" is the only primary action, and it appears in the hero and the close. Every fact on the page comes from `packages/app/features/explore/explore.store.ts:HARLEM_PLACE_PREVIEWS` or is computed from its coordinates.

## Composition map

| # | Section | Marker ids | Primitives (`packages/ui/mights`) | Bento |
|---|---|---|---|---|
| 1 | Hero | `trg-hero`, `mfx-hero-title`, `mfx-hero-lead`, `mfx-hero-cta`, `mfx-hero-lens`, `mpx-hero-map` | `MightsHeading` (level 1, `marquee`), `MightsText` (`lead`), `MightsButton`, `MightsMapImage` (field + lens), `MightsAccentFrame`, `MightsLocationStamp`, `MapAttribution` | none |
| 2 | Start with a block | `trg-block`, `mfx-block-copy`, `trg-bento-b2`, `mfx-bento-b2-0..3` | `MightsHeading`, `MightsText`, `MightsPlaceBento variant="map-dominant"` with `lead.kind="map"` and `lead.stamp` | **B2** |
| 3 | What a pin can't tell you | `trg-story`, `mfx-story-copy` | `MightsHeading` (`display-lg`), `MightsText` (`lead`, body) | none (prose) |
| 4 | Places on the map | `trg-places`, `mfx-places-head`, `trg-bento-b1`, `mfx-bento-b1-0..5` | `MightsHeading`, `MightsButton` (ghost), `MightsPlaceBento` (default, module 0 dominant) | **B1** |
| 5 | From the map to the sidewalk | `trg-sidewalk`, `mfx-sidewalk-frame`, `mfx-sidewalk-copy` | `MightsAccentFrame tone="cobalt"`, `MightsMapImage`, `MightsText`, `MapAttribution`, `MightsButton` (secondary) | none |
| 6 | Close | `trg-close`, `mfx-close-title`, `mfx-close-lead`, `mfx-close-cta` | `MightsHeading` (`display-lg`), `MightsText` (`lead`), `MightsButton` | none |

Two bentos (B2, B1), separated by the prose chapter. B3 is not built (standing decision D9). B4 is struck (see Decisions).

## Decisions

The ones the code can't show on its own are also short comments in `ProductHome.tsx`.

1. **Hero lens kept, with a job.** The lens now carries the Apollo's name and street as a link to `/places/apollo-theater`, plus its catalogue `shortDescription`. The outer map has neither. The lens image is 4:3 so the caption fits inside the frame. The field map's attribution moved to the bottom-right corner.
2. **Hero support line:** "Harlem's places on one map, each with why it matters and where it sits on the block." Audit §12 option B promised history, sources and current listings for every place; the catalogue holds none of those yet, so the line says only what a place record carries. Page metadata uses the same line.
3. **B2 modules** carry one line each, derived from coordinates: the Apollo's and Sylvia's give their straight-line distance to the Studio Museum (`haversine`, rounded to 10 m, so the numbers follow the catalogue), and the Studio Museum's says it sits between the other two. Order is west to east. The map centre moved to the Apollo–Sylvia's midpoint so Sylvia's pin is no longer cropped.
4. **"The history, the hours, the way in" is gone.** The place record has no hours or entrance field.
5. **Section 3 has no proof cards.** No published story, walk, event or sourced record exists. The prose describes what attaches to a place and says the first stories and walks are still being researched. Proof cards return as `MightsNotchCard` once a real record ships.
6. **B1 reorder.** The three places off the block lead, so the dominant module (Red Rooster) is not another Apollo map.
7. **Sidewalk copy uses "concept".** Audit §19 found no place-label AR scene in the repo, which outranks the §12 "in testing" suggestion. No Specs or glasses claims. The caption under the frame says there is no AR capture yet. CTA renamed "About the AR concept".
8. **B4 struck.** No proof records, and a concept cannot be a proof module.
9. **Close** keeps "Harlem is not a list of landmarks." and adds "Start on one block and follow what's attached to it." before "Open the map".
10. **ADR-01 split done.** `ProductHome` lost `"use client"`. `HomeMotion` calls `useBrowserReducedMotion` + `useHomeMotion` and returns `null`.

## Layout and tokens

| Element | Classes / tokens | Notes |
|---|---|---|
| Chapter container | `max-w-screen-2xl px-4 sm:px-6` | `--container-screen-2xl` (96rem) |
| Hero copy column | `lg:col-span-5`, left inset `max(--spacing(6), (100vw - --container-screen-2xl)/2 + --spacing(6))` | Aligns the headline to the chapter grid at 1536+ |
| Hero map well | `h-140` below `lg`, `lg:min-h-svh` | 560px on mobile from the 4px scale |
| Hero field bleed | `-inset-y-1/12` | Covers the ±4% `hero.drift` scrub |
| Lens | `w-4/5 max-w-110`, frame `p-3`, rail `p-rail`, `cornerCut` | 440px cap |
| Lead measure | `max-w-content-form` (28rem) | |
| Block copy measure | `max-w-content-detail` (48rem) | |
| Prose chapter | `bg-paper`, hairline `border-y`, 5/6-col split at `md` | |
| Close heading | `max-w-[16ch]` | Type measure, not a px value; matches `MightsPage`'s `18ch` |

## Responsive behaviour

| Width | Behaviour |
|---|---|
| 390, 430 | One column. Hero copy, then a 560px map with the lens centred. B2 map first, then Apollo, Studio Museum, Sylvia's. B1 stacks six cards in source order. Sidewalk copy precedes its frame (`order-1`). |
| 768, 884 | B2: map 8 cols, modules stacked 4 cols. B1: 7/5 dominant pair, then 5/4/3. Sidewalk splits 6/5. |
| 1024+ | Hero splits 5/7 at full viewport height. Sidewalk splits 7/4. |

## Motion

All binding lives in `motion.ts`; `ProductHome` imports no GSAP.

| Target | Trigger | Animation | Timing |
|---|---|---|---|
| Hero title, lead, CTA | load, only if bound before 1.8s | `y` only, never opacity (LCP-safe) | 120–800ms, `power2.out` |
| Hero lens | load | opacity 0→1, scale 0.94→1 | 150ms + 900ms |
| Hero field map | scroll, desktop only | `yPercent` -4→4, scrub 0.6 | transform only |
| Block / story copy, places head | `top 78%` | opacity + `y` 24 | 560ms |
| B2, B1 | one trigger per bento, `top 80%` | dominant first, supports staggered 90ms | `motion-markers.ts:BENTO_REVEAL` |
| Sidewalk | `top 82%`, `once: true` | frame then copy | 800ms / 600ms; no scrub, never reverses |
| Close | `top 78%` | title, lead, CTA | 640 / 520 / 480ms |

Reduced motion: nothing binds, `motion-armed` is never set, so every section renders at rest (checked in `rm/home@390.png`, `rm/home@1280.png`). Lenis is off under reduce (shell).

## Accessibility (WCAG 2.2 AA)

### Heading order

| Level | Text |
|---|---|
| h1 | See the block. Know the story. |
| h2 | Start with a block. |
| h3 ×3 | Apollo Theater · The Studio Museum in Harlem · Sylvia's Restaurant |
| h2 | What a pin can't tell you |
| h2 | Places on the map |
| h3 ×6 | Red Rooster Harlem · Schomburg Center · Marcus Garvey Park · Apollo Theater · Sylvia's Restaurant · The Studio Museum in Harlem |
| h2 | From the map to the sidewalk. |
| h2 | Harlem is not a list of landmarks. |

No skipped levels (1.3.1).

### Bento reading order

DOM order equals visual order at every width (1.3.2, 2.4.3). B2: lead map (with its stamp link), then the three places west to east. B1: dominant module, then supports. `MightsPlaceBento` never reorders.

### Images

| Image | Alt |
|---|---|
| Hero field | Map of West 125th Street in Harlem, from the Apollo Theater to the Studio Museum |
| Lens | Close view of the Apollo Theater on West 125th Street |
| B2 lead | Map of West 125th Street and Malcolm X Boulevard with the Apollo Theater, the Studio Museum in Harlem and Sylvia's Restaurant pinned |
| B1 modules | Map of {place name} (primitive default) |
| Sidewalk | Street-level map view of Malcolm X Boulevard at Sylvia's Restaurant |

### Targets (2.5.8)

| Target | Size | Result |
|---|---|---|
| `MightsButton` md (ghost B1 action included) | 52px tall (`h-13`) | pass |
| `MightsLocationStamp` (lens, B2) | about 28px tall | pass (≥24) |
| `MapAttribution` links | text height, inline | pass via the inline-text exception |
| Bento cards | whole card | pass |

### Focus not obscured (2.4.11)

The desktop navbar overlays the hero but sits above content that has `pt-28`, so hero focus targets clear it. On mobile the fixed `MightsDock` (`h-dock`, 3.5rem) can sit over a focused element near the viewport bottom. `globals.css` sets `scroll-padding-top` for the navbar and, below `md`, `scroll-padding-bottom` for the dock plus the safe-area inset, so keyboard focus scrolls clear of both.

## Edge cases

- **No Mapbox token:** each `MightsMapImage` renders its labelled "Map unavailable" plate; the stamp and caption still render.
- **Place without coordinates:** excluded from `MAPPED`, so it never reaches B1 or B2.
- **JS off or slow hydration:** content renders at rest; `motion-armed` is only added after the bind.

## Open items

1. Mobile B1 is six full map cards. Audit §14 suggests 4–5 on mobile. Deferred: hiding cards by viewport changes what a phone reader can reach, and the list on `/explore` is one tap away.
2. The `/ar` page still describes the AR view in present tense. Phase 7 owns that page.
