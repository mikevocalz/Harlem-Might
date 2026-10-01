# Rive Grid FX

Reusable Rive VFX source and runtime bridge for the spatial Light Cycle experience.

## Runtime contract

The app emits semantic events through the Zustand-only `gridFx` bus. Rive is presentation only; collision, derez, score, winner, and spatial placement remain authoritative in the game core / Viro shared frame.

Initial authored artboards:

- `GridCoreSpinner` — futuristic Grid energy-core loader.
- `GridImpact` — white-hot collision core, sparks, and wall flare.
- `GridDerez` — implosion + digital shard burst.
- `GridLaserSlice` — fast energy slice / near-miss sweep.
- `GridShockwave` — expanding simulation ripple.
- `GridBoost` — perspective energy tunnel.
- `GridRoomSync` — two-peer shared-frame lock visualization.
- `GridMatLock` — tabletop scan and lock-in.

Semantic FX such as `sparks`, `trail-burn`, `winner-surge`, and `final-grid` currently map to these reusable primitives through `bindings.ts`. Dedicated artboards can be added without changing callers.

## RML authoring

Rive CLI/RML is the source of truth. When the CLI is installed:

```bash
cd packages/spatial/rive-fx/rive
rive . --verify
rive inspect . --summary
rive . --screenshot=build/spinner.png --advance=30
```

The runtime `.riv` should be exported/published from this source and supplied to the app as a normal Rive asset/URI. Do not hand-edit generated binary output.

## Standard vs Ultra

`scene.rml` is the production-safe baseline. `shaders/grid-shockwave.wgsl` is the Ultra GPU Canvas source for future/eligible runtimes. Standard FX must remain complete without the shader tier.

## State

No React `useState`. The FX bus is Zustand. Rive Data Binding receives semantic values only when an FX event changes.

## Package shortcuts

From the monorepo root:

```bash
pnpm --filter @acme/spatial rive-fx:verify
pnpm --filter @acme/spatial rive-fx:inspect
pnpm --filter @acme/spatial rive-fx:spinner-shot
```

The CLI is intentionally not a JavaScript dependency; install the current official Rive CLI so its bundled RML schema/docs match the compiler being used.
