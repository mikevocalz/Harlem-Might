# Explore handoff: what PR D built

This is the design handoff for Explore on Horizon, tablet, foldable and phone, updated to match what shipped on `feat/spatial-explore-ux`. Each section says where the code is and how it differs from the original spec. The original spec, critique, a11y audit, token audit and copy deck were written before the build. Where this file and those disagree, this file is the current state.

Decisions referenced: DECISIONS S4 (map stays in the main window), S5 (Detail exists only while a place is selected), S7 (assistant is inline, never a window), S11 (native Mapbox surface, not built yet).

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

Unchanged from PR C: `EXPLORE_WORKSPACE` in `apps/mobile/src/spatial/exploreWorkspace.ts`. Map is the main window; Discover is a 360x600 start window at priority 10; Place Detail is a 440x600 end window at priority 20 that mounts only while a place is selected. Window sizes now also live in `@acme/theme` as `spatialWindow` and `horizonMainWindow`.

Placement drives the main window through `resolveExploreLayout` (§4). `spatial` collapses the pane to zero width and the map takes the room. `pending` renders inline. No banner appears for any placement change.

Back (Android hardware back, controller B) goes through `exploreBackAction`: it closes the assistant panel first, then Detail, then a Discover screen or drawer that covers the map, and after that hands Back to the system.

## 2. Discover

`packages/app/features/explore/ExploreMasterPane.tsx`, `PlaceRow.tsx`, `packages/ui/Chip.tsx`.

| Element | Built |
|---|---|
| Title | "Discover", `role="heading"`, heading step of the active type scale |
| Search | `SearchBar`, placeholder "Search places, streets, history", a11y "Search Harlem places", `min-h-target`. The filter now also matches `street` |
| Chips | new `Chip`: `role="button"` with `accessibilityState.selected`. 48dp min height, `border-border-strong` at rest, `primary` fill when selected, 12dp gaps. The chip row is labelled "Filter by category" |
| Count | "{n} places", `aria-live` / `accessibilityLiveRegion="polite"` |
| Row | `PlaceRow`: name and street only. Selected rows get the `bg-selected` fill, a 2dp `rule-rail` leading edge and `accessibilityState.selected`. Resting edge is `border-border-strong`. Unmapped places read "{street}. Not on the map yet". The a11y label is "{name}, {category}, {area}." plus "Selected." when selected |
| Empty | `EmptyState` with "No places match "{q}"." or "No {category} places yet." and a "Clear search and filters" button |
| Padding | `px-window` (24dp) on quest builds, 16dp elsewhere |

Removed: "Explore Harlem", "Search the catalogue…", "Master catalogue preview", description lines, tag pills, the `bg-sky-50/60` selected fill (1.13:1).

Deviation: rows render in a `ScrollView`, not `VirtualList`. Eight places don't need recycling, and the live-region count sits inside the same scroll. Swap in `VirtualList` when the catalogue grows. Rows don't use `BusinessIdentity` because its avatar is a thumbnail, which direction.md removes.

## 3. Map

`packages/app/features/explore/ExploreMapPane.tsx`, `schematic-map.ts`.

The native Mapbox surface is still not built (S11), and `GridScene` with its light-palette hex literals is gone. Until the native map lands, markers sit on a `bg-map-canvas` surface at their real OpenStreetMap coordinates. `projectSchematic` fits the mapped places' own bounds into the box with north up. Relative positions are true. Distances aren't to scale, because the box's aspect ratio isn't the bounds' aspect ratio.

| Element | Built |
|---|---|
| Markers | 48dp hit area (`size-target`), 20dp dot (`size-marker`, `bg-map-marker`, gold-dim ring), selected 28dp (`size-marker-selected`, `bg-map-marker-selected`) with a gold label. Name label truncated at 18 characters. a11y: "{name}, {category}. Selected" or "… Show details", plus `selected` state. The `index % 3` colour alternation and the numbers are gone |
| Unmapped places | no marker; bottom-leading notice "2 places aren't on the map yet", counted from data |
| Attribution | "Locations © OpenStreetMap contributors", caption step |
| Places toggle | "Places" (a11y "Show the place list"), only where Discover is hidden (compact, medium) |
| Insets | `insets` prop: markers lay out inside the map minus overlay panes and the assistant (half the window height when the panel is open, 96dp for the bar). This is the camera-padding contract from the original §3, implemented for the schematic map |

Not built, because each needs the native map: zoom +/−, locate, the warm-dark Mapbox style, camera fly, route line, and the "AR (in testing)" entry. The AR entry stays hidden because no AR handoff is wired on this screen (copy.md says hide it where there's no AR path).

## 4. Responsive layout

`apps/mobile/src/spatial/exploreLayout.ts` (pure, tested), `ExplorePane.tsx`, `apps/mobile/app/(drawer)/(tabs)/explore/_layout.tsx`.

Explore no longer uses `SplitView`. The old layout put the map in the 294dp `supplementary` column and gave the flex region to the detail route (critique C1). Inverting that inside `SplitView` would have meant a new SplitView API on Android plus a divergence from the native iOS `UISplitViewController`. Instead Explore has its own layout, built from the same pieces: size classes from `useWindowSizeClass`, the `TRANSITIONS.paneWidth` tween, and keep-mounted panes. The map always takes the flex region.

| Class (dp) | Discover | Map | Detail (only when selected) | Assistant |
|---|---|---|---|---|
| compact < 600 | full screen via "Places"; "Map" returns | full screen, first | full screen with Back and "Show on map" | sheet across the map |
| medium 600–839 | 320dp drawer over the map via "Places" | full width | 360dp overlay; markers pad right 360 | 400dp panel |
| expanded 840–1199 | tiled 280dp | flex | 360dp overlay | 400dp panel |
| large ≥ 1200 | tiled 320dp | flex (≥ 520) | tiled 360dp, 440dp on quest builds | 400dp panel |
| extraLarge ≥ 1600 | tiled 320dp | flex | tiled 440dp | 400dp panel |

Rules are enforced in tests (`exploreLayout.test.ts`):
- M1: at the narrowest width of every tiled class, the map is the widest pane. On Horizon flat at 1280dp it is exactly 520dp next to a 440dp Detail.
- M3/S5: no selection, no Detail, whatever the placement.
- A promoted pane is zero width and the map takes it; `pending` stays inline.

**Compact unmount bug, fixed.** The old SplitView rendered only the active column when collapsed, so shrinking the main window below 600dp unmounted Discover and its `<SpatialWindow>`. `ExplorePane` keeps every pane mounted at the same tree position in every mode (`tiled`, `overlay`, `screen`, `collapsed`, `promoted`) and changes only its style. Collapsed and promoted panes are `aria-hidden`, `no-hide-descendants` and `pointerEvents="none"`. No new SplitView API was needed.

Not built: the compact Discover bottom sheet with a 120dp peek (`BottomSheet` has no `snapPoints` prop; compact keeps the full-screen pane swap the app already had), and the foldable hinge rules (book, tabletop, multi-fold). The old Explore didn't apply `fold-layout.ts` either; wiring it is the next layout task.

## 5. Place Detail

`packages/app/features/explore/ExplorePlaceDetail.tsx`.

Top to bottom: 2dp gold rail; header with Close (`IconButton size="lg" variant="ghost"`, "Close details") or, on compact, Back ("Back to map"); title (`role="heading"`, heading step, registered as the focus target); "{street}, {category}" in brownstone; lead; actions ("Show on map" on compact only, "Save"/"Saved", all `min-h-target`); "Why it matters" with Newsreader body; Nearby (three closest mapped places with metric distances from `nearbyPlaces` + `formatDistance`, 48dp rows that select that place, hidden when the place has no coordinates); "Where this comes from" (OSM id and the 3 Oct 2026 check, or "Location not verified yet"; "Description written by Harlem Might"; the one-line photo policy).

Removed: the TODAY, MENU + TICKETS, STORY and SOURCES placeholder cards, the media placeholder box, the uppercase labels and `display-md` titles. Unknown ids show "We couldn't find that place." with "Back to Discover". "Walk there" doesn't render because no route provider exists. Save sits in the action row only; the spec also put a Save icon in the header, which would have been the same control twice.

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
| SplitView pane swap, inspector drawer | springs moved to tokens: `motion.spring.pane`, `motion.spring.drawer` |
| Press scale | `PressScale` (native) |
| Reduced motion | `useReducedMotion()` reads `AccessibilityInfo.isReduceMotionEnabled()` once and follows `reduceMotionChanged`. Panes, SplitView springs and `CollapsiblePane` use `transitionFor(reduce, …)`, which returns an instant transition; `PressScale` drops its tap scale |

The Detail content crossfade, marker grow animation and camera fly were not built. The first two would be the only motion on an otherwise still screen; the camera needs the native map.

## 8. Accessibility

| a11y.md finding | Status |
|---|---|
| P1 selected-row contrast | fixed: `selected` token + rail |
| P2 colour-only map selection | fixed: size, label and `selected` state |
| P3 10dp text | fixed in Explore: no `text-[Npx]` or `text-xs`; flat floor is `text-small` (12.25dp), quest builds use the `xr-*` dp steps |
| P4 1.29:1 edges | fixed: `border-border-strong` on chips, rows, toggles |
| P5 numbered fake pins | fixed: named markers at real coordinates; unmapped places have no marker |
| P6/P7 caps labels, placeholder media | removed |
| O1–O3 targets | fixed in Explore: 48dp everywhere, 12dp gaps. Not fixed: `SearchBar`'s clear button is still 24px visual with no hit slop, because it's shared with the web site. Raise it in the kit |
| O4 reduced motion | fixed (§7) |
| O5 focus move and return | built: rows and markers register in `focus-registry.ts`; opening Detail focuses its title; closing returns focus to `returnFocusId` after Detail unmounts. Not run under TalkBack |
| O6 inspector reachable while closed | fixed in `SplitView` (`aria-hidden` + `no-hide-descendants`); Explore no longer uses the inspector |
| O7 zoom buttons | not built (needs the native map) |
| U1 dead buttons, U2 developer copy | removed |
| U3 count live region | fixed |
| R1 chips as tabs | fixed (`Chip`) |
| R2 selected state on rows and markers | fixed |

## 9. Tokens added (`packages/theme/tokens.ts`, regenerated with `node build-css.mjs`)

- Type: `xr-caption` 14/20, `xr-label` 16/22, `xr-body` 18/28, `xr-title` 22/28, `xr-heading` 30/36, `xr-prose` 20/34, all in px so the rem-14 polyfill can't shrink them.
- Spacing: `target` 48px, `target-gap` 12px, `window` 24px, `focus-ring` 3px, `marker` 20px, `marker-selected` 28px.
- Semantic colours: `selected`, `map-marker`, `map-marker-selected`, `route`, `map-canvas`.
- Widths: `pane-discover` 320, `pane-discover-narrow` 280, `pane-detail` 360, `pane-detail-xr` 440, `assistant-bar` 560, `assistant-panel` 400 (px).
- Motion: `duration.camera` 600ms, `spring.pane`, `spring.drawer`.
- Layout: `windowClass` (the SplitView's `WINDOW_SIZE_CLASS_MIN_WIDTH_DP` now reads it), `spatialWindow`, `horizonMainWindow`.

`ExploreTypeContext` picks the scale: `xr` on quest builds, `flat` elsewhere.

## 10. Verified and not verified

Verified on the branch: `pnpm --filter @acme/app test` (134 pass), `pnpm --filter mobile test` (all new tests pass; the one failure is the existing `pane-overrides.test.ts` case, untouched), `pnpm --filter mobile typecheck` (only the 9 known `viro-external-test` errors), `pnpm turbo build typecheck lint --filter='!mobile'` 26/26, `pnpm spatial:verify-android`, and `npx expo export --platform android`. The exported Hermes bundle contains the new copy and none of the removed developer strings.

Not verified: anything on a device. No TalkBack pass, no Quest 3S run, no tablet or foldable run, and no check that a `<SpatialWindow>` inside a zero-width, `aria-hidden` pane promotes the same way it did inside the old `CollapsiblePane` (the old code used the same pattern). Uniwind rendering of the new token classes (`size-target`, `w-assistant-panel`, `bg-selected`) was checked in the bundle build only, not on screen.
