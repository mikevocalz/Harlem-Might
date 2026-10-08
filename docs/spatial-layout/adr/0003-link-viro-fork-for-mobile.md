# ADR 0003: Mobile links the private Viro fork; web and CI keep the public release

**Status:** Accepted, with an open blocker in the fork (below)
**Date:** 2026-10-08
**Deciders:** Mike Allen (repo owner)
**Decision record:** DECISIONS S1, S2

## Context

The headset build needs the mikevocalz Viro fork (`~/viro`, `main` at `6a77307e`). The public `@reactvision/react-viro` 3.0.2 has no `isMetaHorizonXR`, no fork Rive panels and no fork plugin options. The fork is private, so CI cannot fetch it, and `apps/web`, `packages/spatial` and Storybook only need the public package.

`@viro-external/*` pointed at `~/viro-external-specs-preview`, which no longer exists, so no Android bundle could be produced from the tree.

## Decision

- `apps/mobile/package.json`: `"@reactvision/react-viro": "link:../../../viro"` and `"@viro-external/{core,media,meta-layout,ui,xr-contract}": "link:../../../viro-external/packages/<pkg>"`. Everything else keeps `catalog:` (Viro 3.0.2).
- `apps/mobile/metro.config.js`:
  - watches `../../../viro` and `../../../viro-external`;
  - resolves every `@reactvision/react-viro` import in the mobile bundle from `apps/mobile`, so `packages/spatial` gets the fork instead of the hoisted public copy;
  - resolves bare imports from inside the linked checkouts from the app first, so their own `react` / `react-native` copies never load;
  - maps the fork's `react-native/Libraries/Image/AssetRegistry` import (removed in RN 0.88) to the app's `react-native/asset-registry`.
- CI keeps building everything except mobile. A dangling `link:` installs with `pnpm install --frozen-lockfile`.

## Evidence

- `npx expo export --platform android` (sourcemap check): 5,887 modules, 174 from the fork, 0 from public Viro 3.0.2, one `react-native` root and one `react` root, both `@metavr/*` packages present.
- CI simulation: a clone of this branch with no `viro` or `viro-external` siblings ran `pnpm install --frozen-lockfile`, `spatial:verify-android`, `spatial:verify-typegpu`, the `@acme/spatial` tests and `pnpm turbo build typecheck lint --filter='!mobile'` (26/26).

## Open blocker in the fork

The fork's committed `dist/plugins/*.js` is ES module output with extensionless imports (since `e44b7f11`, 2026-10-05, `module: preserve`). Node cannot load it, so `app.plugin.js` throws `ERR_MODULE_NOT_FOUND` and every Expo command that reads the config (`expo start`, `expo prebuild`, `expo export`) fails with the fork linked. The checks above ran with a verification-only require hook that loaded a CommonJS build of the same `plugins/*.ts` source. The fix belongs in the fork: emit the plugins as CommonJS (or add extensions), then rebuild `dist`.

## Consequences

- `@viro-external/ui` on `main` lacks the exports the `/viro-external` headset test route imports (`PanelStack`, `PanelStat`, `RivePanel`, `RiveBaked`, ...). They exist only on viro-external's unmerged `codex/specs-generated-preview`. The same three statements fail typecheck as before; tsc now names each missing export instead of the missing module.
- The fork brings its own `node_modules` (React 19.2, RN 0.86). The Metro rules above are what keep them out of the bundle; removing them reintroduces duplicate copies.
