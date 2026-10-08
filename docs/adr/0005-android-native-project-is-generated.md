# ADR 0005: apps/mobile/android/ is generated, not checked in

**Status:** Accepted
**Date:** 2026-10-08
**Deciders:** Mike Allen (repo owner)

## Context

The Quest build took about eight failure-and-fix rounds on 2026-10-08. Each round fixed one place where the checked-in `apps/mobile/android/` had drifted from what the config plugins generate; PR #24 fixed six of them. The expo-pico example has no such problem because it gitignores `android/` and regenerates it with `expo prebuild --clean`.

Before deciding, `expo prebuild --clean --platform android` was run against the checked-in tree at af062e0 and the result diffed. Every difference was older plugin output, not a hand edit:

- `app/build.gradle`: a global `libopenxr_loader.so` pickFirst, an explicit `implementation project(':expo-pico-core')` and an every-flavor `fileTree` dependency, all replaced by the current @expo-pico/core output (per-flavor pickFirst, `picoImplementation`, flavor fallbacks, per-flavor `PICO_XR_MODE`).
- `settings.gradle`: an `include ':expo-pico-core'` block that autolinking now covers. The Viro project includes stay; the Viro plugin writes them.
- `app/src/main/AndroidManifest.xml`: Oculus permissions, features, store targets and the VR intent filter now live in `app/src/quest/AndroidManifest.xml`, with removals in `app/src/mobile` and `app/src/pico`.
- `app/src/main/jniLibs/*/libopenxr_loader.so` moved to `app/src/pico/jniLibs/arm64-v8a`.
- `VRActivity.kt`: one comment differs. The Viro fork's plugin writes the whole file.
- `gradle.properties`: `picoBuildVariant=pico` added.

`MainActivity.kt`, `MainApplication.kt`, the Meta layout stub packages, resources and the keystore came out identical. The app's own Kotlin lives in the local Expo module `modules/spatial-window-owners`, which autolinking picks up.

One config bug blocked prebuild outright: `picoAppId: process.env.PICO_APP_ID` passed an explicit `undefined` when the variable was unset, which replaced the plugin's `''` default and made prebuild throw `Missing element text` writing `strings.xml`.

## Decision

1. `apps/mobile/android/` (and `ios/`) is gitignored and never edited. Native changes go into `app.config.ts` options or into the plugin package that owns the file.
2. `pnpm --filter mobile quest` is the one command for a Quest build: toolchain check, `expo prebuild --clean`, contract check on the generated tree, `assembleQuestDebug --no-daemon` on its real exit code, an `aapt2` manifest check, and with `--install` the device install, Metro on a free port, `adb reverse` and the deep link.
3. `tooling/verify-spatial-android.mjs` checks `app.config.ts` plugin options everywhere (CI cannot prebuild: the Viro fork is private) and the generated tree whenever it exists. The quest command runs it with `--require-android`.
4. `picoAppId` is only passed when `PICO_APP_ID` is set; the verifier rejects an empty one.

## Consequences

- The plugins are the source of truth, so the drift class behind the 2026-10-08 rounds cannot recur.
- The Quest store target is now `quest2+`, derived by @expo-pico/core from `supportedDevices` (which lists `quest2`). The checked-in tree said `quest3+`. To ship Quest 3 and up only, drop `quest2` from `supportedDevices` or set `storeDeviceTargets`.
- Hand tracking is declared as `horizonos.permission.HAND_TRACKING` in the quest manifest, as the current plugin writes it.
- `nitro-canvas-in-Vision` is not a mobile dependency and no route mounts a Rive, GPU or three.js Viro panel, so `assert-viro-fork.mjs` now warns about it instead of failing. DEFER: restore the hard failure and add the package in the change that mounts `SpatialRivePanel`.
