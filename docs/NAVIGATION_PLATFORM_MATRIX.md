# Navigation platform matrix

What the map half of navigation (Phase 2) does on each platform, and how
far each claim has been checked. The domain (routing, matching, rerouting,
arrival) is the same code everywhere and is covered by
`pnpm --filter @acme/app test`.

The three evidence columns mean different things:

- **Implemented**: the code exists on this branch.
- **Tested**: a unit test drives it (`node --test`, no React rendering).
- **Verified**: someone looked at it running. The method is named. "No" means
  nobody has.

## Matrix

| Capability | Web (Next 16, Mapbox GL JS) | Phone (Expo, native Mapbox map, ADR 0007) | Tablet / foldable | Quest / PICO (Horizon window, schematic map) |
|---|---|---|---|---|
| Directions entry from Place Detail | Implemented. Verified: Playwright, 390/768/1280 | Implemented. Not verified on a device | Implemented (Detail column). Not verified | Implemented (Detail window, 60 dp primary). Not verified |
| Directions panel, six states + handoff | Implemented, tested. Verified: default, success, transit, offline at 3 widths | Implemented, tested (view model). Not verified on a device | Same component | Same component, `xr` type scale |
| Origin: device location | W3C Geolocation, contextual prompt. Tested with a fake `navigator.geolocation`. Verified with Playwright's emulated position | **None.** No location module in the build (DEFER D-1). The panel says so and opens "Start from a place" | Same as phone | No GPS on headsets. "Start from a place", labelled as chosen. Companion phone not built |
| Origin: chosen place | Implemented, tested | Implemented, tested | Implemented | Implemented |
| Route on the map | GeoJSON line layers from the session's geometry, alternatives muted, walked part dimmed. Verified: Playwright screenshots | Real geometry on the **schematic** map (react-native-svg), shared fit with the markers. Not verified on a device | Same as phone | Same as phone |
| Redraw on reroute (`generation`) | Implemented (keyed on route id + generation). Not exercised in a browser | Implemented (same key). Not verified | Same | Same |
| Puck from `navigationFixStore` | Implemented. Verified: Playwright emulated walk | Implemented, but there are no device fixes (D-1), so it never shows | Same | Never shows (no fixes) |
| Camera follow / Recenter | Implemented. Follow verified by screenshot; drag-to-stop not exercised | N/A: the schematic has no camera | N/A | N/A |
| HUD: maneuver, distance to turn, street, remaining, ETA | Implemented, tested. Verified: Playwright at 3 widths | Implemented. Not verified on a device | Steps stay in the Detail column; no Steps button | Same as tablet |
| Rerouting state | Implemented, tested (view model). Not seen live | Same | Same | Same |
| Safety notices (speed, awareness, positioning) | Implemented, tested. Awareness verified in screenshots | Implemented, tested | Same | Same |
| Arrival (confirmed / estimated) | Implemented, tested. Not seen live | Implemented, tested; needs fixes, so unreachable until D-1 | Same | Unreachable (no fixes) |
| Pause / Resume / End | Implemented. End and Steps verified in Playwright; Pause not clicked | Implemented. Not verified | Same | Same |
| Transit | External handoff (Apple Maps, Google Maps), never a drawn line. Tested; verified in screenshots | Same, tested | Same | Same |
| Offline | `navigator.onLine` + network failure. Tested; verified with Playwright `setOffline` | Network failure only (no NetInfo in the build). Tested | Same | Same |
| View in AR | No AR on the web; no button | Slot exists (`arAction`); nothing passed (D-3) | Same | Quest's existing "View on a table" stays in Place Detail; not in the directions panel (D-3) |
| Foreground only | `AppState` (visibility) stops the watch | Same hook; no watch to stop today | Same | Same |
| Camera permission | Never requested | Not requested by the map | Not requested | Not requested |

Unit tests: `features/navigation/view/view.test.ts` (37) and
`features/navigation/view/runtime.test.ts` (8), plus the shared-fit change in
`features/explore/schematic-map.test.ts`.

Web screenshots were taken from a production build of this branch, run
locally with a public Mapbox token supplied at build time and Playwright's
bundled Chromium. Positions were emulated: the walk replayed the recorded
Apollo Theater → Sylvia's route geometry, about one fix every 350 ms. That
shows the UI, not real GPS behaviour. No phone, tablet, foldable or headset
was run for this phase.

## Deferrals

| ID | What | Blocker | Unblocks when |
|---|---|---|---|
| D-1 | Device location on mobile | `expo-location` is not a dependency of `apps/mobile`. Adding it changes the lockfile, needs permission strings in `app.config.ts` per flavor, and needs a native rebuild of every flavor | Add `expo-location`, write a `LocationSource` next to `createBrowserLocationSource` (`watchPositionAsync` + `watchHeadingAsync` feeding `ingestFix` / `ingestHeading`), pass it to `useNavigationHost` in the Explore layout |
| D-2 | Native street map on mobile | **Resolved for phone and foldable (ADR 0007, 2026-10-10).** `ExploreMap.native.tsx` draws `MapboxMapView` from `@mikevocalz/nitro-mapbox-ar-maps` (linked sibling checkout, autolinked) with the places, route line and an opt-in location puck. Still deferred for Quest / PICO: no Mapbox SDK is confirmed on Horizon OS, so the headset keeps the schematic (DECISIONS S16, headset only). Not run on a device yet | Headset: a Horizon-compatible Mapbox SDK exists and S16 is reopened. Phone: an iOS build after the nitro-mapbox-ar SPM link fix, and a run on the iPhone Duo and an Android phone |
| D-3 | AR entry in the directions panel | The phone AR view is Phase 3. The Quest "View on a table" button (`src/ar/ViewInArButton.tsx`) fetches its own walking route through `useTabletopRoute`, which breaks "same session, never refetch". `src/ar/**` is outside this phase | Phase 3 reads `useNavigationStore` in the AR scene and passes its button through `DirectionsPanel`'s `arAction` |
| D-4 | Kinetrell in shared components | Kinetrell is a web-only dependency today (site motion) and has no sheet or card presets. Its native entry targets Reanimated 4.7 / Worklets 0.13, which has not been checked against this app | A Kinetrell preset for the HUD card and the arrival card, after a native compatibility check. Until then Legend Motion + `transitionFor` (reduced motion respected) |
| D-5 | Rive states | No suitable `.riv` exists (the only one is a quiz demo) | Assets `nav-gps-acquiring`, `nav-rerouting`, `nav-arrival` |
| D-6 | Entrances | The catalogue has no entrance records, so every route ends at the OSM point and the panel says "No entrance on record" | Payload Places entrance fields are filled and read by Explore |
| D-7 | Storybook | Storybook's globs cover `packages/ui` only; `packages/ui/mights` and `packages/app` have no stories | A glob for the navigation components and fixture-backed stories (the recorded routes import as JSON) |

## Mapbox guidance checked

The official Mapbox agent skills (navigation, web integration, web
performance, cartography, search, token security) were read against this
work.

- **Followed:** route layers above basemap POIs; alternatives muted under the
  chosen route; one map instance per mount with `map.remove()` on teardown
  and the route layers detached with it; `setData` instead of re-adding
  layers; public `pk.` token only, from the environment; the route frames
  inside the visible part of the map.
- **Differs, on purpose:** the route colour is gold, not the skills' default
  blue, to match the AR guidance colour. The skills suggest a client-side
  route cache. The domain re-requests only when mode or origin changes,
  cancels superseded requests and limits reroutes, so no cache was added.
- **Differs, by constraint:** the skills recommend the Mapbox Navigation SDK
  for native turn-by-turn. This app routes with the Directions API through
  its own provider-neutral domain on every platform, and the native map is
  deferred (D-2), so the Navigation SDK is not in play.
- **Open:** URL restrictions on the public token are an account setting and
  were not checked. The web map's Mapbox error handler only reports WebGL
  failures; a token or style failure still shows a blank map. That predates
  this phase.
