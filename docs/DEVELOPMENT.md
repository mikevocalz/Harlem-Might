# Development

Harlem Might is one cross-platform product. Web, mobile, foldables, tablets, and headset builds should share product code unless a platform requires a dedicated implementation.

## Project structure

- Shared screens and feature UI belong in `packages/app/features/<feature>/`.
- `apps/web` and `apps/mobile` should stay thin: bind routing, platform services, and data to shared screens.
- Shared product UI should use `@acme/ui` and the repository's semantic component boundaries.
- Platform-specific behavior belongs beside shared code in matching `.web.ts(x)` and `.native.ts(x)` files.
- Server-only reads stay in `apps/web`.
- Imports from `@acme/app/features/*` include the file extension required by the package export map.

Before adding a screen to an app directory, check whether another platform needs it. If it does, put the screen in the shared feature package.

## Adaptive layout

Navigation is chosen by hardware family, while pane composition is chosen by usable space.

- Ordinary phones use bottom tabs.
- Foldables, tablets, and headset layouts use the right-side rail.
- Web uses the persistent header; phone-width web uses bottom tabs.
- Hinge geometry and safe regions must be respected on foldables.
- Explore keeps the existing `resolveExploreLayout` and keep-mounted `ExplorePane` model.
- Do not reintroduce the removed SplitView implementation or create a second adaptive-pane system.

Keep state and continuity in the existing Zustand/ref architecture. Preserve Kinetrell, Rive, Viro/OpenXR, Skia/WebGPU, and renderer boundaries already used by the project.

## UI conventions

- Prefer the shared semantic UI package over raw platform markup in product screens.
- Keep Tailwind/Uniwind usage behind the established shared UI boundaries.
- Skia is for graphics, not ordinary layout.
- Viro owns immersive world geometry.
- Do not introduce Tamagui or Bento.
- Keep authored stage ratios and screen-specific inspector behavior rather than applying one numeric layout preset everywhere.

## Verification

Changes should run the relevant type checks, lint checks, and tests for the packages touched. Device-specific claims require device validation; browser or simulator checks should be described as such.
