# ADR 0005: The rail is its own window; windows render at the surface origin; Detail stays in the main window

**Status:** Accepted for the code. Device check of the rail window pending (see "Not verified").
**Date:** 2026-10-08
**Deciders:** Mike Allen (repo owner)
**Decision record:** DECISIONS S18. Supersedes the placement part of ADR 0004.

## Context

On a Quest 3S (Horizon OS 207, `ro.vros.build.version` 207, serial `340YC10GC3014S`) the user asked for a visionOS-style arrangement: a navigation rail as its own panel on the left, Discover and the map in the middle, Place Detail as its own panel on the right, about 20dp between panels and none overlapping.

Two blockers stood in the way, both from ADR 0004: buttons inside a promoted window did nothing, and every offset tried put the Detail window over the main one.

## Root cause A: presses inside a promoted window

Read from the shipped code and confirmed for the main-window half on the device. The window half is read from the AAR. No press inside a promoted window was traced on the device (see "Not verified").

1. `@metavr/layout-window-compat` 1.0.0 `SpatialWindow.android.js`: while a window is `spatial` or being placed, its content stays in the main Fabric tree inside a zero-size `offPanel` view (`position: 'absolute'`, no `top`/`left`). So in the main surface the content sits wherever the `<SpatialWindow>` element was declared.
2. `com.meta.metavrx.layout:layout-window-react-compat:1.0.0`, class `SpatialWindowRootViewGroup` (javap): the promoted window's root builds its own `JSTouchDispatcher(this)` and feeds it every touch. `pageX/pageY` are therefore relative to the promoted window.
3. RN 0.88.0-rc.3 `Libraries/Pressability/Pressability.js`: on press-in, `_measureResponderRegion` calls `measure()` and stores `pageX/pageY` from the main surface (L800–829). On every move, `_isTouchWithinResponderRegion` compares the touch against that rectangle (L831–876), and a miss sends `LEAVE_PRESS_RECT` (L510–515), which cancels the press. A controller ray or a pinch always moves between down and up.
4. Device check of the main-window half: with a temporary hook on `Pressability._receiveSignal`, a tap at px (335, 377) on the Apollo row logged `page=(268.0,301.6)` and `region={left:88, top:264, right:448, bottom:339.2}`. That is px ÷ 1.25 (density 200), so main-surface `pageX/pageY` and `measure()` share an origin at the surface's top-left.

**Fix:** `SpatialWindowHost` (`apps/mobile/src/spatial/SpatialWindowHost.tsx`) renders every `<SpatialWindow>` from the app root, in a zero-size view at the main surface's origin. A view at (x, y) inside the window then measures as (x, y) in the main surface, which is what the window's `JSTouchDispatcher` reports. Surfaces ask for a window with `useHostedSpatialWindow(window, content)`. A Zustand store (`spatialWindowHost.store.ts`) carries the request to the host. Hosted windows always use `fallback: 'drop'`, so nothing draws inline at the origin, and the caller renders its own in-window fallback while the placement is not `spatial`. `ExploreWorkspaceWindow` goes through the same host, so the deferred "Open in new window" gets the fix too.

## Root cause B: placement

Measured from `adb shell dumpsys volumetric_window` (window poses and bounds), converted into the main window's local frame. The main window was 1800x1125px at density 200 (1440x900dp), 1.3661 m wide, so 1dp = 0.949 mm. The Detail window was forced on with a temporary workspace override for these trials.

| Trial | anchor (parent → child) | size dp | offset | child centre x (m) | child span x (m) | gap to main (dp) |
|---|---|---|---|---|---|---|
| 1 | end → start | 440x600 | z 1 | 0.6261 | 0.4174 … 0.8348 | −280 |
| 2 | end → start | 300x600 | z 1 | 0.6929 | 0.5506 … 0.8352 | −140 |
| 3 | end → center | 300x600 | z 1 | 0.6830 | 0.5407 … 0.8253 | −150 |
| 4 | end → end | 300x600 | z 1 | 0.5411 | 0.3988 … 0.6834 | −300 |
| 5 | end → center | 300x600 | start −27 (sent as −5), z 1 | 0.6929 | 0.5506 … 0.8352 | −140 |
| 6 | start → end | 300x600 | z 1 | −0.6929 | −0.8352 … −0.5506 | −140 |
| 7 | end → start | 300x400 | z 1 | 0.6929 | 0.5506 … 0.8352 | −140 |
| 8 | end → start | 400x600 | z 1 | 0.6451 | 0.4554 … 0.8348 | −240 |

The main window's edge is at ±0.6830 m. What the numbers show:

- The parent attach point is right. Trial 3 puts the child's centre exactly on the main window's edge.
- Centre and same-side attachment behave as documented (trials 3 and 4).
- **Outward attachment does not.** With `{parent:'end', child:'start'}` or its mirror, the child's far edge lands at 0.152 m (160dp) past the main window's edge in every trial (0.8348–0.8352), whatever the width (300, 400, 440) or height (400, 600). The window grows back toward the main one from there, so the gap is `160 − width` dp. Every window wider than 160dp overlaps.
- Offsets cannot fix it. The native side clamps steps to ±5 (`start: -27` arrived as `TranslationAdjustment { x = -5 }`), and five horizontal steps moved the window 9.9 mm (about 2dp a step). A z step is 7.6 mm. This is why every offset tried before (`{start:-1,z:1}`, `{z:1}`, `{z:0}`, `{start:3,z:0}`) gave the same overlap.
- The SDK sends exactly what it is given. The OS log shows `requestedSurfaceSize = 375x500` (the correct size) and `attachFrom = 19, attachTo = 21` (LEFT|CENTER_VERTICAL to RIGHT|CENTER_VERTICAL) for trial 7. The 160dp rule is inside Horizon OS, not in our code or the JS SDK.
- Vertical placement is exact: every child's centre was at y = 0.0000 in the main window's frame.
- The main window renders as a `landscape_cylinder` (`PanelRenderLayer: ResetSurface #main 1800 x 1125 - shape:landscape_cylinder`) and child windows as `flat`. The table measures centre poses only; the curvature's effect on the visible gap was not measured.

The platform has a builder method that would allow an exact offset (`VolumetricWindowLayoutParams.Builder.setPixelTranslationOverride(Point)`, in the device's `hzos-framework.jar`). The JS SDK does not expose it. Setting it from the app would mean reaching into the SDK's private window registry by reflection, which this ADR rules out.

## Decision

- **Rail:** the tab bar becomes its own window on quest builds (`AppTabBarHost`, `RAIL_WINDOW` in `apps/mobile/src/spatial/railWindow.ts`). It is 140x356dp: 140 from the new `rail-window-xr` token, chosen so that 160 − 140 = 20dp of gap; 356 = five 60dp items (`target-primary`), four 8dp gaps (`xr-inline`) and 12dp padding (`xr-stack`). Anchor `{parent:'start', child:'end'}`, no offset (same depth as the main window), vertically centred, priority 20, `fallback: 'drop'`. Icons are 26dp and labels use `xr-caption` (14/20), with the gold leading marker for the current tab.
- **Fallback:** while the rail window is `pending` or `dropped`, and on PICO, phones, tablets and web, the existing in-window rail or bottom bar draws as before.
- **Middle:** Discover and the map stay in the main window, as in S17. The main window gains the 88dp the in-window rail used to take.
- **Detail:** stays the S17 trailing column in the main window. A 400dp window would overlap the main one by 240dp. `PLACE_DETAIL_WINDOW` stays deferred with the measured reason in its doc comment. This is the reverse of the brief's fallback ("rail in-window, right panel separate"): on this OS the rail is the only panel narrow enough to be separate.
- `outwardWindowGapDp(widthDp)` and `OUTWARD_FAR_EDGE_DP` encode the measured rule, with tests for the 20dp rail gap and the measured overlaps.

## Not verified

- **Presses inside a promoted window.** The fix follows from the code above, but no press inside a promoted window was traced on the device. `adb shell input` cannot reach it: the window's input surface is `Embedded{SurfaceControlViewHost}` with `globalScale=0.000000`, stacked under the main window. An in-app input harness was not built. Someone wearing the headset has to tap the rail's tabs with a controller and with a hand.
- **The rail window's gap and depth.** The 160dp rule was measured with `z: 1` (`OffsetNear`). The rail uses no offset. After the trials the headset went to sleep and came back on the camera and microphone sensor lock ("Press the power button to enable cameras and microphones"), which needs the physical button, so the rail window has not been placed on the device yet. The first run must confirm the gap with the measurement script below and a capture.
- **Screenshots.** Both `adb exec-out screencap` (right-eye crop) and the system screenshot service returned near-black passthrough with no panels during this session, while `dumpsys volumetric_window` reported every window drawn and visible. The headset was most likely resting face-down or in the dark. No screenshot evidence is attached. The geometry table comes from `dumpsys`.

## How to check on the headset

1. Put the headset on (or press the power button to clear the sensor lock), then run `pnpm --filter mobile quest --install --serial 340YC10GC3014S`.
2. Measure: run `adb shell dumpsys volumetric_window`, take the main window (1800x1125) and the rail window (175x445 px at density 200), and express the rail's pose in the main window's frame. The rail's inner edge should sit 20dp (19 mm) left of the main window's left edge, at y = 0 and the same z.
3. Tap Explore, Walks, Stories, Today and More in the rail with a controller ray and with a pinch. Each should switch the main window's tab.

## Consequences

- One spatial slot is used (the rail). The second stays free.
- Any future window goes through `useHostedSpatialWindow`. A `<SpatialWindow>` rendered anywhere else repeats root cause A.
- If Meta fixes outward attachment or exposes an exact offset, `outwardWindowGapDp` is the one place to change, and Detail can become a window again.
