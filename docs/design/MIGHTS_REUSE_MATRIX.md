# Mights reuse matrix, token resolution and bento spec (Phase 2)

Owner: Design-System Steward. Every later phase appends to this file; nothing in `apps/web` bypasses it. Read with `docs/design/PREMIUM_EXPERIENCE_AUDIT.md` §14, §15, §17 and §19a, which this file resolves.

The `/design:design-system` and `/design:design-handoff` outputs below were produced in this session with those skills loaded. Standing decisions D1 (dark site, gold primary), D3 ("Harlem Might", singular), D8 (B12 struck) and D9 (B2 over B3) apply throughout.

## 1. Reuse matrix

Rows are primitives, columns are routes. Cells say how the route uses the primitive today, with the props it passes. "—" means not used. Source: `grep -oE '<Mights[A-Za-z]+'` over `apps/web/app` and `apps/web/components`, read 2026-10-07.

| Primitive (`packages/ui/mights`) | `/` (`ProductHome.tsx`) | `/explore` (`ExploreWorkspace.tsx`, `ExploreMap.tsx`) | `/places/[slug]` | `/walks` `/stories` `/today` | `/ar` | `/about` `/press` `/legal/[doc]` | `/download` | error, 404 | shell (`SiteMotionShell.tsx`) |
|---|---|---|---|---|---|---|---|---|---|
| `MightsButton` | as-is ×6: `href`, `variant` primary/secondary/ghost, `size="sm"`, `fill` | as-is ×2: `href`, `size="sm"`, `variant="secondary"` | as-is ×2: `href`, `external`, `variant="secondary"` | as-is: `href` (band action) | as-is ×2 | as-is: `href`, `external`, `size="sm"` (press) | as-is ×2 | error: as-is link; the retry is hand-built (see §5) | via `MightsNavbar` |
| `MightsNotchCard` | as-is ×1 (block map) | — | as-is ×1 | — | — | as-is (press) | — | — | — |
| `MightsAccentFrame` | as-is ×2, `tone="cobalt"` (renders gold) | — | — | — | as-is, `tone="cobalt"` | — | — | — | — |
| `MightsLocationStamp` | as-is ×1 (hero) | as-is ×1 | as-is ×1 | — | — | — | — | — | — |
| `MightsMapImage` + `MapAttribution` | as-is ×4 / ×2 | — (GL map) | as-is ×1 / ×1 | — | as-is ×1 / ×1 | — | — | — | — |
| `MightsHeading` | as-is ×5: `level`, `size` marquee/display-lg/display-md, `id` (motion marker) | as-is ×2 | via `MightsPage` | via `MightsPage`/`MightsBand` | via `MightsPage` | via `MightsPage`/`MightsProse` | via `MightsPage` | via `MightsPage` | — |
| `MightsText` | as-is ×3 | as-is ×4 + 1 in map | as-is ×2 | as-is ×1 | as-is ×2 | as-is | as-is ×1 | as-is ×1 | — |
| `MightsPage` / `MightsBand` | — | — | as-is | as-is / as-is | as-is | as-is | as-is / as-is | as-is / as-is (404) | — |
| `MightsPlaceBento` | **variant pending**: `places={MAPPED}` (B1), B2 to adopt `variant="map-dominant"` | never bento | as-is `places={placesNear(...)}` (B5) | **remove** (§14: no data, see register) | **variant pending** `proof` (B11, gated by audit §19) | — | — | 404: as-is `places` (B13, move to `compact`) | — |
| `MightsFigure` | — | — | — | — | — | as-is (about, press, legal) | — | — | — |
| `MightsProse` | — | — | — | — | — | as-is | — | — | — |
| `MightsSearchForm` | — | — | — | — | — | — | — | 404: as-is | — |
| `MightsBreadcrumb` | — | — | via `MightsPage` `crumbs` | via `MightsPage` | via `MightsPage` | via `MightsPage` | via `MightsPage` | — | — |
| `MightsJsonLd` | `app/(site)/page.tsx` | — | as-is | — | — | — | — | — | — |
| `MightsNavbar` / `MightsDock` / `MightsFooter` / `MightsWordmark` | — | — | — | — | — | — | — | — | as-is |

## 2. Token audit resolution

All changes are in `packages/theme/tokens.ts`; `theme.css` and `theme-native.css` were regenerated with `pnpm --filter @acme/theme build` (`node build-css.mjs`).

### What changed

| Audit item (§15) | Resolution | Where |
|---|---|---|
| Contradiction 2: `index.ts:2` "burgundy, black, pumpkin orange" | Comment now says logo gold on warm black | `packages/theme/index.ts:2` |
| `tokens.ts:17` "Harlem Mights v2" | "Harlem Might brand colors" (D3) | `tokens.ts:palette.mights` |
| Contradiction 3: shadow comment "quiet depth on light surfaces" | Comment states the values are stoop-iron, read on the mobile light mode and almost vanish on the dark site, where rails carry emphasis. Values unchanged; no dark shadow values added. | `tokens.ts:shadows` |
| Contradiction 4: "No hex values exist outside this file" | Reworded to "belong outside", naming `packages/spatial/sightline` as the known exception | `tokens.ts` header |
| Contradiction 1: legacy scales whose names lie | Kept, renamed nothing (consumers below). Comments on `burgundy`/`ember`/`gold` say what colour each really is and that public-site code must not use them. | `tokens.ts:palette` |
| Contradiction 7: durations outside Tailwind's namespace | `build-css.mjs` now also emits `--transition-duration-<name>` inside `@theme`. Tailwind 4.3.3 resolves the `duration-*` utility against `--transition-duration` (`node_modules/tailwindcss/dist/lib.js`, `functional("duration")`), so `duration-fast` etc. now exist. `--duration-*` stays on `:root` for plain CSS. | `build-css.mjs:sharedThemeTokens` |
| Contradiction 8: dark `border-strong` fails 1.4.11 | `#5A503E` → `#756A52` (same warm hue, lighter) | `tokens.ts:semantic['border-strong']` |
| Type steps below 20px | Added `card`, `prose`, `lead-sm`, `body`, `ui`, `small`, `label`, `caption` to `typeScale` with comments | `tokens.ts:typeScale` |
| `2px` rail ×5, `56px` dock ×3 | New `spacing` export: `rail` (0.125rem), `dock` (3.5rem), emitted as `--spacing-<name>` so `p-rail`, `h-rail`, `h-dock` exist | `tokens.ts:spacing`, `build-css.mjs` |
| New type helper | `TypeStep = keyof typeof typeScale` | `tokens.ts` |

### Type steps added

| Step | Size / line height | Replaces | Used by |
|---|---|---|---|
| `card` | 20px / 28px | `text-[20px] leading-7` | `MightsHeading size="card"` |
| `prose` | 19px / 1.75 | `text-[19px] leading-[1.75]`, `leading-[1.7]` | `MightsProse` paragraphs and list items (list items move from 1.7 to 1.75) |
| `lead-sm` | 18px / 28px | `text-[18px] leading-7` | `MightsText size="lead"` below 768px |
| `body` | 16px / 28px | `text-base leading-7` | `MightsText size="body"` |
| `ui` | 15px / 24px | `text-[15px]` | `MightsButton` md label, footer links, prose contents links |
| `small` | 14px / 24px | `text-[14px]`, `text-[14px] leading-6` | `MightsText size="small"`, navbar links, `MightsButton` sm label, prose "Last updated" |
| `label` | 13px / 20px | `text-[13px]` | breadcrumb, figure caption, footer group headings and legal row, map-unavailable plate, prose contents heading |
| `caption` | 11px / 16px | `text-[11px]` | `MapAttribution`, dock labels |

Two values in `apps/web` stay for their owners: 17px in `ExploreWorkspace.tsx:168` (map to `card` or `body` during the Explore phase) and the Explore hand-built 13px/14px chip labels (`label`, `small`).

### Spacing decision

Tailwind's default 4px scale (`--spacing: 0.25rem`) stays the rhythm for gaps and padding. It is coherent, and renaming every step would add vocabulary without changing a pixel. Only lengths that carry meaning across components get a name: `rail` and `dock`. A future "bay" or "gutter" name needs a second consumer before it is added.

### Contrast (WCAG relative luminance, computed from token hex)

| Pair | Before | After | Criterion |
|---|---|---|---|
| dark `border-strong` on `surface-raised` `#15120D` (input fill) | 2.36:1 (fail) | **3.50:1** | 1.4.11, 3:1 |
| dark `border-strong` on `surface` `#0B0906` | 2.51:1 | 3.73:1 | 1.4.11 |
| dark `border-strong` on `paper` `#110E0A` | 2.43:1 | 3.61:1 | 1.4.11 |
| light `border-strong` `#7D8983` on `surface-raised` `#FFFFFF` | 3.63:1 | unchanged | 1.4.11 |
| light `border-strong` on `surface` `#EEF0EC` | 3.17:1 | unchanged | 1.4.11 |

`#756A52` was chosen over the 3.16:1 candidate `#6E634C` to keep margin above 3:1 once a 1px edge antialiases. Unchanged pairs from the audit: text 17.19:1, text-muted 7.57:1, primary on surface 12.40:1, rule-rail 4.10:1.

Not fixed here: the 1.06:1 unselected chip fill and 1.29:1 `border` (audit §17). Those are Explore controls; the fix is a `border-strong` or `rule-rail` outline on the chip, which the Explore owner applies.

### Legacy scale consumers (do not delete yet)

`palette.gold` is blue, `palette.burgundy` is yellow, `palette.ember` is pink. Neither `apps/web` nor `packages/ui/mights` uses them. Current consumers (`grep` over `apps` and `packages`, excluding build output):

| File | Uses |
|---|---|
| `packages/app/features/schedule/accent-classes.ts` | `bg-ember-500` ×5, `bg-gold-500` ×5, `text-ember-200`, `text-ember-700`, `text-gold-200`, `text-gold-700` |
| `packages/app/features/schedule/NotesEditor.tsx` | `palette.burgundy[300]` |
| `packages/app/features/home/home.data.ts` | `bg-gold-400`, `bg-gold-500`, `text-gold-600` |
| `packages/app/features/error/screen.shared.tsx` | `text-burgundy-200` |
| `packages/ui/Badge.tsx` | `bg-burgundy-100`, `bg-burgundy-900`, `text-burgundy-100`, `text-burgundy-800`, `bg-ember-50`, `bg-ember-100`, `bg-ember-900` ×2, `text-ember-100`, `text-ember-200`, `text-ember-700`, `text-ember-800` |
| `packages/ui/Avatar.tsx` | `bg-gold-50`, `text-gold-800` |
| `packages/ui/DropZone.web.tsx`, `DropZone.native.tsx` | `bg-ember-50` |
| `packages/ui/Lightbox.tsx` | `bg-ember-400` |

Plan: delete the three scales together with the schedule demo, or rename them (`legacy-cobalt`, `legacy-yellow`, `legacy-pink`) in one sweep across these files. Either is a mobile-app change and out of this phase.

### Arbitrary values left in `packages/ui/mights`, with reasons

| Value | File | Why it stays |
|---|---|---|
| `[clip-path:…]`, `[font-stretch:…]` | `geometry.ts` and users | The geometry vocabulary itself; Tailwind has no utility |
| `tracking-[0.01em]`, `tracking-[0.02em]`, `tracking-[-0.005em]` | `MightsButton`, `MightsNavbar`, `MightsType` | Per-role optical tracking on Mona Sans; candidate for `--text-*--letter-spacing` when the expanded-label role is formalised |
| `max-w-[18ch]`, `max-w-[70ch]`, `max-w-[75ch]` | `MightsPage`, `MightsProse`, `MightsType` | Measures in `ch` are type-relative by design |
| `pb-[env(safe-area-inset-bottom)]`, `pb-[calc(var(--spacing-dock)+env(…))]`, `pb-[calc(env(…)+--spacing(3))]` | `MightsDock`, `MightsFooter` | Safe-area math; the lengths inside are tokens |
| `transition-[filter]`, `transition-[background-color,border-color]` | `MightsButton`, `MightsNavbar` | Property lists, not values |
| `list-[square]`, `aspect-4/3` | `MightsProse`, `MightsFigure` | On-scale Tailwind forms |
| `drop-shadow(0_0_14px …)` glow | `MightsButton` | One-off hover glow built from `--color-primary`; promote to a `--drop-shadow-*` token if a second element glows |

No `duration-[…]`, `text-[Npx]` or `[2px]`/`[12px]` remain in the package.

## 3. `MightsPlaceBento` variant spec

Source: `packages/ui/mights/MightsPlaceBento.tsx`. Props type: `MightsPlaceBentoProps`. Existing call sites (`places={…}` only) compile unchanged and render the `default` variant.

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `places` | `readonly BentoPlace[]` | — | Shorthand: every module is a place. Mutually exclusive with `modules`. |
| `modules` | `readonly BentoModule[]` | — | `BentoPlaceModule` (`kind: 'place'`), `BentoFactModule` (`kind: 'fact'`, `id`, `label`, `value`, `note?`, `href?`), `BentoCustomModule` (`kind: 'custom'`, `id`, `content`, `href?`) |
| `variant` | `'default' \| 'map-dominant' \| 'story-dominant' \| 'compact' \| 'proof'` | `'default'` | Discriminates `lead` |
| `lead` | `BentoMapLead` for map-dominant; `BentoFigureLead` for story-dominant; any `BentoLead` for proof; not allowed otherwise | — | Type-checked per variant |
| `headingLevel` | `2 \| 3` | `3` | 2 when the bento sits directly under the h1 |
| `motionKey` | `string` | — | One group reveal; see §4 |

`BentoLead` = `BentoMapLead` (`kind: 'map'`, `center`, `zoom`, `pitch?`, `pins?`, `alt`, `caption?`) | `BentoFigureLead` (`kind: 'figure'`, `src`, `alt`, `caption?`) | `BentoCustomLead` (`kind: 'custom'`, `content`).

A `custom` module or lead is a frame for caller-composed Mights primitives (`MightsHeading`, `MightsText`, `MightsLocationStamp`, `MightsFigure`, `MightsButton`). It is not a door for ad-hoc markup.

### Layout per variant (md and up, 12 columns)

| Variant | Dominant | Supports | Media | Register |
|---|---|---|---|---|
| `default` | module 0: `md:col-span-7 md:row-span-2`, tall map well (`h-64`, `md:min-h-80`), `MightsHeading size="title"` | modules 1–2: `md:col-span-5`, short map well (`h-40 md:h-44`); modules 3+: pairs 5/7, 7/5, odd last one `md:col-span-12` | one map raster per place module, `sizes` matched to span | B1, B5 (B6, B10 once data exists) |
| `map-dominant` | `lead` map: `md:col-span-8`, rows = number of stacked supports (up to 3), 1024×640 request | `md:col-span-4`, text-first, no raster | one raster for the whole bento | B2 |
| `story-dominant` | `lead` figure (`MightsFigure`): `md:col-span-7 md:row-span-2` | first two `md:col-span-5`, then pairs | no per-module raster | B3 (alternate, not built), B8, B9 |
| `compact` | module 0 is the widest: 2 modules 7/5, 3 modules 5/4/3, 4 modules 4/3/3/2 | name + one line (place) or label + value + note (fact) | none | B7, B13 |
| `proof` | `lead` of any kind: `md:col-span-7 md:row-span-2` | as `story-dominant` | per lead | B4 (deferred), B11 (gated by audit §19) |

Below 768px every variant is one column in source order. The dominant item is always first in the source, so reading order, focus order and visual priority agree (WCAG 1.3.2, 2.4.3). It stays legible as dominant on mobile through size: the tall map well in `default`, the 288px lead map in `map-dominant`, the full-width figure in `story-dominant`, and the `title` heading step versus `card` for supports.

### Fixes shared by all variants

1. `label` is no longer passed to `MightsNotchCard`, so the link's accessible name is its full content (name, street, description). This fixes the `label-content-name-mismatch` Lighthouse flagged on `/places/apollo-theater` (audit §14 item 2).
2. "Location pending" renders through `MightsText size="small"`.
3. `sizes` follows each module's span instead of a fixed `45vw`.
4. `MapAttribution` renders only when a map raster renders.
5. `headingLevel` replaces the hard-coded `level={3}`.

### Deferred, recorded

- `BentoPlace.image` (audit §14 proposed it for story supports). Not added: no place has a rights-cleared image yet, so the field would have no producer. Story-dominant supports are text-first meanwhile.
- `MightsNotchCard` notch prop (§19a move 3). Not in this phase's scope.

## 4. Motion contract for bentos

Grammar (from `apps/web/components/site/motion-markers.ts`):

- `trg-bento-<key>` on the bento grid (one ScrollTrigger per bento)
- `mfx-bento-<key>-<n>` on each module, `n = 0` for the dominant one (the lead when a variant has one)

`MightsPlaceBento` emits these when `motionKey` is set (`bentoMotionIds`). `motion.ts:useHomeMotion` finds every `bento-*` trigger, counts contiguous modules (`countBentoModules`), compiles one Kinetrell motion per bento (`bentoReveal`, timing from `bentoRevealPlan`) and attaches it at `top 80%`. Timing: dominant 0 ms, 640 ms, from y 24; supports from 180 ms, 90 ms stagger, 480 ms, from y 14; opacity and transform only.

Reduced motion: `useHomeMotion` returns before arming, so `motion-armed` is never set and nothing pre-hides. No-JS: same. Bentos outside the home page have no motion binding and render static.

The pre-hide rule `.motion-armed [id^='mfx-']` in `apps/web/app/globals.css` covers the module ids. A bento on the home page with `motionKey` is always bound, because every module id it emits is counted from the same DOM.

## 5. New-primitive register

Empty. Two gaps from audit §15 were closed as variants of existing primitives instead:

- Action button: `MightsButton` without `href` renders `<button>` (`MightsActionButtonProps`: `onPress`, `type`, `disabled`, `pressed` → `aria-pressed`, `aria-label`). Link usage (`MightsLinkButtonProps`) is unchanged.
- Bento variants: inside `MightsPlaceBento`.

Still open, needs an entry here before anyone builds it: a chip/segmented control (Explore categories and map/list toggle) and a text input (`MightsSearchForm` and the Explore search). Until then, Explore toggles can use `MightsButton pressed={on} variant={on ? 'primary' : 'ghost'} size="sm"`.

Hand-built button copies to replace with the action form:

| Copy | Replace with |
|---|---|
| `apps/web/app/(site)/error.tsx:12-15` (Try again) | `<MightsButton onPress={retry}>Try again</MightsButton>` |
| `packages/ui/mights/MightsSearchForm.tsx` submit | Done in this phase: `<MightsButton type="submit">` |
| `apps/web/components/explore/ExploreWorkspace.tsx:253-264` (map/list toggle) and `:119-134` (category chips) | `<MightsButton size="sm" pressed={on} variant={on ? 'primary' : 'ghost'} onPress={…}>` |

## 6. Per-screen handoff template

Copy this block per screen into the phase's handoff section. Every value must be a token name or a primitive prop read from source.

```markdown
### Screen: <route> (<file path>)

**Purpose and register entry:** <one line>; bento <B#> or none

**Layout by breakpoint**
| Width | Columns / spans | Notes |
|---|---|---|
| 390 | 1 col, gutter px-4 | dock visible (h-dock + safe area) |
| 430 | 1 col | |
| 768 (md) | 12 col, gap-4 | navbar replaces dock |
| 1024 (lg) | | |
| 1280 (xl) | | contents rail on prose |
| 1440 | max-w-screen-2xl cap | |

**Mobile source order** (= reading order = focus order): 1. … 2. …

**Tokens used:** colors (`semantic.*` names), type steps (`typeScale.*`), spacing (scale steps, `spacing.rail`, `spacing.dock`), widths (`contentWidths.*`), motion (`motion.duration.*`, `motion.easing.*`)

**Mights composition map**
| Region | Primitive | Props (read from source) |
|---|---|---|
| | | |

**Interaction states** (per control): default, hover, focus-visible (`.mights-focus`), pressed / `aria-pressed`, disabled, loading, selected, visited where relevant

**Motion contract:** markers (`trg-`, `mfx-`, `mpx-`, `trg-bento-`), purpose (orient, reveal, connect, focus, physicality, continuity), duration/ease tokens, reduced-motion behaviour, no-JS behaviour

**Edge, empty and error states:** no data (honest empty state, single CTA), partial data, stale or failed source (source + fetched time), no Mapbox token (labelled plate), long names, missing street, 200% zoom / reflow at 320px

**Accessibility:** heading outline, landmarks, target sizes (24px min, 44px goal), focus-not-obscured by dock/navbar, contrast pairs used
```
