# Development

Harlem Might is one cross-platform product. Web, mobile, foldables, tablets, and headset builds should share product code unless a platform requires a dedicated implementation.

## Project structure

- Shared screens and feature UI belong in `packages/app/features/<feature>/`.
- `apps/web` and `apps/mobile` should stay thin: bind routing, platform services, and data to shared screens.
- `apps/web-vite` hosts curator tooling and its supported public, Today and profile routes. Keep its TanStack routing and form presentation local while sharing content contracts and member-session behavior; see [AUTH_PROFILE.md](AUTH_PROFILE.md).
- Shared product UI should use `@acme/ui` and the repository's semantic component boundaries.
- Platform-specific behavior belongs beside shared code in matching `.web.ts(x)` and `.native.ts(x)` files.
- Payload-bound content readers belong in `packages/payload` and are exposed through `@acme/payload/server`; CMS services also live in that package. Next-specific caching and route composition stay in `apps/web`; platform-neutral records, reader contracts and mapping live in `packages/app/content`. See the [content read contract](../packages/app/content/README.md).
- Operational Payload seed, enrichment, publishing and repair tools, datasets and their import-safe helpers belong in `packages/payload/src/maintenance/`. Runtime config, collections, migrations, types and public exports stay outside it. See the [maintenance command and offline-verification guide](../packages/payload/src/maintenance/README.md).
- Shared home-widget and wearable snapshot/handoff contracts belong in `packages/widgets`; platform renderers and transport adapters remain in their host apps. See the [widget contract](../packages/widgets/README.md).
- Imports from `@acme/app/features/*` include the file extension required by the package export map.

Before adding a screen to an app directory, check whether another platform needs it. If it does, put the screen in the shared feature package.

`pnpm gen domain <kebab-name>` scaffolds shared domain logic in
`packages/app/features/<name>/`, including its query-key factory and public
`index.ts`. `pnpm gen feature <kebab-name>` can add screen forks to the same
feature. Domain repositories consume platform-neutral content contracts or
injected sources; Payload bindings and authoritative access checks stay in
`packages/payload`. Client permission helpers only control presentation.

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

### Native catalogue startup

Creating or importing the shared place catalogue does not acquire native storage.
The mobile root calls `hydrate()` in its mount and foreground effects before
refreshing content. A failed/absent cache read can be retried at that boundary;
successful hydration is idempotent, and a successful live catalogue permanently
supersedes startup cache. Delayed hydration can fill offline gaps but cannot
replace confirmed live detail corrections or removals. Isolated stores that
need cached data must also call `hydrate()` explicitly.

### Place maintenance reporting

Menu enrichment and coordinate repair preview by default; only `--apply` writes.
Both commands are best effort: usable discoveries can still be written after
another request or write fails, but any such failure makes the final exit status
nonzero (including a failed geocode request later recovered through a fallback).
There are no automatic retries. Menu discovery retains its eight-worker,
400-homepage bound; coordinate repair tries each existing candidate in order.
Successful empty results are not failures. Menu summaries separate checked HTML,
non-HTML skips, and request failures; coordinate summaries separate genuine
no-hits from unresolved request failures and identify fallback recoveries.
The import-safe `packages/payload/src/maintenance/*-runner.test.ts` tests use fake fetch and Payload I/O; they do
not initialize the maintenance entrypoints or use a live database/network.
