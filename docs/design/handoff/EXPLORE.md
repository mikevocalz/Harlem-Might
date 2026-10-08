# Handoff: Explore (`/explore`)

Phase 4 of the premium experience pack. Sources: `apps/web/components/explore/ExploreWorkspace.tsx` (workspace, master, sheet/inspector, toggle), `ExploreMap.tsx` (imperative Mapbox GL, markers), `explore-url.ts` (URL and focus helpers, tested in `explore-url.test.ts`), `map-status.ts` (map-unavailable store), `use-media-query.ts`. State: `packages/app/features/explore/explore.store.ts:useExplore` (`query`, `sheet`). Map style decision and marker threshold: `docs/adr/0003-explore-map-style-and-markers.md`.

Checked on a production build at 390, 768, 884, 1024, 1280 and 1440, with and without a selection, plus 390 in list view with a selection. No horizontal overflow at any width. Axe (wcag2a/2aa/21aa/22aa + best-practice): 0 violations at 1280 with and without a selection, 0 at 390 with a selection, 1 at 390 without (see Accessibility).

## Composition map

No bento anywhere in Explore.

| Region | Primitives | Props used (read from source) |
|---|---|---|
| Root | `Main` (`@acme/ui/tw`), `MightsHeading` | `level={1}`, `className="sr-only"` |
| Master header | `Text` (visible title from md, `condensed`), `TextInput`, `MightsButton` (Clear) | `variant="outline" size="sm" aria-label="Clear search" onPress` |
| Category chips | `MightsButton` ×7 in a `role="group"` | `size="sm" pressed={on} variant={on ? 'primary' : 'outline'} onPress` |
| Result count | `Text role="status" aria-live="polite"` | text from `explore-url.ts:resultsSummary` |
| Result rows | `Pressable` | `data-explore-focus="row:<id>"`, `aria-current` |
| Empty state | `MightsText`, `MightsButton` | `variant="secondary" size="sm"` "Clear search and filters" |
| Map | `ExploreMap` (imperative), DOM marker buttons styled with utilities | `occluderRef`, `layoutKey` |
| Map unavailable | `MightsText`, `MightsButton` | "Show the list" on phones only |
| Sheet / inspector | `View role="dialog"`, `MightsHeading` (`id`, `level={2}`, `size="title"`), `MightsButton` Close (`ghost`), Less/More (`outline`), `MightsLocationStamp` (`name`, `street`), `MightsText`, `MightsButton` Get directions (`external`), Open place page (`secondary`) | |
| View toggle (phones) | `MightsButton` ×2 in a `role="group"` | `pressed`, `variant` as chips |

New `MightsButton` variant `outline`: a `border-strong` rail (3.73:1 on `surface`) around a `surface` fill. Ghost's 10% gold fill measured 1.06:1, so an unselected chip had no visible edge.

## Inspector content

Order: name, `MightsLocationStamp` (category, street or area), `shortDescription`, "Location pending verification." when the place has no coordinates, then actions: Get directions (only with coordinates; Google Maps in a new tab, announced) and Open place page.

Struck: `whyItMatters` (the fixture strings are planning copy, not place facts), Save (no sign-in on this site), AR (no AR runtime on the web). None of them renders a button.

## Layout by breakpoint

| Width | Composition |
|---|---|
| 390, 430 | Column: search, chips (one sideways-scrolling row), count; then map or list; then the Map/List toggle just above the dock. Selected place: sheet over the stage at `half` (map or list still visible above it), `peek` (title row only) or `full` (whole stage, modal). |
| 768, 884 | Master column `w-pane-primary` + map. Chips wrap. Inspector is the same sheet, overlaying only the map column (`md:left-(--container-pane-primary)`), with detents. 884 is not treated as desktop. |
| 1024, 1280, 1440 | Master `w-pane-primary` + map + docked inspector `w-pane-inspector` with a gold left rail. The map narrows instead of being covered. No detent buttons. |

Height: `100dvh` minus the navbar (`--spacing * 16`), minus `--spacing-dock` and the safe-area inset below md. `grow-0` on `Main` overrides the global `main[role=main]` grow rule, which had pushed the phone toggle under the dock.

Camera padding comes from the sheet's measured overlap with the map, so a selected pin lands in the visible part at every width and detent. Changing detent re-centres.

## Tokens used

Colours: `surface`, `surface-raised`, `surface-sunken`, `primary`, `on-primary`, `text`, `text-muted`, `border-strong`, `rule-hairline`, `rule-rail`. Type: `title-lg`, `title`, `body`, `small`, `label`, `ui` (via `MightsButton`). Widths: `pane-primary`, `pane-inspector`. Spacing: 4px scale, `rail`, `dock`. Z: `--z-raised`. Motion: `duration-fast` on the marker diamond, off under reduced motion.

Replaced literals: `text-[13px]`, `[14px]`, `[15px]`, `[17px]`, `lg:w-[400px]`, `lg:w-[440px]`, `top-[40%]`, `p-[2px]`, `[font-stretch:75%]`, the `56px` dock height, and `rightInset={460}`. The `.mights-marker` block in `globals.css` is gone; markers use token utilities in `ExploreMap.tsx`.

## States

| Element | State | Behaviour |
|---|---|---|
| Search | typing | draft in `useExplore.query`; `history.replaceState` after 250 ms; Enter commits at once |
| Search | focus with sheet open (phone) | sheet drops to `peek` so results stay visible |
| Chip | pressed | gold fill + `aria-pressed="true"`; resting chips are outlined |
| Row | selected | gold left rail, raised fill, gold diamond, `aria-current="true"` |
| Marker | default / selected | 12 px gold diamond / 18 px diamond with a `text` ring and a name label, `aria-pressed` |
| Marker | focus-visible | 2 px `primary` outline on the 44×44 box |
| Sheet | peek / half / full | Less / More step one detent; no grabber because it does not drag |
| No results | | "Nothing in the catalogue matches “zzzz” in Food. Search looks at names, areas, categories and tags." + "Clear search and filters" |
| Map unavailable | no token or no WebGL | plate: "The map didn’t load. Every place is in the list." + "Show the list" on phones |
| Loading | | map pane shows `surface-sunken`; list and filters work before the map |

## URL contract (unchanged)

`view`, `q`, `category`, `place` live in the URL. Select = `router.push`; search and filters = replace (search debounced); Close or Escape = `router.back()` when this session pushed, else replace without `place`; browser Back closes a selection; reload and shared links restore everything. Detent is never in the URL.

Next 16 keeps the previous route alive in an Activity, so returning from a place page reveals the same workspace: the map is rebuilt (markers show the pressed state from their first frame) and focus stays on "Open place page", or moves to the sheet heading if it had fallen to `<body>`.

## Accessibility (WCAG 2.2 AA)

| Criterion | Result | Evidence |
|---|---|---|
| 4.1.2 Name, role, value | Pass | markers `role="button"` + `aria-pressed` (was `role="img"`); chips and toggle `aria-pressed`; sheet `role="dialog"` `aria-labelledby` |
| 1.3.1 Landmarks | Pass | workspace root is `<main>`; axe `landmark-one-main` cleared |
| 2.4.3 Focus order | Pass | skip, nav, search, 7 chips, rows, markers, map controls; opening moves focus to the sheet heading, next Tab is Close |
| 2.4.3 Focus return | Pass | Close / Escape / Back return focus to the opener (`returnFocusId`), falling back to row, marker, search |
| 2.1.2 No keyboard trap | Pass | Tab leaves the markers for zoom, attribution and the rest of the page |
| Modal | Pass | `aria-modal="true"` and the rest `inert` only at the phone `full` detent; otherwise `false` |
| 2.4.7 Focus visible | Pass after fix | search and markers drew no outline (Tailwind v4 `outline-none` zeroes the style variable); now `outline-hidden` + `focus-visible:outline-solid`. Same fix in `MightsSearchForm` |
| 2.4.11 Focus not obscured | Pass | toggle sits outside the stage above the dock; the sheet never covers it |
| 1.4.11 Non-text contrast | Pass | chip/toggle rail `border-strong` 3.73:1; gold on surface 12.40:1 |
| 1.4.1 Use of colour | Pass | selection = size + ring + label + rail + `aria-pressed`/`aria-current` |
| 2.5.8 Target size | Pass (exception) | markers 44×44; at 390 Red Rooster's and Sylvia's hit areas overlap at fit zoom (axe `target-size` ×1). Each has a full-width list row: the equivalent-control exception |
| 2.5.7 Dragging | Pass | every map outcome is reachable from the list, marker buttons and ± zoom |
| 4.1.3 Status messages | Pass | polite count: "3 places in Culture, 2 on the map." |
| 2.3.3 / reduced motion | Pass | selection `jumpTo` under reduce (camera final within one frame), `flyTo` otherwise; diamond transition off |

Not tested: VoiceOver/NVDA output, 200% zoom.

## Scenario results (production build, Chrome, :3241)

42/42 checks passed, no console errors. Script: Phase 4 scratchpad `tool/scenarios.js`.

- **Desktop 1440:** type "Apollo" → URL `?q=Apollo` by replace, 1 row, status "1 place matching “Apollo”." → select row → `place` pushed, marker `aria-pressed=true`, `role=button`, focus on the inspector heading, `aria-modal=false`, inspector docked at x 1120 (map's right edge), w 320 → Open place page → Back → URL, draft, inspector and pressed marker restored, focus inside the inspector → Escape → replace (this session had not pushed), focus on the Apollo row.
- **Mobile 390:** map-first → Culture chip pressed → List keeps `category=Culture` → select Studio Museum → sheet at half (top at 397 px), focus on heading → More → full, modal, 32 subtrees inert → Less → inert lifted → Close → `router.back()`, filter and view kept, focus on the Studio Museum row, history grew by exactly the one pushed entry → Back leaves Explore for the previous page.
- **Reduced motion:** marker position identical at 60 ms and 1500 ms after selection (jump); control run without reduce still moving at 60 ms (fly). No Lenis on `<html>`.
- **Keyboard 1280:** order search (8) < chips (12) < rows (16) < markers (25); Enter on a marker opens the inspector with focus on the heading; Tab reaches Close; Escape returns focus to the marker; marker outline solid, 44×44.

## Performance

| Measure | Before | After |
|---|---|---|
| `/explore` initial JS (gzip -9, chunks in served HTML) | 285.2 KB, 12 chunks, GSAP 45.2 KB + GSAP/Lenis 15.6 KB | 236.3 KB, 12 chunks, no GSAP or Lenis |
| `mapbox-gl` chunk (lazy) | 512 KB gzip | unchanged |
| `hm:map-ready` | not instrumented | 6.0–6.3 s headless SwiftShader; software GL, not a budget figure |

`SiteMotionShell` imports Lenis and the GSAP bridge inside its effect, so only routes that smooth-scroll fetch them, and reads reduced motion with `useSyncExternalStore` because `kinetrell/web/react` imports GSAP at module level. Reduced-motion and no-JS paths are unchanged. Before figure: the build on disk before this branch (P3 merge).

## Captures

Phase 4 scratchpad: `explore@{390,768,884,1024,1280,1440}-{none,apollo}.png`, `explore@390-list.png`, `scenario-mobile-sheet-{half,full}.png`, `scenario-desktop-inspector.png`, `axe.json`, `scenarios.json`, `keyboard-order.json`.
