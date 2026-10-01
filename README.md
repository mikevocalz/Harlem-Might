# Harlem Might

A spatial-first universal app: **Expo SDK 58 (iOS/Android) + Next.js 16**
sharing application code through **Solito**, with **Tailwind CSS 4 + Uniwind** for
product UI, **React Native Skia** for universal GPU graphics, **Rive** for animated
surfaces, and **Viro/OpenXR** for immersive 3D.

The included visual sandbox is a neon Grid world: procedural Skia Grid Scene +
Glyph City on web/native, futuristic semantic controls, and a Viro light-cycle
race that becomes the headset entry experience.

## Layout

```
apps/
  mobile      Expo Router app; Meta Horizon/PICO configuration lives here
  web         Next.js app + Payload CMS; /spatial mounts the shared Grid experience
  storybook   Storybook 10 + Vite; includes Spatial / Grid World showcases
packages/
  app         Shared product screens and providers
  ui          Universal semantic UI + Skia backgrounds + futuristic controls
  spatial     Shared Viro scene, XR routing, race state, Rive surfaces
  theme       Design tokens + Tailwind theme CSS
  assets      Shared fonts/assets
  payload     Payload config
  config      Shared TypeScript/ESLint presets and architecture boundaries
tooling/
  generators
  copy-viro-web-assets.mjs
  copy-skia-web-assets.mjs
```

## Quick start

```sh
pnpm install

# Web (Next + Payload admin at /admin — needs DATABASE_URL + PAYLOAD_SECRET)
cp .env.example .env
pnpm --filter web dev

# Mobile / Expo
pnpm --filter mobile ios      # or: android / dev

# Storybook — open Spatial / Grid World
pnpm --filter storybook dev
```

Postinstall copies Viro WASM/SLAM sidecars and CanvasKit into the app public
directories. Do not replace those scripts with remote CDN dependencies; the starter
is designed to build from pinned local runtime assets.

## Rendering model

- **Product UI:** Tailwind 4 on web; Tailwind 4 classes through Uniwind on native.
- **Universal graphics:** one React Native Skia implementation for Grid Floor,
  Grid Scene and Glyph City. Web loads the same code through CanvasKit/WASM.
- **Animation surfaces:** Rive Nitro on native and Rive WebGL2 on web.
- **Immersive 3D:** Viro scene code shared across web/native; Meta Horizon
  devices (Quest + Meta VR Glasses) and PICO use the fork's OpenXR path.
- **Capability-first XR:** gaze, hands, passthrough, planes, scene understanding,
  foveation and local-floor support are queried from the active OpenXR runtime.
- **Meta spatial windows:** optional fork capability via Meta Layout SDK, gated
  to Meta Horizon rather than generic Android.

See [docs/SPATIAL.md](docs/SPATIAL.md) for the renderer, XR, race and fork details, and [docs/XR-PLATFORM-MATRIX.md](docs/XR-PLATFORM-MATRIX.md) for the current Meta Horizon, PICO, visionOS, WebSpatial, Meta wearables and Specs support boundaries.

## Conventions

- One dependency version lives in the pnpm catalog.
- Screens/routes stay thin; reusable product UI belongs in `packages/ui`.
- Raw DOM/native styling details stay behind the UI package boundaries.
- Skia is for procedural graphics, not normal form/layout styling.
- Viro owns immersive world geometry; do not flatten XR scenes into Skia.
- Scaffold ordinary work with `pnpm gen domain <name>`,
  `pnpm gen feature <name>`, or `pnpm gen component <Name>`.
