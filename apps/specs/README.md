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
4. Install Snap's Navigation Kit (`SpecsNavigationKit.lspkg`). The entry
   script imports `ARNavigation`, `GeoLocationPlace` and
   `NavigationDataComponent` from it.
5. Attach `ViroSpecsAssetRegistry`, `ViroSpecsRuntimeHost`,
   `ViroSpecsInteractionHost`, `ViroSpecsPresentationHost` and
   `HarlemMightSpecsEntry` to scene objects; wire the Inspector references,
   including the Navigation Kit object (with `NavigationDataComponent`) and the
   AR Navigation arrow object. Set the default UI Kit frame prefab and
   readable font in the asset registry.
6. Set up the header logo. Import
   `packages/assets/Harlem-Might-Logo-landscape.png` into the Lens project and
   map it in `ViroSpecsAssetRegistry` under the image id `harlem-might-logo`.
   Use it as supplied; never recolor the logo. For the registry's Default Image
   Material, create an Unlit material with Blend Mode Normal, Depth Write off
   and Base Texture enabled. Don't use the lab's two image materials: neither
   renders the image correctly.
7. Run CLAD `/verify-preview` and LEAF interaction tests. Offline, the
   entrypoint shows the logo header and the app's tabs (Explore, Walks,
   Stories, Music, Today). Explore lists two preview places and can start a
   Navigation Kit walk to either one. The arrow is a straight-line bearing to
   the entrance, not a street route. Today shows the next cited history fact;
   Walks, Stories and Music say they load once the phone is connected.
8. A future authenticated Mobile Kit transport will call
   `HarlemMightSpecsEntry.acceptFrame(frame)`. The app produces that frame
   via `projectHarlemSpecs` in `packages/app/features/specs/experience.ts`.
   The Lens forwards action strings to a registered `subscribeCommand`
   listener; it never writes to the app navigation store or CMS itself.
   The entrypoint rejects commands not present in the most recently accepted
   frame; the phone must still authenticate/authorize the command and session.

`acceptFrame` consumes only `{scene, targets}`. The separate
`navigation` projection goes to `ViroSpecsNavigationHost` *after* a live
location fix, AR tracking and permission gate. No automatic world-route
submission ships in this PR.

## Source of truth

- Place rows: `placeCatalogueStore` (Payload readers), not Lens fixtures.
- Route state: `useNavigationStore`; no separate Specs navigation controller.
- Live actions: existing app controller must authorize and apply commands.
- The two offline preview places are demonstration content only.
- The offline Today facts are a copy of
  `packages/app/content/history-facts.ts`. Lens scripts can't import from the
  monorepo, so update both when that file changes.

## Validation

```sh
pnpm --filter @acme/app test
pnpm --filter @acme/app typecheck
pnpm --filter @viro-external/specs specs:validate-lens
```

The first two commands use Harlem Might; the third uses Viro External. Lens
Studio/LEAF and physical Specs checks remain unrun in this GitHub-only slice.
