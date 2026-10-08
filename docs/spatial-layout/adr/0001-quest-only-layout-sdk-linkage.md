# ADR 0001: Link the Meta VR Layout SDK into the quest flavor only

**Status:** Accepted
**Date:** 2026-10-08
**Deciders:** Mike Allen (repo owner)
**Decision record:** DECISIONS S3 (spatial workspace)

## Context

`apps/mobile` builds three Android flavors from one project: `mobile`, `pico` and `quest`. The Meta VR Layout SDK (`com.meta.metavrx.layout:layout-react-compat` and `layout-window-react-compat` 1.0.0, BOM `com.meta.metavrx:metavrx-bom:1.2026.0.0`) only works on Horizon OS 207+.

Until this change, the Viro plugin option `android.metaSpatialLayout: true` wrote the BOM and both artifacts as plain `implementation` lines in `app/build.gradle`. Every flavor linked the SDK, and the window AAR's manifest merged `horizonos.permission.MANAGE_APP_VOLUMETRIC_WINDOWS` and the Horizon OS SDK declarations into the PICO and phone APKs too.

Unlinking the npm packages is not an option. Each `@metavr/*` package autolinks an Android library project that declares its AAR as `api(...)`, the AAR classes extend that project's codegen output, and the generated `PackageList` instantiates `SpatialScenePackage` and `SpatialWindowPackage` in the main source set.

## Decision

`@expo-pico/core`'s `metaLayoutSdk: true` owns the SDK setup, and Viro's `metaSpatialLayout` is `false`. The expo-pico plugin (`plugin/src/withQuestMetaLayout.ts`):

1. declares the BOM and both artifacts as `questImplementation`;
2. excludes `com.meta.metavrx.layout` from every non-quest `*CompileClasspath` and `*RuntimeClasspath`;
3. adds `src/metaLayoutStub/java` to every non-quest flavor, holding empty `ReactPackage` classes under the vendor names so `PackageList` compiles and registers nothing;
4. adds both library namespaces to `<uses-sdk tools:overrideLibrary>`.

JavaScript renders Meta's components only when `ExpoHorizon.isHorizonBuild` is true (`apps/mobile/src/spatial/horizonBuild.ts`). The codegen'd `SpatialWindowView` descriptor exists in every flavor, but its view manager exists only on quest.

`tooling/verify-spatial-android.mjs` asserts the quest-only lines and the stubs, and fails on any flavor-wide `implementation ... com.meta.metavrx` line.

## Consequences

- One owner for the BOM. Turning both plugin options on would declare it twice.
- The checked-in `apps/mobile/android` carries exactly the generated pieces: the Gradle block, the two stub files and the manifest line. They were copied from an `expo prebuild --platform android` of this config, not hand-written.
- Not verified here: `assembleQuestDebug`, `assemblePicoDebug` and `assembleMobileDebug`, and the APK check that only the quest APK holds `metavrx/layout` classes and the volumetric-window permission. expo-pico commit `47ff29b` reports that check passing for its example app with the same plugin code. No Gradle build ran for this repo (disk budget).

## Alternatives considered

- **Keep Viro's `metaSpatialLayout`.** Rejected: it leaks the SDK and the permission into PICO and phone builds.
- **Patch the Viro plugin to use `questImplementation`.** Rejected for this PR: the classpath exclusion and stubs are also needed, and expo-pico already ships and tests them. Belongs in the Viro fork if it should ever own this.
