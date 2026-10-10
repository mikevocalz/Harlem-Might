# ADR 0007: Native Mapbox map on phones and foldables

**Status:** Accepted. On Android both Mapbox modules build and the app's Kotlin/Java compiles for the mobile and quest flavors; a full APK is blocked by an unrelated `react-native-audio-api` nightly on `main`. Nothing has run on a device or the iPhone Duo. iOS waits on the nitro-mapbox-ar SPM link fix.
**Date:** 2026-10-10
**Deciders:** Mike Allen (repo owner)

## Context

DECISIONS S16 deferred the native street map until two things existed: the D2 style and a Mapbox map SDK that runs in a Horizon OS window. Until then Explore drew a schematic (`ExploreSchematicMap`, formerly inline in `ExploreMapPane`) with a caption saying so. `docs/NAVIGATION_PLATFORM_MATRIX.md` D-2 recorded what blocked it: the map view package was not a dependency, the linked core had autolinking off, and the view had no line layer, GeoJSON source or puck.

Mike's rule for every app with a map is that mobile gets a real interactive Mapbox map. A schematic or a static image is not the deliverable.

Since S16:

- `~/nitro-mapbox-ar` (`mikevocalz/nitro-mapbox-ar`) has `packages/native-mapbox`, published as `@mikevocalz/nitro-mapbox-ar-maps`: a Nitro hybrid view on Mapbox Maps SDK 11.32.0 with GeoJSON sources, style layers, `setStandardConfig`, `fitBounds`/`flyTo`, tap and rendered-feature queries. PR #41 adds `showUserLocation`, `puckBearing`, `addStyleImage` and `StandardStyleConfig.theme`.
- Nobody has confirmed the Mapbox Maps SDK on Horizon OS or PICO. That part of S16 is still open.

## Decision

S16 is settled for phones and foldables, and stays open for the headset.

1. **Phone and foldable flavors draw the native Mapbox map.** `packages/app/features/explore/ExploreMap.native.tsx` mounts `MapboxMapView` with Mapbox Standard, `faded` theme, `day` light, 3D objects on and POI labels off, the same config as the site's GL JS map (ADR 0003). Places are a GeoJSON source drawn as gold circle and symbol layers; the selected place grows, gets a ring in the text colour and always shows its name. The route preview, alternatives and walked part are line layers under the places. A tap queries the place layers in a 44pt box and opens the place through the existing `onSelectPlace`. The camera fits the catalogue with the web map's `FIT_PADDING` (96) and `FIT_MAX_ZOOM` (15.5) inside the pane insets, flies to a selection at zoom 16.5 or closer, and frames a new route preview.
2. **The headset keeps the schematic.** The quest build (`isHorizonBuild`) never registers the map, so Explore there renders `ExploreSchematicMap`, unchanged. The headset question goes back to S16 and reopens when a Horizon-compatible Mapbox SDK exists. PICO is commented out of `app.config.ts` and inherits the same rule when it comes back.
3. **`packages/app` never imports the library.** The library is a sibling checkout linked only into `apps/mobile`, and CI has no copy of it. `packages/app/features/explore/native-map-module.ts` types the slice Explore uses; `apps/mobile/src/map/registerNativeMap.ts` registers the real module at startup when the build links the `MapboxMapView` and `MapboxAR` hybrid objects (`NitroModules.hasHybridObject`), is not the quest build, and has a public `pk.` token in `EXPO_PUBLIC_MAPBOX_TOKEN`. Without a registration, or after a map loading error, Explore shows the schematic, and the error case gets a "Load street map" retry.
4. **Location is the app's job.** "My location" is off until the person turns it on. Android asks for `ACCESS_FINE_LOCATION` through `PermissionsAndroid`, and the permissions are declared in the mobile flavor manifest only (`apps/mobile/plugins/with-mobile-location-permission.js`). iOS has `NSLocationWhenInUseUsageDescription` in `app.config.ts`, and the Maps SDK shows the system prompt the first time the puck turns on. A refusal leaves the puck off and says how to turn location on in Settings. The button only appears when `MapboxMaps.capabilities.supportsLocationPuck` is true.
5. **Attribution.** The Maps SDK draws the Mapbox logo and the attribution button. The pane's captions move 40dp up while the native map is live so they never cover either, and the trailing caption reads "© Mapbox © OpenStreetMap contributors".
6. **Linking.** `apps/mobile/package.json` links the core as `@mikevocalz/nitro-mapbox-ar` (its real name; the old `@mapbox/react-native-mapbox-ar` alias is gone, because the maps package's Android module depends on `project(":mikevocalz_nitro-mapbox-ar")`) and the view as `@mikevocalz/nitro-mapbox-ar-maps`, both `link:` to `../../../nitro-mapbox-ar`. Both autolink on iOS and Android. Android needs `MAPBOX_DOWNLOADS_TOKEN` in the Gradle environment; it is never committed.

## Consequences

- **The quest APK carries the Mapbox SDK.** React Native autolinking adds a library to every product flavor, so `questDebug` links the core and the maps package even though JS never mounts the view there. Scoping it to the mobile flavor needs a hand-written `PackageList` per flavor, which is not worth it while the headset question is open. The arm64 native libraries it adds, measured from the debug AARs (uncompressed, symbols included): Mapbox `android-core-ndk27` 11.32.0 18.2 MB, `common-ndk27` 24.32.0 7.9 MB, the maps package 7.3 MB, the core 1.8 MB. Release builds strip symbols, so the shipped quest APK grows by less than these 35 MB.
- **The map depends on PR #41.** Until nitro-mapbox-ar #41 merges into the checkout, the `theme` field of the Standard config and the puck props do nothing on the native side; the map still draws with Standard's default colours. The library is not on npm (Mike, 2026-10-09).
- **Screen readers.** The native map's circles are not accessibility elements. The map view has a label pointing to the place list, where every mapped place is a row, the same arrangement as the site's canvas dots.
- **Walked part only, no follow camera.** Mobile still has no location source (D-1), so guidance cannot follow the person; the walked part draws only once fixes arrive.
- **Not verified:** any run on an Android phone, a foldable or the iPhone Duo, the iOS build, and taps on the native markers.
