# ADR 0006: Place Detail opens as a second Activity panel; More is struck on Horizon

**Status:** Accepted for the code. Placement measured on the device; controller and hand taps not verified (see "Not verified").
**Date:** 2026-10-08
**Deciders:** Mike Allen (repo owner)
**Decision record:** DECISIONS S20. Supersedes the "Detail" bullet of ADR 0005; the S17 column stays as the fallback.

## Context

On a Quest 3S (Horizon OS 207, serial `340YC10GC3014S`) the user said: "the More tab doesn't make sense on spatial, you're just going to open it in the main window! the map needs to open details in a right spatial window".

ADR 0005 kept Detail in the main window because a Layout SDK window attached outward overlapped the main one in every trial. S20 set the order of approaches: public APIs first, the private `setPixelTranslationOverride` only with the user's OK.

## Decision

### More

`HORIZON_STRUCK_TABS` in `apps/mobile/src/site/tabVisibility.ts` strikes More when `isHorizonBuild`, dated 2026-10-08 with its condition. `AppTabBar` filters through `isTabShown`, so the rail window and the in-window fallback rail both draw Explore, Walks, Stories and Today. The `(more)` routes stay registered, so `/more` and `/ar` still resolve. The rail window is now 140x288dp (four 60dp items); `RAIL_WINDOW_DP` reads the count from `HORIZON_TAB_COUNT`.

### Detail: a second Activity panel (option a)

Meta documents a multi-panel launch with no extra SDK: a second activity started with `FLAG_ACTIVITY_LAUNCH_ADJACENT | FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_MULTIPLE_TASK`, sized by its own `<layout android:defaultWidth/defaultHeight>` ([panel sizing](https://developers.meta.com/horizon/documentation/android-apps/panel-sizing/): "Multi-panel activity on Meta Horizon OS allows multiple activities to run simultaneously in separate panels, without integrating any other SDK"; [features overview](https://developers.meta.com/horizon/documentation/android-apps/features-overview/)). The [hybrid apps page](https://developers.meta.com/horizon/documentation/spatial-sdk/hybrid-apps-overview/) says the activity "will be launched next to the actively running activity". None of these pages lets the app pick the side, the gap or the depth.

- `apps/mobile/modules/spatial-panels` (local Expo module, Kotlin): `spatialPanels.openPanel(name, props?)`, `closePanel(name)`, `addOnPanelOpenedListener`, `addOnPanelClosedListener` (`reason: 'app' | 'user'`) and `isAvailable`.
- `SpatialPanelActivity` hosts a `ReactSurface` from the app's one `ReactHost` (`ReactHost.createSurface(context, moduleName, initialProps)`), so the panel shares the JS runtime and the Zustand stores. It is deliberately not a `ReactActivity`. RN 0.88's `ReactHostImpl` tracks one current activity. It asserts in `onHostPause` when another activity pauses (`skipActivityIdentityAssertionOnHostPause` defaults to false), and `onHostDestroy` of the current activity moves the whole context to host-destroyed. The panel never reports host lifecycle, so the main window stays the ReactHost's activity.
- The config plugin (`modules/spatial-panels/app.plugin.js`) writes the activity, with `<layout android:defaultWidth="400dp" android:defaultHeight="600dp">`, its own `taskAffinity`, `exported=false` and `excludeFromRecents`, into `app/src/quest/AndroidManifest.xml` only. It is a finalized mod because expo-horizon-core rewrites that file from scratch in a dangerous mod. `isAvailable` is false on mobile and PICO, where the activity is not declared. `spatial:verify-android` checks the quest entries and fails if the activity appears in the main or PICO manifest.
- `index.ts` (the new `main`) imports `expo-router/entry` and registers `PlaceDetailPanel` with `AppRegistry`.
- `usePlaceDetailPanel` (Explore layout) opens the panel when a place is selected from the map or the list and closes it when the selection clears. While the panel is opening or open, Detail's placement is `spatial`, so the main window drops its column and the map takes the width. A launch that throws gives `failed`, and the S17 column shows Detail in the main window. Closing the panel itself (its Close button, Back, the OS) clears the selection.
- solito inside the panel: a second surface sits outside expo-router's NavigationContainer, and solito's `Link`/`useRouter` read three contexts there (`useLinkTo` middleware, `NavigationContainerRefContext`, `LinkingContext`). The first device run failed with `Couldn't find a LinkingContext context` from `MightsButton href`. `MainRouteRelay` (root layout) now publishes the main navigator's container ref and linking options, and `PanelNavigationProvider` provides them plus a `useLinkTo` that queues the route for the main window, where solito performs it. `ViewInArButton` therefore runs unchanged in the panel.

### Option b, measured: Layout SDK window, no offset

The trial put Detail into a `SpatialWindow` 400x600dp, `{parent:'end', child:'start'}`, with no offset (uncommitted, reverted). The OS log shows `requestedSurfaceSize = 500x750, attachFrom = 19, attachTo = 21, translationAdjustment = {0,0,0}`. Measured in the main window's frame: span 0.9884…1.8121 m against the main edge at 1.4826 m, a **240dp overlap**, the same as ADR 0005's trial 8. Rejected.

The rail window corrects ADR 0005 in one respect. With no offset it sits **flush** with the main window: gap −0.4dp, measured twice, at 175x360px. ADR 0005's "160dp far-edge" rule held only for its trials, which all used `z: 1`. The 140dp width does not produce a 20dp gap. `OUTWARD_FAR_EDGE_DP` and its tests still encode the old rule and need a follow-up once someone measures the offset dependence.

### Option c

Not needed. Option a places the panel clear of the main window with public APIs only. `setPixelTranslationOverride` was not touched.

## Measurements (option a)

`adb shell dumpsys volumetric_window`, converted into the main window's frame (`scratchpad/spatial/panelgap.py`). Main window 1800x1125px = 1440x900dp, 2.9651 m wide (1dp = 2.059 mm at that distance).

| Run | Panel | Side | Centre y | Inner edge → main right edge | Depth at inner edge | Yaw vs main |
|---|---|---|---|---|---|---|
| 1 (15:55) | 500x750px, 0.8236x1.2355 m = 400x600dp | right | 0.0000 | 0.327 m = **158.8dp** (x 156.3dp) | 28.3dp toward the user | −45° |
| 2 (15:58) | same | right | 0.0000 | 158.8dp | 28.3dp | −45° |
| 3 (16:02) | same | right | −0.0000 | 158.8dp | 28.3dp | −45° |

vrshell logs `placementType: slot` for the panel. The OS puts it in the slot to the right of the app's panel, turned 45° toward the user, vertically centred, at the main window's scale. That is not the requested 20dp at the same depth: the gap is 159dp and the panel angles in. No public API changes the slot. Later runs gave very different numbers (540dp, 716dp) after the main window itself re-placed while the headset was off the user's head (main yaw −132.7°, 3.84 m and 4.23 m wide). Those runs are recorded but not used.

## Tap and flow results (adb input on the panel's surface, not controller or hand)

- Selecting Apollo from the Discover list opened the panel (`Running "PlaceDetailPanel"`, one `SpatialPanelActivity` task). uiautomator on the panel: `Details: Apollo Theater`, Close, Get directions, Open place page, View on a table, Stand on the street, each with its own bounds inside 500x750.
- Selecting Apollo from its map marker opened it too (rootTag 51).
- Selecting Schomburg Center by deep link while the panel was open updated it in place: `Details: Schomburg Center`, still one panel task.
- Close in the panel (`input tap 408 47`) closed the panel: only `MainActivity` remained.
- "View on a table" in the panel started `VRActivity` (immersive), so the route went from the panel through the relay to the main window's solito router.
- Back with the main window in front did not close the panel. Input focus was `null` (`mCurrentFocus=null`) with the headset off, so the key went nowhere. Not a verdict on the Back path.
- Get directions and Open place page were not tapped (they leave the app for the browser).

## Not verified

- **Controller ray and hand pinch.** Every tap above was `adb shell input` on display 0. Someone wearing the headset must press each panel button with a controller and with a pinch.
- **Screenshots.** Right-eye `screencap` was dark passthrough with no panels in every run while the headset was off the user's head. It started working once the user put it on, but that capture showed the main window with a red Metro error from another agent's in-progress `nitro-mapbox-ar` change (`Unable to resolve module earcut from .../reactvision/src/buildings.ts`), so the panel did not open in that run. No screenshot of the panel exists yet.
- **The requested geometry.** 20dp at the same depth is not met: the OS slot puts the panel 159dp out, angled 45°. The only known way to set an exact offset is still the private `setPixelTranslationOverride`, which S20 leaves to the user.

## Consequences

- The Layout SDK keeps one window, the rail. Detail no longer uses a Layout SDK slot.
- Any future panel goes through `spatialPanels.openPanel`, registers in `index.ts`, and wraps its tree in `PanelNavigationProvider` if it uses solito.
- The panel is a separate Android task. The user can move it and close it from the system bar; both end in the `user` close event.
