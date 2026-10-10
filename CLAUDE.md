@AGENTS.md

# Harlem Might is one cross-platform app

Web (`apps/web`), mobile (`apps/mobile`) and the headset build render the same
product. Rules that follow from that:

- **Screens and their pieces live in `packages/app/features/<feature>/`.**
  Walks, stories, today, place and the shared content pieces are in
  `packages/app/features/site/`; Explore is in `packages/app/features/explore/`.
  Build them from `@acme/ui` (`/tw`, `/mights`, `/html`), which already has web
  and native implementations.
- **Apps only bind data and routing.** A Next page reads content (cached,
  server-side) and renders the shared screen. A mobile screen reads the same
  content through the REST reader and renders the same screen. No second copy
  of a screen in `apps/web/components` or `apps/mobile/src`.
- **Platform-only code** goes in a `.web.ts(x)` / `.native.ts(x)` pair next to
  the shared file, with the same extension on both (a `.ts` anchor beats a
  `.native.tsx` in Metro). Server-only reads (`@acme/payload/server`,
  `'use cache'`) stay in `apps/web`.
- **Imports into `@acme/app/features/*` carry the file extension**
  (`.../WalksIndex.tsx`). The package `exports` map does not add one.

Before writing a new screen or component in an app folder, check whether the
other platforms need it. If they do, it belongs in `packages/app/features`.
