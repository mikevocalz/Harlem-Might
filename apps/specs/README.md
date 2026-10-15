# Harlem Might on Snap Specs

This directory contains the native Lens Studio entrypoint for Harlem Might's
Specs experience. The phone/web/Quest UI is **not** deployed into Lens Studio.
The shared app projects its state into portable Viro scene nodes; the existing
`viro-external` Specs runtime renders them with Lens Studio/Snap OS.

What the Lens does today, and what has been verified where, is in
[STATUS.md](STATUS.md).

## What Viro renders here

Lens Studio draws every pixel; ViroCore does not run on the glasses. Viro
External is the UI layer: `HarlemMightSpecsEntry` describes each screen as
portable nodes and calls `ViroSpecsPresentationHost.present()`, and the synced
Lens scripts in `Assets/ViroSpecs/lens` turn them into Lens objects. The same
node format renders through ViroCore on iOS, Android, Quest and PICO.

| Node | Becomes in Lens Studio | Used for |
|---|---|---|
| `panel` | Snap UI Kit frame prefab | the card, button and tab plates |
| `text` | Lens `Text` with `textStyle` size and color | titles, labels, body copy |
| `image` | Lens `Image` from `ViroSpecsAssetRegistry` | header logo, tab icons, CMS photos |
| `group` | empty `SceneObject` | layout, and each pinch target |
| `group` with `scroll` | UI Kit `ScrollWindow` | the list window and detail pages |
| `targets` | SIK `Interactable`, bound one frame later | pinches that come back as action strings |

Outside Viro, the entrypoint drives Lens and Snap components directly:
Navigation Kit (arrow and `ManualPlaceList`), Snap's map (`[MapComponent]`
from the Navigation Kit sample), the WebView video screen, the Internet Module
that reads Payload, and `RemoteMediaModule`, whose photo textures are handed
to Viro with `registerImage`.

## Required sibling repository

Use `mikevocalz/viro-external` with these changes present:

- #68 (merged): text styling and next-frame pinch binding.
- #69 (open): `ViroSpecsAssetRegistry.registerImage`, used for every CMS photo.
- #70 (open): the `scroll` option on group nodes, rendered as a UI Kit
  `ScrollWindow`. It adds no ScrollBar, because ScrollBar's `scrollWindow` and
  orientation are private inputs.

Until #69 and #70 merge, sync from a checkout that contains both branches. Do
not substitute public ViroCore as a Snap OS renderer.

## Setup

1. Use Lens Studio 5.24.1 targeting SPECS 27 (verified version; 5.22+ is the
   floor). Initialize a Lens project with Snap's current CLAD toolchain, then
   install the upstream pinned packages documented in
   `viro-external/packages/specs`.
2. From Viro External, run `pnpm --filter @viro-external/specs
   specs:sync -- --project /path/to/LensProject`.
3. Copy the three scripts in `Assets/HarlemMight/Scripts/`
   (`HarlemMightSpecsEntry.ts`, `HarlemMightContent.ts`,
   `HarlemMightVideoScreen.ts`) into the Lens project's
   `Assets/HarlemMight/Scripts/`. The relative imports resolve the synced
   `Assets/ViroSpecs/lens` directory.
4. Install Snap's Navigation Kit (`SpecsNavigationKit.lspkg`). The entry
   script imports `ARNavigation`, `GeoLocationPlace`, `Place` and
   `NavigationDataComponent` from it. Put the Harlem places (Apollo Theater,
   Schomburg Center) in the scene's `ManualPlaceList`; walks reuse those
   entries so the map shows one pin per place.
5. Turn on Project Settings > Experimental API. Lens Studio stores it in the
   `.esproj` as `EXPERIMENTAL_API` in `metaInfo.lensDescriptors`. Don't try to
   set `spkPrivilegeLevel` by editing the file; Lens Studio overwrites it on
   save. Experimental API is required for `http://` fetches to a local server
   and for WebView.
6. Attach `ViroSpecsAssetRegistry`, `ViroSpecsRuntimeHost`,
   `ViroSpecsInteractionHost`, `ViroSpecsPresentationHost` and
   `HarlemMightSpecsEntry` to scene objects. Wire the entry's inputs:
   `presentationHostObject`, `navigationObject` (the object with
   `NavigationDataComponent`), `arNavigationObject` (the AR Navigation arrow),
   `assetRegistryObject`, and optionally `placeIcon`. Set the default UI Kit
   frame prefab and readable font in the asset registry.
7. Import the images and map them in `ViroSpecsAssetRegistry`:
   - `packages/assets/Harlem-Might-Logo-landscape.png` under
     `harlem-might-logo`. Use it as supplied; never recolor the logo.
   - The ten PNGs in `Assets/HarlemMight/Images/TabIcons/` under their file
     names without the extension (`tab-explore-active`, `tab-explore-idle`,
     and so on for walks, stories, music and today).

   For the registry's Default Image Material, create an Unlit material with
   Blend Mode Normal, Depth Write off and Base Texture enabled. Don't use the
   lab's two image materials: neither renders the image correctly.
8. Connect Payload. Create an Internet Module asset and set it as the entry's
   `internetModule`. Set `apiBase` to the Payload REST base, ending in
   `/payload-api` (the Lens equivalent of `EXPO_PUBLIC_PAYLOAD_API_BASE`). The
   committed default, `http://localhost:3200/payload-api`, is the Harlem web
   app run locally against the Neon database in the repo `.env`:

   ```sh
   pnpm --filter web exec node scripts/next.mjs dev -p 3200
   ```

   No public Payload host exists yet (`harlemmight.com` does not resolve).
   Spectacles need a public `https://` host; for a device on the same Wi-Fi,
   use `http://<Mac LAN IP>:3200/payload-api` with Experimental API on. When a
   read fails, the tab shows its offline content and retries the next time it
   opens.
9. Set up the video screen. Add a scene object with an Image (the header
   logo's material works; the script clones it) and `HarlemMightVideoScreen`,
   set its `internetModule` and `screen` inputs, and set the object as the
   entry's `videoScreenObject`. The entry positions and sizes it (44 x 24.75
   cm in the Play popup), so its starting transform doesn't matter.
10. Add the map. Copy `MapComponentModified` from Snap's Navigation Kit sample
    (Spectacles-Sample, cloned with Git LFS), add `[MapComponent].prefab`,
    point its `navigationComponent` inputs at the Navigation Kit object, and
    set it as the entry's `mapObject`. The entry shows it on Explore only and
    hides it during a walk.
11. Run CLAD `/verify-preview` and LEAF interaction tests in Preview. To run on
    Spectacles, connect them and push from Lens Studio.
12. A future authenticated Mobile Kit transport will call
    `HarlemMightSpecsEntry.acceptFrame(frame)`. The app produces that frame
    via `projectHarlemSpecs` in `packages/app/features/specs/experience.ts`.
    The Lens forwards action strings to a registered `subscribeCommand`
    listener; it never writes to the app navigation store or CMS itself.
    The entrypoint rejects commands not present in the most recently accepted
    frame; the phone must still authenticate/authorize the command and session.

`acceptFrame` consumes only `{scene, targets}`. The separate
`navigation` projection goes to `ViroSpecsNavigationHost` *after* a live
location fix, AR tracking and permission gate. No automatic world-route
submission ships in this PR. The Navigation Kit arrow is a straight-line
bearing to the entrance, not a street route.

## Source of truth

- Content: the same public Payload REST collections, filters and sort orders
  as the mobile app (`packages/app/content/rest-source.ts`, `readers.ts`).
  `HarlemMightContent` ports them because Lens scripts can't import from the
  monorepo; update both when the mobile readers change.
- Route state: `useNavigationStore`; no separate Specs navigation controller.
- Live actions: existing app controller must authorize and apply commands.
- The two offline preview places are demonstration content only.
- The offline Today facts are a copy of
  `packages/app/content/history-facts.ts`. Update both when that file changes.

## Validation

```sh
node --experimental-strip-types --test packages/app/features/specs/*.test.ts apps/specs/tests/*.test.ts
pnpm --filter @acme/app typecheck
pnpm --filter @viro-external/specs specs:validate-lens
```

The first command is the `specs-portable-contracts` CI step (17 tests). The
second uses Harlem Might; the third uses Viro External. Lens Studio Preview
checks are listed in [STATUS.md](STATUS.md); nothing has run on Spectacles
hardware yet.
