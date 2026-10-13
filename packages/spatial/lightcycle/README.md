# LightCycle ownership

LightCycle's deterministic game rules and protocol live at this directory's root.
`index.ts` exports that renderer-independent API and does not import React,
Zustand, Viro, Rive, or the runtime/UI layers.

- `runtime/` owns tabletop presence, session and race state, solo input and the
  solo simulation driver. Its colocated tests exercise session ownership and
  native component callbacks without loading device renderers or real services.
- `viro/` owns the tabletop co-location scene and native replicated race runtime.
  The runtime owns match claims and publication from lobby readiness through
  active round results. The scene supplies placement, localization and player
  readiness; it does not interpret or publish match phases. Match publication
  stays mounted while the mat pose is syncing, without starting simulation.
  It uses the shared spatial Viro bridge and shared MCP/Rive effects.
- `ui/` owns the tabletop session panel, native/web Rive scoreboards and native
  scoreboard asset state. Generic `SpatialRivePanel` remains outside this feature.
- `three/` owns the native/web solo experiences and the existing Three renderer.

These folders are private implementation paths, not new package entry points.
Consumers keep using the existing `@acme/spatial`, `@acme/spatial/lightcycle` and
`@acme/spatial/lightcycle/three` exports. The render-state functions remain
available from `@acme/spatial`; the core-only LightCycle entry does not acquire
runtime dependencies. The generic `SpatialScreen`, platform experience routing,
Viro bridge and cross-cutting Rive surfaces remain in `packages/spatial`.

Run the package's normal test command from `packages/spatial`:

```sh
node --test '*.test.ts' 'lightcycle/**/*.test.ts' 'mcp/**/*.test.ts' 'audio/**/*.test.ts'
```

Its existing recursive LightCycle glob discovers the moved runtime tests.
