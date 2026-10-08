# ADR 0002: Use @metavr/layout-compat directly, not Viro's spatial wrapper

**Status:** Accepted
**Date:** 2026-10-08
**Deciders:** Mike Allen (repo owner)
**Decision record:** DECISIONS S8, S10

## Context

Two ways exist to put React Native content in Horizon OS system windows:

- **Viro's wrapper** (fork `components/Spatial/ViroSpatialLayout.tsx`): `ViroSpatialSceneProvider` and `ViroSpatialWindow`. It gates on the runtime device check `isMetaHorizonXR`, types `windowWidth` as `number` (Meta also takes a percentage) and `anchor` as `unknown`, and does not re-export `useSpatialWindowState`, `useSpatialScene` or the offset constants.
- **Meta's packages directly**: `SpatialSceneProvider` and `useSpatialScene` from `@metavr/layout-compat`, `SpatialWindow`, `createWindowScene` and `useSpatialWindowState` from `@metavr/layout-window-compat` 1.0.0.

The product needs placement state: a pane promoted to its own window must collapse inline, or the content shows as a blank strip next to the map. Only `useSpatialWindowState(label).placement` reports that.

## Decision

The app talks to Meta's packages directly through one facade, `apps/mobile/src/spatial/metaWindows.ts`, ported from expo-pico's `createMetaWindows`:

- one `SpatialSceneProvider` in `app/_layout.tsx`, with one `createWindowScene({ fallback: 'inline' })` initializer for the app's lifetime;
- `Window` spreads `MetaWindowProps` from `@viro-external/meta-layout`'s `resolveMetaWorkspace` onto `<SpatialWindow>` unchanged, so prop names and shapes stay 1:1 with Meta's `.d.ts`;
- `usePlacement` and `useSpatialAvailable` wrap `useSpatialWindowState` and `useSpatialScene`;
- the SDK is `require`d only when `isHorizonBuild` is true. Otherwise every hook returns `inline` / `false` and every window is a fragment.

`@viro-external/xr-contract` stays the semantic source. The Explore workspace (`src/spatial/exploreWorkspace.ts`) is authored there, and `resolveMetaWorkspace` turns it into window entries with explicit `{parent, child}` anchors, `offset.z` and priorities.

The gate is the build flavor, not the device: the view manager exists only in the quest flavor, which is what decides whether rendering Meta's component is safe.

## Consequences

- The Viro fork plays no part in the 2D window path, so window behaviour does not depend on which Viro ref is linked.
- The Spatial screen's tools window (`ForkSpatialLayout`, label `harlem-might-tools`) is struck (DECISIONS S6). It went through Viro's provider, which would have been a second scene, and it would have competed for one of the two slots.
- The facade types Meta's surface locally because Meta's `.d.ts` files are Flow-generated (`children` typed as Flow's `Node`). The local types must track the 1.0.0 signatures; `META_LAYOUT_API.md` in the audit holds them.

## Alternatives considered

- **Viro's wrapper.** Rejected: no placement hook, looser and narrower prop types, and a device check instead of a build check.
- **An Expo module or Compose host.** Rejected: Meta's React Native packages already expose every API used here, so a native bridge would add nothing (prompt §4, "Expo Modules v2 versus Compose").
