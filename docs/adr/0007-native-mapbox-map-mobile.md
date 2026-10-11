# ADR 0007: Native Mapbox map on phones, foldables and Quest

**Status:** Accepted; Quest registration enabled at Mike’s request on 2026-10-10. The Quest APK built successfully and was installed in place on the Quest 3S. Its merged manifest retains the 1440dp × 900dp main window, default orientation and 400dp × 600dp detail window. The Quest runtime reported map ready with no error; a headset capture showed native streets and catalogue markers. Camera pitch 64° and bearing −18° were read from the SDK. Selected-place 3D-building appearance still needs a headset check; tracking was lost and the device disconnected. The initially installed APK lacked the native Mapbox and NitroFetch modules; a JavaScript reload alone could not enable the map.
**Date:** 2026-10-10
**Deciders:** Mike Allen (repo owner)

## Context

DECISIONS S16 deferred the native street map until two things existed: the D2 style and a Mapbox map SDK that runs in a Horizon OS window. Until then Explore drew a schematic (`ExploreSchematicMap`, formerly inline in `ExploreMapPane`) with a caption saying so. `docs/NAVIGATION_PLATFORM_MATRIX.md` D-2 recorded what blocked it: the map view package was not a dependency, the linked core had autolinking off, and the view had no line layer, GeoJSON source or puck.

Mike's rule for every app with a map is that mobile gets a real interactive Mapbox map. A schematic or a static image is not the deliverable.

Since S16:

- `~/nitro-mapbox-ar` (`mikevocalz/nitro-mapbox-ar`) has `packages/native-mapbox`, published as `@mikevocalz/nitro-mapbox-ar-maps`: a Nitro hybrid view on Mapbox Maps SDK 11.32.0 with GeoJSON sources, style layers, `setStandardConfig`, `fitBounds`/`flyTo`, tap and rendered-feature queries. PR #41 adds `showUserLocation`, `puckBearing`, `addStyleImage` and `StandardStyleConfig.theme`.
- Mike requested the same full 3D map in the Quest window on 2026-10-10. Registration now follows native module availability and the public token instead of excluding the Quest flavor. PICO is not verified.

## Decision

The same native map implementation is selected on phones, foldables and Quest. Hardware evidence is tracked separately from implementation.

1. **Phone, foldable and Quest flavors draw the native Mapbox map.** `packages/app/features/explore/ExploreMap.native.tsx` mounts `MapboxMapView` with Mapbox Standard, `faded` theme, `day` light, 3D objects on and POI labels off, the same config as the site's GL JS map (ADR 0003). Places are a GeoJSON source drawn as gold circle and symbol layers; the selected place grows, gets a ring in the text colour and always shows its name. The route preview, alternatives and walked part are line layers under the places. A tap queries the place layers in a 44pt box and opens the place through the existing `onSelectPlace`. The camera fits the catalogue with the web map's `FIT_PADDING` (96) and `FIT_MAX_ZOOM` (15.5) inside the pane insets, flies to a selection at zoom 16.5 or closer, and frames a new route preview.
2. **Quest uses the same 3D map in its Horizon window.** The Quest-only early return in `registerExploreNativeMap` is removed. Standard styling, 3D buildings, camera pitch, markers and route layers come from the same component as mobile. The established `orientation: default`, 1440dp × 900dp main window and 400dp × 600dp secondary windows are unchanged. The phone location-puck action remains disabled on Quest because that flavor does not declare phone location permissions. PICO remains unverified.
3. **`packages/app` never imports the library.** The library is a sibling checkout linked only into `apps/mobile`, and CI has no copy of it. `packages/app/features/explore/native-map-module.ts` types the slice Explore uses; `apps/mobile/src/map/registerNativeMap.ts` registers the real module at startup when the build links the `MapboxMapView` and `MapboxAR` hybrid objects (`NitroModules.hasHybridObject`), and has a public `pk.` token in `EXPO_PUBLIC_MAPBOX_TOKEN`. Without a registration, or after a map loading error, Explore shows the schematic, and the error case gets a "Load street map" retry.
4. **Location is the app's job.** "My location" is off until the person turns it on. Android asks for `ACCESS_FINE_LOCATION` through `PermissionsAndroid`, and the permissions are declared in the mobile flavor manifest only (`apps/mobile/plugins/with-mobile-location-permission.js`). iOS has `NSLocationWhenInUseUsageDescription` in `app.config.ts`, and the Maps SDK shows the system prompt the first time the puck turns on. A refusal leaves the puck off and says how to turn location on in Settings. The button only appears off Quest when `MapboxMaps.capabilities.supportsLocationPuck` is true.
5. **Attribution.** The Maps SDK draws the Mapbox logo and the attribution button. The pane's captions move 40dp up while the native map is live so they never cover either, and the trailing caption reads "© Mapbox © OpenStreetMap contributors".
6. **Linking.** `apps/mobile/package.json` links the core as `@mikevocalz/nitro-mapbox-ar` (its real name; the old `@mapbox/react-native-mapbox-ar` alias is gone, because the maps package's Android module depends on `project(":mikevocalz_nitro-mapbox-ar")`) and the view as `@mikevocalz/nitro-mapbox-ar-maps`, both `link:` to `../../../nitro-mapbox-ar`. Both autolink on iOS and Android. Android needs `MAPBOX_DOWNLOADS_TOKEN` in the Gradle environment; it is never committed.

## Consequences

- **The quest APK carries the Mapbox SDK.** React Native autolinking adds a library to every product flavor, so `questDebug` links the core and the maps package and JS now mounts the view there when the token and native modules are available. The arm64 native libraries it adds, measured from the debug AARs (uncompressed, symbols included): Mapbox `android-core-ndk27` 11.32.0 18.2 MB, `common-ndk27` 24.32.0 7.9 MB, the maps package 7.3 MB, the core 1.8 MB. Release builds strip symbols, so the shipped quest APK grows by less than these 35 MB.
- **The map depends on PR #41.** Until nitro-mapbox-ar #41 merges into the checkout, the `theme` field of the Standard config and the puck props do nothing on the native side; the map still draws with Standard's default colours. The library is not on npm (Mike, 2026-10-09).
- **Screen readers.** The native map's circles are not accessibility elements. The map view has a label pointing to the place list, where every mapped place is a row, the same arrangement as the site's canvas dots.
- **Walked part only, no follow camera.** Mobile still has no location source (D-1), so guidance cannot follow the person; the walked part draws only once fixes arrive.
- **Not verified:** any run on an Android phone, a foldable or the iPhone Duo, the iOS build, and taps on the native markers.
