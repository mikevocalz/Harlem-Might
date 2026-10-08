# ADR 0004: Place Detail lives in the main window; the Detail window is deferred

**Status:** Accepted
**Date:** 2026-10-08
**Deciders:** Mike Allen (repo owner)
**Decision record:** DECISIONS S17 (supersedes S12's Detail window)

## Context

Since S12, Place Detail asked for its own Horizon window: 440x600dp, anchored to the main window's end edge. On a Quest 3S (Horizon OS 207) two things went wrong.

1. **It covered the map.** Four different offsets all landed the window over the main window. Meta's Layout SDK docs say anchors and offsets "do not guarantee exact physical positions, automatic collision avoidance, or identical layouts" between the simulator and a device, and Layout SDK windows are opaque, so any overlap hides the map. The user's verdict: "the panel should never cover the center/main".
2. **Its buttons did nothing.** Close and Get directions did not fire inside the promoted window.

Meta's multi-window guidance, Apple's visionOS HIG (split views before new windows) and Android's list-detail layout all put supplementary detail in a split inside one window. The research is in the scratchpad's `SPATIAL_UI_RESEARCH.md`.

## Decision

- The Quest main window is 1440x900dp (`expo-horizon-core` `defaultWidth`/`defaultHeight` in `apps/mobile/app.config.ts`; orientation stays `default`). 1440 is Meta's documented maximum panel width.
- Explore draws three columns in that one window: Discover 360 | map (flex) | Detail 400. Detail slides in from the trailing edge and the map narrows; nothing is drawn over the map. Under reduced motion the width change snaps.
- The breakpoints come from the window's width, which the user can resize: from 1200dp Discover is a column, as long as the map keeps 600dp; 840–1199dp Discover sits behind "Places" and Detail stays a column; below 840dp one pane shows at a time. Between 1200 and 1359dp a selection would push the map under 600dp, so Discover folds behind "Places" there too. That band follows the map's minimum, not the bare 1200 breakpoint.
- `EXPLORE_WORKSPACE` declares Place Detail as a `layer` in the trailing region and sets `maxPromotedSurfaces: 0`. No surface asks for a window.
- **DEFER** the Detail window. `PLACE_DETAIL_WINDOW` and `PLACE_DETAIL_OFFSET` stay in `apps/mobile/src/spatial/exploreWorkspace.ts`, with a test proving they still resolve to the S12 window props. The `promoted` pane mode stays in `exploreLayout.ts`. It returns only as an explicit "Open in new window" command, after the blocker below is fixed and a 3S capture shows the window clear of the main window.
- **Keep** `metaWindows.SceneProvider` (`app/_layout.tsx`), `ExploreWorkspaceWindow` and `modules/spatial-window-owners`. They are not dead: they are still on Detail's render path and pass content through unchanged while every surface resolves inline. The provider creates no window by itself. Removing them would mean proving the provider, the Compose view-tree owners and the `useSpatialWindowState` wiring again when the opt-in returns.

## Why the Detail window's buttons failed

Root cause, read from the sources below. Not yet confirmed with a touch trace on the device.

- `node_modules/@metavr/layout-window-compat/SpatialWindow.android.js` (1.0.0): when a window is `spatial`, the content stays in the React tree under a zero-size, absolutely positioned `offPanel` view inside the main surface, and the native side (`metavrx/layout/window/react/SpatialWindowRootViewGroup` in `com.meta.metavrx.layout:layout-window-react-compat:1.0.0`) draws it in the promoted window and forwards its touches. Those touches carry `pageX/pageY` relative to the promoted window.
- `react-native/Libraries/Pressability/Pressability.js`: on press-in, `_measureResponderRegion()` calls `measure()` on the responder, which reports the view's position in the main surface (inside the zero-size `offPanel`). On every move, `_isTouchWithinResponderRegion(touch, responderRegion)` compares the touch's window-relative `pageX/pageY` against that main-surface rectangle. They do not overlap, so the first move sends `LEAVE_PRESS_RECT` and the press is cancelled before `onPress`.

A controller ray or a hand always produces some move between down and up, so on a headset almost every press is cancelled.

The fix belongs in Meta's SDK (report window-relative coordinates consistently on both sides, or measure in the promoted window's space), not in the app. An app-side workaround would mean replacing Pressability for every control inside the window.

## Consequences

- The map is at least 600dp wide whenever Discover is a permanent column, 1080dp with nothing selected at the default size, 680dp with a place selected, and never covered.
- Detail no longer gets its own size or position. Comparing two places side by side waits for the opt-in window.
- Horizon controls are larger: 48dp minimum, 60dp for Close, Get directions, Open place page and Search (`MightsButton` sizes `xr` and `xr-primary`; spacing tokens `target-primary`, `xr-section`, `xr-stack`, `xr-inline`, `xr-row`, `xr-header`).
- PICO and phone builds are unchanged, apart from the flat extra-large Detail width, which follows `pane-detail-xr` from 440dp to 400dp.
