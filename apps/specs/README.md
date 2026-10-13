# Harlem Might on Snap Specs

This directory contains the native Lens Studio entrypoint for Harlem Might's
Specs experience. The phone/web/Quest UI is **not** deployed into Lens Studio.
The shared app projects its state into portable Viro scene nodes; the existing
`viro-external` Specs runtime renders them with Lens Studio/Snap OS.

## Required sibling repository

Use `mikevocalz/viro-external` on branch
`feat/specs-live-presentation-20261013` (or the merged release containing
`ViroSpecsPresentationHost`). Do not substitute public ViroCore as a Snap OS
renderer.

1. Use Lens Studio 5.22+ targeting SPECS 27. Initialize a Lens project with
   Snap's current CLAD toolchain, then install the upstream pinned packages
   documented in `viro-external/packages/specs`.
2. From Viro External, run `pnpm --filter @viro-external/specs
   specs:sync -- --project /path/to/LensProject`.
3. Copy `Assets/HarlemMight/Scripts/HarlemMightSpecsEntry.ts` into that Lens
   project's `Assets/HarlemMight/Scripts/` directory. The relative import
   resolves the synced `Assets/ViroSpecs/lens` directory.
4. Attach `ViroSpecsAssetRegistry`, `ViroSpecsRuntimeHost`,
   `ViroSpecsInteractionHost`, `ViroSpecsPresentationHost` and
   `HarlemMightSpecsEntry` to scene objects; wire the Inspector references.
   Set the default UI Kit frame prefab and readable font in the asset registry.
5. Run CLAD `/verify-preview` and LEAF interaction tests. The entrypoint
   first shows an explicitly marked OFFLINE PREVIEW with two selectable places.
6. A future authenticated Mobile Kit transport will call
   `HarlemMightSpecsEntry.acceptFrame(frame)`. The app produces that frame
   via `projectHarlemSpecs` in `packages/app/features/specs/experience.ts`.
   The Lens forwards action strings to a registered `subscribeCommand`
   listener; it never writes to the app navigation store or CMS itself.

`acceptFrame` consumes only `{scene, targets}`. The separate
`navigation` projection goes to `ViroSpecsNavigationHost` *after* a live
location fix, AR tracking and permission gate. No automatic world-route
submission ships in this PR.

## Source of truth

- Place rows: `placeCatalogueStore` (Payload readers), not Lens fixtures.
- Route state: `useNavigationStore`; no separate Specs navigation controller.
- Live actions: existing app controller must authorize and apply commands.
- The two OFFLINE PREVIEW place names are demonstration content only.

## Validation

```sh
pnpm --filter @acme/app test
pnpm --filter @acme/app typecheck
pnpm --filter @viro-external/specs specs:validate-lens
```

The first two commands use Harlem Might; the third uses Viro External. Lens
Studio/LEAF and physical Specs checks remain unrun in this GitHub-only slice.
