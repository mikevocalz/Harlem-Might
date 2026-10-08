# XR platform matrix

**Synchronized:** October 7, 2026 (status words mapped onto the five-word vocabulary).

This starter uses **capability-first routing**. Product/device names select only the broad runtime family; negotiated runtime facts decide features.

## Current lanes

Status words follow `docs/META_VR_GLASSES.md`, one meaning each:

| Word | Meaning |
| --- | --- |
| preview | code exists on an unmerged branch or behind a flag |
| concept | design only, no code |
| integration path | code is merged and builds; nothing has run on the target |
| in testing | running on a simulator or a stand-in device |
| verified | passed the 8-point bar under "Verification language" on the real device |

No lane is verified: no row has the 8-point record below. Public copy (`/ar`, `/download`) uses these words only.

| Target | Primary runtime | Status | Important boundary |
| --- | --- | --- | --- |
| iOS / Android phone + tablet | Expo / React Native | integration path | builds, not released (`apps/mobile/eas.json`: internal distribution, empty `submit.production`); Viro runtime only. Harlem place-label AR is a **concept**: the only AR scene is the tabletop race |
| Web | Next.js + Viro Web + Skia/WebGPU | integration path | ordinary browser remains the baseline fallback; `/ar` never requests the camera |
| Meta Quest | Viro Android OpenXR / Horizon OS | in testing (floor and controller work only) | use runtime capability probes instead of model-name feature gates |
| Meta VR Glasses | same Meta Horizon/OpenXR family | integration path | `metaVrGlassesCompatible` targets Meta's current `quest3+` delivery family; nothing has run on the glasses |
| PICO native | Viro Android OpenXR | integration path | PICO app launcher/tooling belongs to `expo-pico`, not Viro's Meta manifest path |
| PICO OS 6 spatial web | WebSpatial 2.x adapter in `mikevocalz/viro-external` | integration path | spatial DOM/window presentation is separate from Viro native OpenXR |
| visionOS / Vision Pro | Viro visionOS renderer | integration path | use the current visionOS shared-space and input capabilities |
| Meta AI glasses | Meta Wearables DAT adapter in `mikevocalz/viro-external` | integration path | companion-phone wearable APIs are not an immersive Viro renderer |
| Snap Specs / Spectacles | portable-scene adapter in `mikevocalz/viro-external` | preview (`specs:scene`, unmerged `codex/specs-generated-preview`); WebView route: concept | Lens Studio/Snap OS owns rendering; do not boot ViroCore on the glasses |
| Sightline (Harlem Might glasses) | Three.js WebGPU render on `/ar` | concept | a render of hardware that does not exist (`docs/adr/0004-sightline-placement.md`) |

Old labels map as follows: "integrated", "integrated build", "integrated scene route", "integrated fork lane", "adapter foundation merged" and "integration foundation merged" all become **integration path** (merged and builds, not run on the target). The Specs row was labelled "adapter foundation merged", but the scene export itself sits on an unmerged branch, so it is **preview**.

## One shared application contract

Keep application/domain state above the platform adapters:

```text
shared app state + Zustand stores
            |
     presentation intent
            |
 +----------+-----------+----------------+
 |          |           |                |
Viro     Meta Layout  WebSpatial   wearable/specs
 |          |           |                |
OpenXR   Horizon OS   PICO OS 6     DAT / Lens Studio
```

The starter's existing rules still apply:

- normal product UI uses Tailwind 4 / Uniwind;
- Skia owns universal procedural 2D GPU scenes;
- Rive owns animated UI surfaces;
- Viro owns immersive/native 3D;
- Three.js/WebGPU remains the portable web/native renderer lane where Viro is not the right host;
- Zustand owns durable product/game state; presentation adapters do not become state owners.

## Meta Horizon

Use `isMetaHorizonXR` for the runtime family.

React Native on Meta VR Glasses, web AR glasses and how `@viro-external/ui` panels reach each target: [META_VR_GLASSES.md](META_VR_GLASSES.md).

Do not use `Build.MODEL`, `isKnownQuest`, or a reported Quest identity as proof that a feature exists. Meta Horizon compatibility mode can present a Quest-compatible identity on newer hardware.

When an immersive view is active, query `getOpenXRRuntimeCapabilities(viewTag)` for:

- eye-gaze extension availability and support;
- hand tracking;
- hand aim;
- passthrough;
- plane detection;
- scene understanding;
- foveation;
- eye-tracked foveation;
- local-floor support.

## PICO

Native PICO and PICO WebSpatial are deliberately separate:

```text
PICO native app
  -> Expo/PICO launcher + manifest/tooling
  -> Viro OpenXR immersive scene

PICO spatial web
  -> normal web app
  -> WebSpatial 2.x presentation adapter
  -> ordinary-browser fallback when spatial runtime is unavailable
```

Do not load Meta Layout compatibility packages merely because PICO is Android.

The companion repositories are:

- `mikevocalz/expo-pico` — PICO app configuration, launcher/build/device tooling.
- `mikevocalz/viro-external/packages/webspatial` — WebSpatial 2.x surface adapter.

## Meta AI glasses

The Meta Wearables DAT lane is a phone-companion wearable integration. Capability reports decide whether camera, display, microphone/audio, motion, inputs, or speech are available.

A displayless glasses target must not receive a fake Viro surface. Fall back to the actual supported camera/audio workflow.

## Snap Specs / Spectacles

The Specs adapter compiles the portable subset of scene intent into a stable snapshot for a Lens Studio runtime bridge.

Portable node intent includes:

- groups;
- text;
- images;
- models;
- panels;
- transforms;
- semantic interactions.

Lens Studio remains responsible for SceneObjects, UI Kit/SIK, hand/gaze input, Snap materials, camera, permissions, deployment and SyncKit.

## Verification language

Do not label an adapter foundation, simulator result, or successful build as physical-device proof.

For a target to move from **integration path** or **in testing** to **verified**, record:

1. exact device/runtime version;
2. build artifact/commit;
3. render success;
4. input success;
5. permissions/camera/passthrough behavior where applicable;
6. resize/window behavior for system/spatial windows;
7. performance baseline;
8. any unsupported capabilities and fallbacks.
