# Explore handoff: what PR D built

This is the design handoff for Explore on Horizon, tablet, foldable and phone. It was written for `feat/spatial-explore-ux` (PR D) and updated 2026-10-08 for `feat/mobile-site-parity` P2, which made native Explore look like the site's Explore (`apps/web/components/explore/ExploreWorkspace.tsx`, `docs/design/handoff/EXPLORE.md`). Sections 2, 3 and 5 describe the P2 look; the layout rules in §1 and §4 are unchanged except where noted. Each section says where the code is and how it differs from the original spec. The original spec, critique, a11y audit, token audit and copy deck were written before the build. Where this file and those disagree, this file is the current state.

Decisions referenced: DECISIONS S4 (map stays in the main window), S5 (Detail exists only while a place is selected), S7 (assistant is inline, never a window), S11 (native Mapbox surface, not built yet), S12 (Discover inline; its Place Detail window is superseded by S17), S13 (tab shell from the site's nav), S14 (dark only), S15 (native Mights kit), S16 (street map deferred; schematic map with an honest caption. Settled for phone and foldable by ADR docs/adr/0007, headset still deferred), S17 (one 1440x900dp window, three columns; Detail window deferred, ADR 0004), S18 (rail as its own window, windows rendered at the surface origin, Detail still in the main window; ADR 0005), S20 (More struck on Horizon; Place Detail as a second Activity panel, S17 column as the fallback; ADR 0006).

### References (Mobbin, pulled 2026-10-08)

- [Sweatpals, dark map with a leading results list](https://mobbin.com/screens/da8712ec-af85-4e31-b2d2-c9064b4d9e08): a count line heads the list, quiet light markers sit on a dark map, and the list stays beside the map instead of covering it. Supports the dark canvas, the summary line and the tiled list.
- [H&M, store list beside the map](https://mobbin.com/screens/c93aa1a9-66cb-48af-b6b3-a64e5958a404): flat rows split by hairlines, name over address, no cards. Supports the flat `PlaceRow`.
- [H&M, store detail side panel](https://mobbin.com/screens/8c2cda9c-12dd-4cc2-8e9b-83acda6fb1cf): the panel sits on the map's trailing edge with the name, a close control, the address, one bordered action and "Get directions". Supports the inspector shell and its two actions.

## 0. One product, one store

| State | Owner | File |
|---|---|---|
| query, category, selection, saved ids, `sheet.returnFocusId` | `useExplore` | `packages/app/features/explore/explore.store.ts` |
| assistant `open`, `activity`, `walk`, `answer`, `draft` | `useMightsAssistant` (new) | `packages/app/features/explore/mights-assistant.store.ts` |
| compact pane, medium drawer | `useExploreLayoutStore` (new) | `apps/mobile/src/spatial/exploreLayout.store.ts` |
| OS reduce-motion flag | `useReducedMotionStore` (new) | `packages/ui/reduced-motion.ts` |

- Opening a place is one write, `openPlace(id, returnFocusId)`. The layout derives which pane or window shows it. The old path pushed a route, called `show('secondary')` and wrote the store (critique C8).
- `closePlace()` clears the selection and keeps `returnFocusId` so focus can go back.
- `/explore/[placeId]` still works as a deep link. The route calls `openPlace` and renders nothing. Detail renders in the layout at a fixed tree position, so its `<SpatialWindow>` never re-registers when the route changes.
- `walk` stays `null`: no route provider exists.

## 1. Horizon workspace

`EXPLORE_WORKSPACE` in `apps/mobile/src/spatial/exploreWorkspace.ts`. Since S17 (2026-10-08) everything lives in ONE main window, 1440x900dp (`expo-horizon-core` `defaultWidth`/`defaultHeight` in `apps/mobile/app.config.ts`): Discover 360 | map (flex) | Detail 400. Discover and Place Detail are `layer` surfaces in the leading and trailing regions, and `maxPromotedSurfaces` is 0, so nothing asks for a window. Detail is still mounted only while a place is selected (S5).

The S12 Detail window (440x600, end-anchored, priority 10) is deferred, not deleted: `PLACE_DETAIL_WINDOW` and `PLACE_DETAIL_OFFSET` stay for an explicit "Open in new window" command, and a test proves they still resolve. On the Quest 3S it covered the map at every offset tried, and its buttons never fired: inside a promoted window Meta's `SpatialWindowRootViewGroup` reports window-relative `pageX/pageY`, while RN's Pressability measures the press rect in main-surface coordinates, so the first move cancels the press. Details and sources in `adr/0004-detail-in-window.md`; the measured placement rule and the input fix are in `adr/0005-spatial-shell-rail-window.md`.

### Since S18: the rail window and the window host (ADR 0005)

- **Rail.** On quest builds the tab bar asks for its own window on the main window's start edge: `RAIL_WINDOW` (140x356dp, `{parent:'start', child:'end'}`, no offset, priority 20, `fallback: 'drop'`) in `apps/mobile/src/spatial/railWindow.ts`, drawn by `AppTabBar layout="window"` from `components/AppTabBarHost.tsx`. Five 60dp icon-and-label items, 26dp icons, `xr-caption` labels, the gold leading marker on the current tab. While the window is `pending` or `dropped`, and on every other build, the in-window rail or bottom bar draws as before.
- **Gap.** Horizon OS 207 puts an outward-attached window's far edge 160dp past the main window's edge whatever its width (eight trials, measured from `dumpsys volumetric_window`; table in ADR 0005). 140dp wide leaves 160 − 140 = 20dp. `outwardWindowGapDp` encodes the rule.
- **Detail stays in the main window.** A 400dp Detail window would overlap the main one by 240dp, and offsets top out at ±5 steps of about 2dp. `PLACE_DETAIL_WINDOW` stays deferred.
- **Window host.** Every `<SpatialWindow>` renders from `SpatialWindowHost` (`app/_layout.tsx`, at the main surface's origin) through `useHostedSpatialWindow(window, content)`. Inside a promoted window Meta's root reports window-relative `pageX/pageY` while Pressability measures in the main surface; at the origin the two agree. Never render `<SpatialWindow>` anywhere else. Hosted content sees only the root's providers, so wrap it in any context it needs (`ExploreWorkspaceWindow` adds `ExploreTypeContext`).
- **Not verified on the headset yet:** rail presses with a controller and a hand, and the rail's measured gap. Steps are in ADR 0005, "How to check on the headset".

If a surface is ever promoted again, `resolveExploreLayout` (§4) collapses its pane to zero width and the map takes the room; `pending` renders inline.

Back (Android hardware back, controller B) goes through `exploreBackAction`: it closes the assistant panel first, then Detail, then a Discover screen or drawer that covers the map, and after that hands Back to the system.

## 2. List pane (was "Discover")

`packages/app/features/explore/ExploreMasterPane.tsx`, `PlaceRow.tsx`, shared copy in `explore-copy.ts`. Mirrors the site's master column.

| Element | Built (P2) | Site counterpart |
|---|---|---|
| Title | "Explore", `MightsHeading level={1} size="display-md"` held at `text-title-lg` (`xr-heading` 32/40 on quest builds). One name for one place | condensed bold `text-title-lg` |
| Search | square `TextInput` from `@acme/ui/tw`: `h-12`, `border-border-strong`, `bg-surface-raised`, placeholder "Search places, like Apollo", a11y "Search places". "Clear" (`MightsButton sm outline`, a11y "Clear search") shows while there is a query. Filters on every keystroke; the catalogue is a fixed in-memory list, so the old 180ms debounce is gone | same field and Clear |
| Categories | one horizontal row of `MightsButton size="sm"`, `primary` + `pressed` when on, `outline` when off, labelled "Filter by category" | same |
| Summary | `resultsSummary(total, mapped, q, category, 'All')` from `explore-copy.ts`, `text-label` muted, polite live region. "8 places, 6 on the map." | same function |
| Row | flat: hairline bottom divider, 2dp gold leading rail and `bg-surface-raised` when selected, 10dp diamond (`bg-rule-rail`, gold when selected), name in `font-sans-semibold`, second line `placeRowLine` ("Category, street", plus ", location pending" when unmapped). 48dp minimum, `accessibilityState.selected`, label "{name}, {line}." plus "Selected." | same row, same copy function |
| Empty | `noResultsCopy` ("Nothing in the catalogue matches “q” in Category. Search looks at names, areas, categories and tags.") and `MightsButton sm secondary` "Clear search and filters" | same |
| Map toggle | "Map" `MightsButton sm outline` on compact only | the phone Map/List toggle |
| Padding | `px-window` (24dp) on quest builds, 16dp header / 20dp rows elsewhere | p-4 / px-5 |

Removed in P2: the "Discover" title, `SearchBar`, `Chip`, the rounded bordered row cards, the `bg-selected` fill, "N places", the "0" empty glyph and the brownstone street line.

## 3. Map

`packages/app/features/explore/ExploreMapPane.tsx` (the frame), `ExploreMap.native.tsx` / `ExploreMap.web.tsx`, `ExploreSchematicMap.tsx`, `schematic-map.ts`.

Phones and foldables draw the native Mapbox map (ADR `docs/adr/0007-native-mapbox-map-mobile.md`, which settles S16 for those flavors). The headset build keeps the schematic below: S16 stays open there until a Horizon-compatible Mapbox SDK exists. On the headset the schematic stays and says what it is. Markers sit on `bg-map-canvas` (`#070604` dark) at their real OpenStreetMap coordinates; `projectSchematic` fits the mapped places' own bounds into the box, north up. Relative positions are true; distances aren't to scale.

| Element | Built (P2) |
|---|---|
| Markers | the site's mark: a gold diamond (`bg-primary`, rotated square) inside a 48dp target (`size-target`). Rest: 12dp with a 2dp `border-surface` edge. Selected: 18dp with a 2dp `border-text` ring, and the name appears beside it on `bg-surface-raised` behind a 2dp gold rail (truncated at 18 characters). a11y "{name}, {category}. Selected" or "… Show details", plus `selected` state. Selection is size, ring and label, never colour alone |
| Caption | "Schematic map. Street map coming." bottom-leading, always shown |
| Unmapped places | no marker; "2 places aren't on the map yet" under the caption, counted from data |
| Attribution | "Locations © OpenStreetMap contributors", caption step, bottom-trailing |
| Places toggle | "Places" `MightsButton sm outline` (a11y "Show the place list"), only where the list is hidden (compact, medium) |
| Insets | unchanged camera-padding contract: markers lay out inside the map minus overlay panes and the assistant |

Not built, because each needs the street map: zoom, locate, the Mapbox style, camera fly, route line.

## 4. Responsive layout

`apps/mobile/src/spatial/exploreLayout.ts` (pure, tested), `ExplorePane.tsx`, `apps/mobile/app/(tabs)/explore/_layout.tsx`. The SplitView module was deleted in P2; `src/navigation/split-view/` keeps only `use-window-size-class.ts`, `constants.ts` and `transitions.ts`, which this layout reads.

Explore no longer uses `SplitView`. The old layout put the map in the 294dp `supplementary` column and gave the flex region to the detail route (critique C1). Inverting that inside `SplitView` would have meant a new SplitView API on Android plus a divergence from the native iOS `UISplitViewController`. Instead Explore has its own layout, built from the same pieces: the window width from `useWindowDimensions` (the Horizon window is user-resizable), the `TRANSITIONS.paneWidth` tween (220ms; snaps under reduced motion), and keep-mounted panes. The map always takes the flex region. `resolveExploreLayout` returns an `arrangement` (`single`, `toggle`, `columns`) that the route uses instead of a size class.

### Quest builds (S17)

| Window width (dp) | Discover | Map | Detail (only when selected) |
|---|---|---|---|
| < 840 | full screen via "Places" | full screen, first | full screen with Back and "Show on map" |
| 840–1199 | behind "Places"; opening it replaces Detail for the moment (selection kept), "Close" folds it | flex, ≥ 440 | tiled 400 |
| 1200–1359 | tiled 360 with nothing selected; behind "Places" once a selection would push the map under 600 | flex | tiled 400 |
| ≥ 1360 (default 1440) | tiled 360 | flex, ≥ 600: 1080 with nothing selected, 680 with Detail | tiled 400 |

Nothing is drawn over the map at any width: no overlays, map insets are 0. Detail pushes the map narrower. Columns meet on 1dp `border-border-strong` dividers. The 1200–1359 band is the one place the spec's "≥1200 three columns" bends: there the 600dp map minimum wins (ADR 0004).

Pane rhythm on quest builds: padding 24 (`px-window`), gaps 24/12/8 (`gap-xr-section`, `gap-xr-stack`, `gap-xr-inline`), list rows 72 (`min-h-xr-row`), Detail header 64 (`min-h-xr-header`). Every control is at least 48x48 (`MightsButton size="xr"`); Close, Get directions, Open place page, "View on a table" and the search field are 60 (`xr-primary`, `h-target-primary`). "View on a table" (`apps/mobile/src/ar/ViewInArButton.tsx`, PR #28) reaches Detail's action row through its `actions` slot and hides itself unless the build is quest, the runtime is Meta Horizon and the place has coordinates. Type: body 18/26, secondary 16/22, headings 20/24/32, floor 14, all Mona Sans roman; Explore sets no italic face. The scale lives in `useExploreType()` (`packages/app/features/explore/explore-type.ts`).

### Phones, tablets, PICO (unchanged)

| Class (dp) | Discover | Map | Detail (only when selected) | Assistant |
|---|---|---|---|---|
| compact < 600 | full screen via "Places"; "Map" returns | full screen, first | full screen with Back and "Show on map" | sheet across the map |
| medium 600–839 | 320dp drawer over the map via "Places" | full width | 360dp overlay; markers pad right 360 | 400dp panel |
| expanded 840–1199 | tiled 280dp | flex | 360dp overlay | 400dp panel |
| large ≥ 1200 | tiled 320dp | flex (≥ 520) | tiled 360dp | 400dp panel |
| extraLarge ≥ 1600 | tiled 320dp | flex | tiled 400dp (`pane-detail-xr`, was 440) | 400dp panel |

Rules are enforced in tests (`exploreLayout.test.ts`):
- M1: at the narrowest width of every tiled class, the map is the widest pane.
- S17: on quest builds nothing overlays the map at any width, the map keeps 600dp whenever Discover is a permanent column and 440dp from 840dp up, and it is exactly 1080/680dp at 1440dp without and with Detail.
- M3/S5: no selection, no Detail, whatever the placement.
- A promoted pane is zero width and the map takes it; `pending` stays inline.

**Compact unmount bug, fixed.** The old SplitView rendered only the active column when collapsed, so shrinking the main window below 600dp unmounted Discover and its `<SpatialWindow>`. `ExplorePane` keeps every pane mounted at the same tree position in every mode (`tiled`, `overlay`, `screen`, `collapsed`, `promoted`) and changes only its style. Collapsed and promoted panes are `aria-hidden`, `no-hide-descendants` and `pointerEvents="none"`. No new SplitView API was needed.

Not built: the compact Discover bottom sheet with a 120dp peek (`BottomSheet` has no `snapPoints` prop; compact keeps the full-screen pane swap the app already had), and the foldable hinge rules (book, tabletop, multi-fold). The old Explore didn't apply `fold-layout.ts` either; wiring it is the next layout task.

## 5. Place Detail

`packages/app/features/explore/ExplorePlaceDetail.tsx`. Mirrors the site's inspector.

Top to bottom: a 2dp gold rail frame (`bg-primary` + `pl-rail` beside the map, `pt-rail` on compact where Detail covers it); a header on a hairline with the title (`MightsHeading level={2} size="title"`, in a grouped header wrapper that is the focus target) and a text "Close" (`MightsButton sm ghost`, a11y "Close {name}"; "Back" on compact); `MightsLocationStamp` with category and street; `shortDescription`; "Location pending verification." for unmapped places; actions ("Show on map" outline on compact, "Get directions" primary when the place has coordinates, "Open place page" secondary when the build has a site address); Nearby (three closest mapped places with `formatDistance`, 48dp rows); "Where this comes from".

- `shortDescription`, never `whyItMatters`: the fixture's whyItMatters is planning copy about the product, not a fact about the place (same rule as the site).
- "Get directions" opens `directionsUrl(lngLat)` (Google Maps, app or browser) through solito's `Link`, the same URL the site uses.
- "Open place page" opens `siteUrl(routes.place(id))` (`apps/mobile/src/site/site-url.ts`, from `EXPO_PUBLIC_APP_URL`) in the browser. With no site address in the build it doesn't render, so it is never a dead button. A native `/places/[slug]` stays deferred.
- Save is struck until saved places sync to an account (D8), matching the site. `useExplore().savedPreviewIds` stays in the store, unused by any screen.
- Unknown ids: "We couldn’t find that place." with "Back to Explore".

## 6. Ask Harlem Might

`packages/app/features/explore/MightsAssistant.tsx`, `mights-assistant.store.ts`. Rendered inside the map region on every size class; never a window (S7). `MightsPanel` and the inspector drawer are gone.

| State | Built |
|---|---|
| Collapsed | 48dp bar, bottom centre, up to 560dp (`max-w-assistant-bar`). Label "Ask Harlem Might", or "Ask about {name}" with a place selected |
| Expanded, nothing selected | "I can find places on this map and show what our records say about them. I don't have hours or events yet." and a search field. Typing lists up to three matching places; choosing one opens it |
| Expanded, place selected | "{name}: {shortDescription}" plus three rows: "Why it matters" (opens Detail), "What's nearby" (answers from coordinates, hidden for unmapped places), "Show on map" |
| Close | X button (a11y "Close Ask Harlem Might") or Back |

Everything the panel says is assembled from fields the app already holds. Nothing is generated and nothing is spoken, so there's no mic button and no AI label. `activity` exists (`idle | listening | thinking | speaking | navigation`) with status copy in `ASSISTANT_STATUS`, but only `idle` is reachable until a speech or answer provider is wired. The panel is `w-assistant-panel` (400dp) bottom-trailing, or a sheet across the map on compact, and is capped at half the map height.

### Rive contract (no asset exists yet)

The only `.riv` in the repo is `packages/spatial/rive/assets/learning-question.riv`. Until a real one is made, the bar shows `AssistantMark`, a static token-drawn ring. Nothing animates and nothing fakes a character.

| Item | Value |
|---|---|
| File | `packages/spatial/rive/assets/mights-assistant.riv` |
| Artboard | `Assistant` |
| State machine | `Assistant` (the native Rive runtime plays state machines only) |
| Input `activity` | number, 0 idle, 1 listening, 2 thinking, 3 speaking, 4 navigation. Map: `ASSISTANT_RIVE_ACTIVITY` |
| Input `reduceMotion` | boolean, from `useReducedMotion()`; true freezes the speaking loop to static bars |
| Size | 32dp visual inside the 48dp bar |
| Render through | `RiveStage` (`packages/spatial/rive/RiveStage.types.ts`), replacing `AssistantMark` in `MightsAssistant.tsx` |

## 7. Motion

| Element | Built |
|---|---|
| Spatial windows | no app animation; the OS owns them |
| Explore panes | width tween `TRANSITIONS.paneWidth` (220ms) |
| SplitView pane swap, inspector drawer | springs moved to tokens: `motion.spring.pane`, `motion.spring.drawer`. SplitView was deleted in P2; the tokens stay for the next pane animation |
| Press scale | `PressScale` (native) |
| Reduced motion | `useReducedMotion()` reads `AccessibilityInfo.isReduceMotionEnabled()` once and follows `reduceMotionChanged`. Panes, SplitView springs and `CollapsiblePane` use `transitionFor(reduce, …)`, which returns an instant transition; `PressScale` drops its tap scale |

The Detail content crossfade, marker grow animation and camera fly were not built. The first two would be the only motion on an otherwise still screen; the camera needs the native map.

## 8. Accessibility

| a11y.md finding | Status |
|---|---|
| P1 selected-row contrast | fixed: raised fill + gold rail + larger gold diamond (P2) |
| P2 colour-only map selection | fixed: size, label and `selected` state |
| P3 10dp text | fixed in Explore: no `text-[Npx]` or `text-xs`; flat floor is `text-small` (12.25dp), quest builds use the `xr-*` dp steps |
| P4 1.29:1 edges | fixed: `border-border-strong` on the search field and outline buttons; rows are flat on hairline dividers (P2) |
| P5 numbered fake pins | fixed: named markers at real coordinates; unmapped places have no marker |
| P6/P7 caps labels, placeholder media | removed |
| O1–O3 targets | fixed in Explore: 48dp everywhere. `MightsButton sm` is 40dp visual with 4dp vertical hit slop (48dp target). The `SearchBar` clear-button gap no longer applies to Explore, which uses the text "Clear" button |
| O4 reduced motion | fixed (§7) |
| O5 focus move and return | built: rows and markers register in `focus-registry.ts`; opening Detail focuses its title; closing returns focus to `returnFocusId` after Detail unmounts. Not run under TalkBack |
| O6 inspector reachable while closed | fixed; collapsed panes are `aria-hidden` + `no-hide-descendants` in `ExplorePane`. SplitView itself was deleted in P2 |
| O7 zoom buttons | not built (needs the native map) |
| U1 dead buttons, U2 developer copy | removed |
| U3 count live region | fixed |
| R1 chips as tabs | fixed: category toggles are `MightsButton` with `accessibilityState.selected` (P2) |
| R2 selected state on rows and markers | fixed |

## 9. Tokens added (`packages/theme/tokens.ts`, regenerated with `node build-css.mjs`)

- Type: `xr-caption` 14/20, `xr-label` 16/22, `xr-body` 18/26, `xr-title` 20/26, `xr-headline` 24/30, `xr-heading` 32/40, `xr-prose` 20/34, all in px so the rem-14 polyfill can't shrink them (S17 values).
- Spacing: `target` 48px, `target-primary` 60px, `target-gap` 12px, `window` 24px, `xr-section` 24px, `xr-stack` 12px, `xr-inline` 8px, `xr-row` 72px, `xr-header` 64px, `focus-ring` 3px, `marker` 20px, `marker-selected` 28px.
- Semantic colours: `selected`, `map-marker`, `map-marker-selected`, `route`, `map-canvas`.
- Widths: `pane-discover` 320, `pane-discover-narrow` 280, `pane-detail` 360, `pane-discover-xr` 360, `pane-detail-xr` 400 (was 440), `pane-map-min-xr` 600, `assistant-bar` 560, `assistant-panel` 400 (px).
- Motion: `duration.camera` 600ms, `spring.pane`, `spring.drawer`.
- Layout: `windowClass` (the SplitView's `WINDOW_SIZE_CLASS_MIN_WIDTH_DP` now reads it), `spatialWindow`, `horizonMainWindow`.

`ExploreTypeContext` picks the scale: `xr` on quest builds, `flat` elsewhere.

## 10. Verified and not verified

Verified on the branch: `pnpm --filter @acme/app test` (134 pass), `pnpm --filter mobile test` (all new tests pass; the one failure is the existing `pane-overrides.test.ts` case, untouched), `pnpm --filter mobile typecheck` (only the 9 known `viro-external-test` errors), `pnpm turbo build typecheck lint --filter='!mobile'` 26/26, `pnpm spatial:verify-android`, and `npx expo export --platform android`. The exported Hermes bundle contains the new copy and none of the removed developer strings.

Not verified: anything on a device. No TalkBack pass, no Quest 3S run, no tablet or foldable run, and no check that a `<SpatialWindow>` inside a zero-width, `aria-hidden` pane promotes the same way it did inside the old `CollapsiblePane` (the old code used the same pattern). Uniwind rendering of the new token classes (`size-target`, `w-assistant-panel`, `bg-selected`) was checked in the bundle build only, not on screen.

### P2 (2026-10-08, `feat/mobile-site-parity`)

Verified with real exit codes: `apps/mobile` `tsc --noEmit` (only the 9 known `viro-external-test` errors), `pnpm --filter mobile test` (21 pass), `pnpm --filter @acme/app test` (105 pass, including `explore-copy.test.ts`), `pnpm --filter @acme/ui test` (12 pass), `pnpm turbo build typecheck lint --filter='!mobile'` 26/26, `pnpm spatial:verify-android`, and `npx expo export --platform android` (exit 0). The export's sourcemap has 0 `lucide-react` (web) modules: `@acme/ui/mights` now resolves to `mights/index.native.ts` under the `react-native` condition, which leaves out `MightsDock`, `MightsNavbar`, `MightsFooter` and `MightsMapImage`. The Hermes bundle contains "Schematic map. Street map coming.", "Search places, like Apollo", "Get directions" and "Open place page".

Not verified: any of it on screen. No Quest 3S, emulator or phone run, no TalkBack pass, and no side-by-side screenshot against the site at the same width, which the parity audit names as the gate for each phase.


### S20 (2026-10-08, `feat/spatial-panels`, ADR 0006)

What changed: More is struck from the rail on Horizon builds (`HORIZON_STRUCK_TABS`, `src/site/tabVisibility.ts`); the rail window is 140x288dp. Selecting a place from the map or Discover opens Place Detail as its own Horizon OS panel (`modules/spatial-panels`, `SpatialPanelActivity`, registered as `PlaceDetailPanel` in `apps/mobile/index.ts`), 400x600dp. The panel shares the JS runtime, so a new selection updates it in place. Its Close clears the selection. If the launch throws, the S17 column shows Detail in the main window. solito works inside the panel through `PanelNavigationProvider`, and its routes run in the main window (`MainRouteRelay`).

Verified with real exit codes: `apps/mobile` `tsc --noEmit` (only the 9 known `viro-external-test` errors, after `pnpm install --frozen-lockfile` repaired a node_modules that had drifted from the lockfile), `pnpm --filter mobile test` (123 pass), `pnpm turbo build typecheck lint --filter='!mobile'` 26/26, `pnpm spatial:verify-android` (against the regenerated tree), `npx expo export --platform android` (bundled from `apps/mobile/index.ts`), and `pnpm --filter mobile quest --install --serial 340YC10GC3014S` (exit 0).

On the Quest 3S: the panel opens to the right of the main window, vertically centred, at 400x600dp, with its inner edge 158.8dp from the main window's right edge, 28dp toward the user, turned 45° (three runs; vrshell `placementType: slot`). The selection change, Close and "View on a table" were driven with `adb shell input`. A Layout SDK window with no offset overlapped by 240dp (option b, rejected). The rail window sits flush (−0.4dp), not 20dp out.

Not verified: controller and hand presses on the panel and the rail, a screenshot of the panel (captures were blank while the headset was off; the one worn capture showed a Metro error from another branch's `nitro-mapbox-ar` work), and the requested 20dp same-depth placement, which no public API provides.
