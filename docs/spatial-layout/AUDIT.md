# Harlem Might spatial workspace: root-cause audit (why one panel?)

Audit date: 2026-10-08, updated the same day for PR C (`feat/spatial-windows`). Sections 1-7 are the original read-only audit against Harlem-Might `main` @ `9d75ae4`. The status table below supersedes their classifications where they differ.
Classification vocabulary: implemented · wired · build-tested · simulator-tested · device-verified · missing.

## 0. Status after PR C

ADRs: [0001 quest-only SDK linkage](adr/0001-quest-only-layout-sdk-linkage.md), [0002 direct @metavr over the Viro wrapper](adr/0002-direct-metavr-over-viro-wrapper.md), [0003 Viro fork link for mobile](adr/0003-link-viro-fork-for-mobile.md).

"JS build-tested" below means `npx expo export --platform android` produced the Hermes bundle and its sourcemap contains the module. No Gradle build, no device run and no simulator run happened in PR C.

| # | Integration point | Was | Now | Evidence |
|---|---|---|---|---|
| Q1 | Scene provider | missing (Explore); dead path in SpatialScreen | **wired**, JS build-tested | One `<metaWindows.SceneProvider>` around `<Slot />` in `apps/mobile/app/_layout.tsx`, initializer `createWindowScene({ fallback: 'inline' })` built once in `src/spatial/metaWindowsCore.ts:createMetaWindows`. The SpatialScreen provider is gone (`packages/spatial/ForkSpatialLayout.native.tsx`, S6). Bundle sourcemap: 7 `@metavr/layout-compat` modules. |
| Q2 | Explore panes instantiate `SpatialWindow` | missing | **wired** for Place Detail only, JS build-tested | Updated 2026-10-08 (S12): Discover renders inline in the main window and is never a window. `ExploreWorkspaceWindow` wraps only `ExplorePlaceDetail` (label `place-detail`), mounted in `app/(tabs)/explore/_layout.tsx` while a place is selected; `[placeId].tsx` only syncs the deep link into the store. Bundle: 14 `@metavr/layout-window-compat` modules (PR C count). |
| Q3 | `@viro-external/meta-layout` consumed | missing | **wired**, unit-tested | `link:../../../viro-external/packages/meta-layout`; `src/spatial/exploreWorkspace.ts` calls `resolveMetaWorkspace`. `pnpm --filter mobile test`: 5/5 in `exploreWorkspace.test.ts`. |
| Q4 | Semantic config to React elements | missing | **wired** | `resolveExploreWorkspace` → `MetaWorkspaceEntry`; `kind: 'window'` entries render `<SpatialWindow {...entry.window}>` through the facade, others render inline. |
| Q5 | Gradle: BOM and both artifacts | build-tested (questDebug 2026-10-03), all flavors | **implemented, quest only**; plugin output verified, Gradle not built | `app/build.gradle` `questImplementation` block, classpath exclusion, stubs in `app/src/metaLayoutStub/java`, `tools:overrideLibrary` in the main manifest. Copied from `expo prebuild --platform android` of `app.config.ts` (`@expo-pico/core` `metaLayoutSdk: true`, Viro `metaSpatialLayout: false`). `pnpm spatial:verify-android` passes and fails on the old flavor-wide lines. |
| Q6 | Autolinking and codegen | build-tested (2026-10-03 APK) | unchanged, **not re-built** | No `assemble*` ran (disk budget). |
| Q7 | Platform detection | not wired | **wired** (build gate) | `src/spatial/horizonBuild.ts` reads `ExpoHorizon.isHorizonBuild` via `requireOptionalNativeModule`; the facade loads `@metavr/*` only when it is true. |
| Q8 | Horizon OS 207+ on the test device | missing | Quest 3S `340YC10GC3014S` reports `ro.vros.build.version` 207 (DECISIONS evidence line). **Promotion itself: not device-verified** | Device and Meta XR Simulator are shared with another session; nothing was installed or launched. |
| Q9 | Silent inline fallback | confirmed | **struck**; SpatialScreen left the app (S13), Explore falls back by design | Inline is an intended layout: when Detail is promoted to its window, its pane collapses in the main window (`src/spatial/exploreLayout.ts`, `ExplorePane`); unpromoted, it stays the trailing pane. The SplitView module was deleted 2026-10-08; only `use-window-size-class.ts`, `constants.ts` and `transitions.ts` remain in `src/navigation/split-view/`. |
| Q10 | Main window size | not a cause (source) | unchanged | 1280x800 dp. |

| Trace link | Now |
|---|---|
| Shared layout intent | wired: `EXPLORE_WORKSPACE` (`WorkspaceDefinition`) |
| Runtime capability detection | wired: `isHorizonBuild` (build) and `useSpatialScene().isSpatialAvailable` (runtime) feed the resolver |
| Native dependency registration | implemented quest-only; Gradle not built since the change |
| Scene provider | wired, one, at the root |
| Spatial window creation | wired for Place Detail (Discover inline, S12) |
| Platform window manager | not reached in any test run |
| Actual placement | not device-verified |

### What PR C changed in the trace's weak links

- Root causes 1, 2, 4 and 5 from §5 are addressed in code. Root cause 3 (no initializer) no longer applies: the app does not go through `ViroSpatialSceneProvider`. Root cause 6 (prebuild fragility) is replaced by the quest-only plugin path. Root cause 7 needs a headset run.
- Mobile links the Viro fork (`link:../../../viro`) and viro-external `main`. Metro pins every Viro import to the fork and maps the fork's pre-0.88 `AssetRegistry` import to the app's. Bundle check: 174 fork modules, 0 public Viro 3.0.2 modules, one `react` and one `react-native` root.

### New findings

- **Fork plugin cannot load (blocker for any Expo command).** `~/viro` `dist/plugins/*.js` is ES module output with extensionless imports (`e44b7f11`, 2026-10-05). `app.plugin.js` fails with `ERR_MODULE_NOT_FOUND: .../dist/plugins/withViroAndroid`, so `expo start`, `expo prebuild` and `expo export` all fail with the fork linked. PR C's prebuild and export ran with a verification-only require hook that loaded an esbuild CommonJS build of the same `plugins/*.ts`. Fix in the fork.
- **Residual prebuild drift (not taken in PR C).** A full prebuild of today's config also moves Quest manifest entries from `main` to the `quest` flavor manifest (fork PR #65), scopes PICO PPS deps to `picoImplementation`, swaps `missingDimensionStrategy` for `matchingFallbacks`, adds an AGP 9 BuildConfig block for expo-horizon-core and drops the explicit `:expo-pico-core` include. These change what `spatial:verify-android` asserts and need a Gradle build to trust, so they stay a separate re-sync.
- **`@viro-external/ui` main lacks the test route's exports.** `/viro-external` (`components/ViroExternalTestScene.tsx`, `assets/viro-external-test/rive/index.ts`) imports `PanelStack`, `PanelStat`, `PanelBarChart`, `PanelLabel`, `PanelRow`, `PanelSurface`, `RivePanel` and `RiveBaked`, which exist only on viro-external's unmerged `codex/specs-generated-preview`. Typecheck still fails on the same three statements as before the relink.
- **Compact width on Horizon.** In the collapsed (compact) SplitView only the active column is mounted, so resizing the main window below the expanded size class unmounts the Discover window. Not handled in PR C. Superseded 2026-10-08: Discover is no longer a window (S12) and SplitView is gone; `resolveExploreLayout` owns compact behaviour.

## Original audit (2026-10-08, read-only, before PR C)


### 1. Evidence: Harlem-Might

#### 1.1 Who mounts a scene provider or a spatial window

```
$ git -C ~/Harlem-Might grep -nE "SpatialWindow|SpatialSceneProvider|ViroSpatial|@metavr|useSpatialWindowState" -- ':!pnpm-lock.yaml' ':!docs'
apps/mobile/package.json:28:    "@metavr/layout-compat": "catalog:",
apps/mobile/package.json:29:    "@metavr/layout-window-compat": "catalog:",
packages/spatial/ForkSpatialLayout.native.tsx:19:  ViroSpatialSceneProvider?: ComponentType<ProviderProps>;
packages/spatial/ForkSpatialLayout.native.tsx:20:  ViroSpatialWindow?: ComponentType<WindowProps>;
packages/spatial/ForkSpatialLayout.native.tsx:53:  const Provider = fork.ViroSpatialSceneProvider;
packages/spatial/ForkSpatialLayout.native.tsx:54:  const SpatialWindow = fork.ViroSpatialWindow;
```

- No file imports `@metavr/layout-compat` or `@metavr/layout-window-compat`. They are declared dependencies only.
- The one consumer is `packages/spatial/ForkSpatialLayout.native.tsx:46 ForkSpatialLayout`. It reads `ViroSpatialSceneProvider`/`ViroSpatialWindow` off `import * as Viro from '@reactvision/react-viro'` as optional properties, and at `:56` returns `<>{children}{panel}</>` when either is undefined.
- `ForkSpatialLayout` is used only by `packages/spatial/SpatialScreen.tsx:31`, which is mounted by `apps/mobile/app/(drawer)/(tabs)/index.tsx` and `apps/mobile/app/(drawer)/spatial.tsx`. It wraps one tools card (`label="harlem-might-tools"`, 420x560), not Discover/Map/Place Detail.
- `apps/mobile/app/_layout.tsx` mounts `GestureRoot > KeyboardProvider > SafeAreaProvider > AppQueryProvider > Slot` plus sheets. No provider.
- `apps/mobile/app/(drawer)/(tabs)/explore/_layout.tsx` renders `SplitView` with `SplitView.Column` (ExploreMasterPane), `SplitView.Column` (ExploreMapPane), `SplitView.Inspector` (MightsPanel). `src/navigation/split-view/index.android.tsx` is a flex-row layout (`CollapsiblePane`, `Aside`/`Section`/`Main`) inside one RN root. `SplitViewColumn`/`SplitViewInspector` are fragment markers (`:36-43`). Nothing in `src/navigation/split-view/` references a spatial window.

Metro resolution note: `packages/spatial/ForkSpatialLayout.tsx` re-exports `./ForkSpatialLayout.web`, but all three files are `.tsx`, so on Android Metro picks `ForkSpatialLayout.native.tsx` before the `.tsx` anchor. Not a cause here (it would be if the anchor were `.ts`).

#### 1.2 Which Viro is actually installed

```
$ grep '"version"' ~/Harlem-Might/node_modules/@reactvision/react-viro/package.json
  "version": "3.0.2",
$ ls ~/Harlem-Might/node_modules/@reactvision/react-viro/components/Spatial
ls: ...components/Spatial: No such file or directory
$ node apps/mobile/scripts/assert-viro-fork.mjs ; echo exit=$?
[Viro] Native/headset development requires the mikevocalz SDK-58 fork.
Resolved version: 3.0.2
...  overrides: "@reactvision/react-viro": "github:mikevocalz/viro#decax9-three-panel"
Required fork capabilities: ... generalized Meta Horizon runtime detection ... ViroSpatialLayout ...
exit=1
```

The public 3.0.2 package has no `ViroSpatialSceneProvider`, `ViroSpatialWindow`, `getViroSpatialLayoutSupport` or `isMetaHorizonXR` (only `isQuest`, `components/Utilities/ViroPlatform.ts:48`). `pnpm-workspace.yaml:20-30` says the public package is kept "only for web/Storybook/CI resolution" and the fork override is off. With this install `ForkSpatialLayout` always takes the inline branch, and `SpatialScreen` prints "Inline / Viro spatial fallback". `packages/spatial/SpatialViroExperience.native.tsx:9` imports `isMetaHorizonXR`, which is `undefined` on 3.0.2, so `headset` (`:81`) is false on Quest too.

#### 1.3 The `@viro-external/*` links are dangling

```
$ ls -d ~/viro-external-specs-preview
ls: /Users/mikevocalz/viro-external-specs-preview: No such file or directory
$ test -e apps/mobile/node_modules/@viro-external/xr-contract/package.json && echo RESOLVES || echo DANGLING
DANGLING
```

`apps/mobile/package.json:36-39` link `@viro-external/{core,media,ui,xr-contract}` to `../../../viro-external-specs-preview/...` (xr-contract points at `packages/xr-platform-contract`). `metro.config.js:51` adds that directory as a watch folder. `.github/workflows/ci.yml:33-38` excludes mobile from CI for this reason. Consequences: (a) any `pnpm install` from a fresh clone fails to link these; (b) any Metro bundle that reaches `app/viro-external.tsx` / `components/ViroExternalTestScene.tsx` fails to resolve `@viro-external/ui`; with expo-router's require.context every route is in the bundle, so an Android bundle from this tree currently cannot be produced; (c) `@viro-external/xr-contract` is declared but `git grep` finds zero imports of it, and `@viro-external/meta-layout` is not declared at all.

#### 1.4 Gradle, manifest and APK (checked-in `apps/mobile/android`)

`apps/mobile/android/app/build.gradle:199-202` (committed in `ac96122`, 2026-10-03):
```
    // Meta VR Layout SDK (React Native spatial windows)
    implementation platform('com.meta.metavrx:metavrx-bom:1.2026.0.0')
    implementation 'com.meta.metavrx.layout:layout-react-compat'
    implementation 'com.meta.metavrx.layout:layout-window-react-compat'
```
This is unconditional (all flavors: mobile, pico, quest; `:93-108`). The node packages also add the same AARs at a pinned version: `node_modules/@metavr/layout-compat/android/build.gradle.kts` `api("com.meta.metavrx.layout:layout-react-compat:1.0.0")`, window package `api("...:layout-window-react-compat:1.0.0")`, both minSdk 29.

Build products from 2026-10-03 (questDebug only):
```
app/build/outputs/apk/quest/debug/app-quest-debug.apk   (307,827,081 B, Oct 3 15:22)
app/build/generated/autolinking/.../PackageList.java:58-61
      // @metavr/layout-compat
      new metavrx.layout.react.SpatialScenePackage(),
      // @metavr/layout-window-compat
      new metavrx.layout.window.react.SpatialWindowPackage(),
$ unzip -p app-quest-debug.apk classes*.dex | strings | grep metavrx/layout
Lmetavrx/layout/react/SpatialScenePackage;   Lmetavrx/layout/window/react/SpatialWindowPackage;
merged manifest (questDebug): <uses-feature android:name="metavrx.layout.window.react" required=false>,
  horizonos.permission.MANAGE_APP_VOLUMETRIC_WINDOWS, <metavr:uses-metavr-sdk library=metavrx.layout.react|window.react>,
  MainActivity <layout android:defaultWidth="1280dp" android:defaultHeight="800dp"/>, minSdk 29, targetSdk 34
```
`Android-autolinking.cmake:11-21` emits "Skipping autolinked library 'react_codegen_LayoutCompat' because the source directory does not exist" for both packages. The packages' own `react-native.config.js` says this is expected ("No cmakeListsPath ... SDK's hand-written Fabric C++ is not wired up"), so the warning alone is not a failure.

#### 1.5 Config plugin vs checked-in project (prebuild survival)

- `apps/mobile/app.config.ts:87-88` passes `metaSpatialLayout: true, metaSpatialLayoutBomVersion: '1.2026.0.0'` to `@reactvision/react-viro`.
- Fork plugin (`~/viro` main) `plugins/withViroAndroid.ts:214-237 withViroAppBuildGradle`: when `android.metaSpatialLayout`, throws unless `xRMode` includes `"QUEST"`, asserts both `@metavr/*` are direct app deps (`assertDirectAppDependency`, `:189-211`), then appends the three BOM lines above (default BOM `1.2026.0.0`). The checked-in lines match this output byte for byte, so the checked-in project was prebuilt with the fork installed.
- Installed public 3.0.2 plugin: `grep -rn "metaSpatialLayout\|metavrx" node_modules/@reactvision/react-viro/plugins` returns nothing. A `expo prebuild --clean` against the current install would silently drop the BOM lines and the Meta layout dependencies (the `@metavr/*` autolinked `api(...:1.0.0)` deps would still come in through autolinking).

#### 1.6 Native codegen actually reached the APK

The `Android-autolinking.cmake` "Skipping autolinked library" lines are a template (`if(EXISTS ...) ... else() message(WARNING ...)`), not a failure log. The APK shows the Fabric descriptor was compiled:
```
$ unzip -p app-quest-debug.apk lib/arm64-v8a/libappmodules.so | strings | grep SpatialWindowView | head -3
_ZN8facebook5react14convertRawPropINS0_25SpatialWindowViewFallbackES2_...
_ZN8facebook5react18ConcreteShadowNodeI...SpatialWindowViewComponentName...SpatialWindowViewProps...
```
Versions agree: `~/.gradle/caches/.../metavrx-bom/1.2026.0.0/*.pom` declares `metavr.npm.layout-compat.version 1.0.0` / `layout-window-compat 1.0.0`, the cached AARs are `1.0.0`, and `node_modules/@metavr/layout-compat/SpatialLayoutVersion.js` is `SPATIAL_LAYOUT_SDK_VERSION = '1.0.0'`. No `PLUGIN_VERSION_MISMATCH` risk from the BOM pin.

Caveat: this APK is from 2026-10-03 15:22. The current tree has not been rebuilt since (`node_modules` was reinstalled 2026-10-07 with public Viro 3.0.2), and no build for `pico` or `mobile` exists in `app/build/outputs`.

#### 1.7 Flavor scoping

`app/build.gradle:200-202` uses plain `implementation`, so pico and mobile also link the Meta Layout AARs. The window AAR manifest contributes `horizonos.permission.MANAGE_APP_VOLUMETRIC_WINDOWS` (seen in the quest merged manifest, §1.4). Harlem-Might's `@expo-pico/core` config (`app.config.ts:93-121`) does not set `metaLayoutSdk`, so the expo-pico quest-only scoping (§3) is not applied. Not a cause of the single panel on Quest; it is a PICO/phone APK hygiene bug.

### 2. Evidence: shared repos

#### 2.1 Viro fork (`~/viro`)

| Ref | `components/Spatial/ViroSpatialLayout.tsx` | provider passes a scene initializer | plugin writes BOM |
|---|---|---|---|
| `main` @ `6a77307e` (2026-10-07) | present | yes, `c10c89c6` (`:112-119`, `defaultWindowScene` → `createWindowScene()`) | yes, `plugins/withViroAndroid.ts:219-237`, unconditional `implementation` |
| `decax9-three-panel` @ `23fe5f4c` | present | **no**: `:104 React.createElement(resolved.layout.SpatialSceneProvider, rest, children)` | yes |

```
$ git -C ~/viro merge-base --is-ancestor c10c89c6 decax9-three-panel || echo LACKS
decax9 LACKS c10c89c6
```
`c10c89c6`'s own comment (`main:components/Spatial/ViroSpatialLayout.tsx:112-113`): "Meta's provider throws 'does not allow configless initialization' without an initializer". `assert-viro-fork.mjs` tells developers to override to `github:mikevocalz/viro#decax9-three-panel`, which is the branch without that fix. Following the script's advice produces a provider with no initializer, and `ForkSpatialLayout` (`packages/spatial/ForkSpatialLayout.native.tsx:61`) passes none either. Not reproduced on device in this audit; source evidence only.

Viro PR #8 (`feat/cross-platform-spatial-layout` → `decax9-three-panel`, MERGED 2026-10-01): touched `components/Spatial/ViroSpatialLayout.tsx` plus docs. Its facade is a thin pass-through: `ViroSpatialWindow` forwards `label/windowWidth/windowHeight/fallback/...rest` to Meta's `SpatialWindow` (`:122-151`), types `anchor?: unknown`, and does not re-export `useSpatialWindowState`, `useSpatialScene`, `createWindowScene` or offsets.

Platform detection (`main:components/Utilities/ViroPlatform.ts`): `isMetaHorizonXR = androidXR.vendor === "meta-horizon"` (`:47`) from build strings via `classifyAndroidXRBuild`; `isPico = vendor === "pico"` (`:73`); Android XR from `NativeModules.VRModuleOpenXR.isAndroidXR` (`:30`). `isQuest` is a deprecated alias of `isMetaHorizonXR` (`:70`). `loadMetaSpatialModules` (`ViroSpatialLayout.tsx:60`) gates on `Platform.OS === "android" && isMetaHorizonXR`, so PICO and plain Android stay inline by construction. This is a runtime device-identity check. The expo-pico reference gates on the build flavor instead (`isHorizonBuild`, §3), which is what actually decides whether the native view manager exists.

#### 2.2 viro-external (`~/viro-external` main @ `8354927`)

PRs (all MERGED to `main` 2026-10-03): #29 `feat/spatial-workspace-contract` (xr-platform-contract), #30 `feat/meta-horizon-layout` (meta-layout), #31 `feat/pico-spatial-layout` (pico-layout), #33 `feat/viro-spatial-workspace-ui` (`packages/ui/src/SpatialWorkspace.tsx`).

`@viro-external/xr-contract` 0.3.0 (`packages/xr-platform-contract/src/index.ts`) exports:
- types: `XRPlatformFamily` `:1`, `XRCapabilityState` `:14`, `XRCapabilityName` `:21`, `XRCapabilityReport` `:59`, `SpatialPresentation` `:63`, `SpatialSurfaceRole` `:76`, `SpatialPriorityTier` `:85`, `SpatialSurfacePlacement` `:92`, `SpatialSurfaceFallback` `:100`, `SpatialSurfaceIntent` `:102`, `SpatialWorkspaceIntent` `:116`, `SpatialPlacementState` `:122`, `SpatialResolvedSurface` `:129`, `PortableXRNodeKind`/`PortableXRNode` `:164-171`, `XRInteractionSource`/`Phase` `:183-192`, `PortableXRInteraction` `:201`, `XRPlatformAdapter` `:210`;
- functions: `spatialPriorityValue` `:133`, `resolveSpatialWorkspace` `:153` (maps tier → number and sorts; nothing else);
- re-exports `./ui`, `./interaction`, `./rive`, `./quickdraw`, `./muse`, `./esiku`.
- `package.json` `exports.import/require` point at `./dist/...`, and `packages/xr-platform-contract/dist` does not exist in the checkout. Only the `react-native` and `types` conditions (→ `src/index.ts`) resolve.

`@viro-external/meta-layout` 0.1.0 (`packages/meta-layout/src/index.ts`, 100 lines, no `exports` field, `main: src/index.ts`) exports: `MetaAnchor`, `MetaSpatialWindowProps`, `MetaHorizonLayoutRuntime`, `META_HORIZON_LAYOUT_MIN_OS = 207`, `META_HORIZON_RN_DEFAULT_SLOT_BUDGET = 2`, `toMetaSpatialWindowProps(intent)`, `class MetaHorizonLayoutAdapter` (`getCapabilities()` returns `"unverified"`/`"unsupported"`, `setRuntime`, `dispose`).

`git -C ~/viro-external grep -l "@viro-external/meta-layout"` finds only its own package.json/README, the meta-wearables README and a CI workflow. No package or app consumes it.

**Can consumers render resolved surfaces?** No. `toMetaSpatialWindowProps` returns a plain props object; neither package imports React or `@metavr/*`, and no component turns a `SpatialWorkspaceIntent` into `<SpatialSceneProvider>`/`<SpatialWindow>` elements. `maxPromotedSurfaces` is read nowhere (pico-layout README `:96`, `:341` says so). PR #33's `SpatialWorkspaceSlotNode` is a `ViroNode` arc placer for the immersive Viro scene, not a Horizon system window.

API review against `api-design` (rules from the Margelo skill; `kotlin`/`build-nitro-modules` loaded too; no Swift or C++ is in this path, the @metavr packages ship no handwritten native sources):
- `SpatialSurfaceIntent` is one bag of 8 optional fields. Presentation-specific fields (`preferredSize`, `placement`, `promotable`, `opaqueRoot`) apply only to some `preferredPresentation` values; that wants a discriminated union keyed on presentation. The §5 contract also asks for capability requirements, focus/navigation and lifecycle owner, which have no field.
- `priority?: number | SpatialPriorityTier` accepts two shapes for one value; the tier mapping (0..4) collides with Meta's guidance to space priorities by 10s (`SpatialWindowProps.d.ts` `priority` doc).
- Fallback is a string union; §5 wants capability and fallback as discriminated unions carrying the reason (unsupported OS, slot budget, flavor not linked). `SpatialPlacementState` exists but nothing produces it.
- `MetaAnchor` covers single edges only. Meta's `Anchor` type also takes composed points and explicit `{parent, child}` pairs, plus `offset` (`OffsetNear`…`OffsetFar`, logical `start`). §4 requires real parent/child pairs and semantic offsets, so the mapper cannot express them.
- `toMetaSpatialWindowProps` silently defaults size to 360x480. A required field on the window variant is safer.
- `MetaHorizonLayoutAdapter` holds mutable runtime state via `setRuntime` while Meta already exposes `useSpatialScene().isSpatialAvailable`; duplicating it invites drift.

#### 2.3 expo-pico reference wiring (another session's work)

Present on `main` @ `ef17e0d`, `feat/meta-layout-spatial-windows`, `feat/quest-permission-hygiene`, `chore/renderer-overlay-a346988f` (local and origin). Introduced by `47ff29b` (2026-10-07), merged via PR #30 (`dd0bd71`).

| Piece | File:symbol | Reuse for Harlem-Might? |
|---|---|---|
| Quest-only Gradle | `packages/expo-pico-core/plugin/src/withQuestMetaLayout.ts:renderMetaLayoutGradleBlock` (`questImplementation platform(BOM)` + both artifacts; excludes `com.meta.metavrx.layout` from non-quest classpaths) | Yes. Harlem already depends on `@expo-pico/core` (`file:../../../expo-pico/packages/expo-pico-core`); setting `metaLayoutSdk: true` there replaces the Viro plugin's unconditional block. Turn `metaSpatialLayout` off in the Viro plugin to avoid declaring the BOM twice. |
| Non-quest stubs | `syncMetaLayoutStubs` / `renderStubPackage` (empty `SpatialScenePackage`/`SpatialWindowPackage` in `src/metaLayoutStub/java`) | Yes, comes with the option. |
| minSdk | `applyMetaLayoutOverrideLibrary` (`tools:overrideLibrary` for both namespaces) | Not needed today (Harlem's floor is already 29, `gradle.properties:93`), harmless. |
| JS facade | `example/src/layout/metaWindowsCore.ts:createMetaWindows` → `{ linked, SceneProvider, Window, usePlacement, useSpatialAvailable }`; one `createWindowScene({ fallback: 'inline' })` initializer built once (`:83`) | Yes, pattern. It is the only code in any repo that mounts the provider with an initializer and also surfaces `useSpatialWindowState` and `useSpatialScene`. |
| Gate | `example/src/platform.ts:isHorizonBuild` from `requireOptionalNativeModule('ExpoHorizon')` (flavor, not device) | Yes. Harlem has `expo-horizon-core` 57.0.2 installed and never reads it. |
| Mount | `example/app/_layout.tsx:25` `<metaWindows.SceneProvider>` around the whole Stack | Yes: Harlem's `app/_layout.tsx` is the equivalent spot. |
| Window specs | `example/src/layout/workspace.ts:META_WINDOWS` (library start 360x320 p20, details end 440x600 p10, controls bottom 560x168 p0, `offset: {z: zStep}`) | Shape only. Harlem needs Discover=start, Place Detail=end, two windows, the map stays in the main 1280x800 panel. |
| Evidence | commit `47ff29b` body: "Verified with assembleQuestDebug, assemblePicoDebug and assembleMobileDebug: only the quest APK contains the SDK classes" | build-tested per that commit message (not re-run here). No device capture cited. |

Differences to respect: the expo-pico example wraps windows in its own `WorkspaceWindow` with `spec` (not `SpatialSurfaceIntent`), ignores `@viro-external/xr-contract`, and leaves the PICO path to `@expo-pico/spatial`'s `resolvePicoLayoutPrimitive`. Harlem's §5 asks for xr-contract as the semantic source, so the mapping layer (intent → `MetaWindowSpec`) is the new piece.

### 3. The ten questions

| # | Question | Answer | Class | Evidence |
|---|---|---|---|---|
| 1 | Does Harlem Might mount `SpatialSceneProvider` / `ViroSpatialSceneProvider`? | Not at the root, not in Explore. Only `SpatialScreen` (Grid tab and /spatial) goes through `ForkSpatialLayout`, which renders a fragment because public Viro 3.0.2 has no `ViroSpatialSceneProvider`. Even with the fork, no initializer is passed (`decax9-three-panel` lacks `c10c89c6`). | missing (Explore); implemented-but-dead (SpatialScreen) | §1.1, §1.2, §2.1 |
| 2 | Do the Explore panes instantiate `SpatialWindow`? | No. `SplitView.Column`/`Inspector` are fragment markers laid out in one flex row. | missing | `src/navigation/split-view/index.android.tsx:36-43`, `explore/_layout.tsx` |
| 3 | Is `@viro-external/meta-layout` consumed? | No. Not declared in `apps/mobile/package.json`; nothing imports it in any repo. `@viro-external/xr-contract` is declared via a dangling `link:` and imported nowhere. | missing | §1.3, §2.2 |
| 4 | Is semantic config converted into React elements? | No. `toMetaSpatialWindowProps` returns props; no component exists. | missing | `meta-layout/src/index.ts:55-68` |
| 5 | Gradle has the BOM and both RN artifacts? | Yes in the checked-in project, all flavors. Would be dropped by `expo prebuild --clean` with the currently installed public Viro plugin. | build-tested (questDebug 2026-10-03) | §1.4, §1.5 |
| 6 | Do autolinking and codegen succeed? | Yes for the 2026-10-03 questDebug build: `PackageList` registers both packages, dex has the classes, `libappmodules.so` has the `SpatialWindowView` descriptor. Not re-verified against today's tree. | build-tested | §1.4, §1.6 |
| 7 | Platform detection: Horizon vs Android vs PICO? | Fork `isMetaHorizonXR`/`isPico` exist and are distinct, but Harlem resolves public 3.0.2 where `isMetaHorizonXR` is `undefined`. `isHorizonBuild` from expo-horizon-core is unused. | implemented in fork; not wired in app | §1.2, §2.1 |
| 8 | Quest on an OS that supports promotion (v207+)? | Unknown. No device log, capture, `getprop` output or OS version recorded anywhere in Harlem-Might (`git grep v207` hits only `docs/META_VR_GLASSES.md` quoting the Callstack docs). | missing (no device evidence) | §1.1 grep, docs/META_VR_GLASSES.md:35 |
| 9 | Inline fallback silently explaining one window? | Yes for the one place a window is requested: `ForkSpatialLayout` returns children inline with no log when the fork exports are missing, and `ViroSpatialWindow` uses `fallback="inline"`. For Explore there is nothing to fall back from. | confirmed by source | `ForkSpatialLayout.native.tsx:56-58` |
| 10 | Main window size or placement blocks promotion? | No source evidence that it does. Main is 1280x800dp (`app.config.ts:66-70`, merged manifest `<layout>`), identical to the expo-pico reference that opens three windows. Window sizes may be numbers or `%` of the main window. Unverified on device. | not a cause (source); device-unverified | §1.4, expo-pico `example/app.config.ts:49-50` |

### 4. The trace, link by link

| Link | State | Evidence |
|---|---|---|
| Shared layout intent (`SpatialWorkspaceIntent`) | implemented in viro-external, not consumed | §2.2 |
| Runtime capability detection | implemented in fork (`getViroSpatialLayoutSupport`), resolves to public Viro → always "fallback" | §1.2 |
| Native dependency registration | build-tested (questDebug, 2026-10-03), all flavors | §1.4, §1.6 |
| Scene provider | missing at root; dead path in SpatialScreen | Q1 |
| Spatial window creation | missing for Explore; one tools window behind a dead path | Q2 |
| Platform window manager | never reached (no provider mounted, so `SpatialSceneModule.initialize` never runs) | `SpatialSceneProvider.android.js:69-75` |
| Actual placement | no device evidence | Q8 |

### 5. Ranked root causes (most likely first)

1. **Explore never asks for a second window.** `explore/_layout.tsx` renders `SplitView`, an in-panel flex layout. No `SpatialSceneProvider` above it, no `SpatialWindow` inside it. Even a perfect native stack would show one panel. This alone explains the symptom.
2. **The only spatial path resolves to public Viro 3.0.2.** `ForkSpatialLayout` reads optional fork exports that do not exist in the installed package and falls back inline without logging (`assert-viro-fork.mjs` exits 1). `isMetaHorizonXR` is `undefined`, so headset routing in `SpatialViroExperience` is off too.
3. **The recommended fork branch would still fail.** `decax9-three-panel` lacks `c10c89c6`, so `ViroSpatialSceneProvider` mounts Meta's provider without an initializer. `ForkSpatialLayout` passes none. Per the fork's own comment, Meta's provider throws on configless init.
4. **The contract layer stops at props.** `@viro-external/meta-layout` maps an intent to a props object; nothing renders it, Harlem does not depend on it, and its `MetaAnchor` cannot express parent/child pairs or offsets.
5. **The JS dependency graph is broken.** `@viro-external/*` links point at the deleted `~/viro-external-specs-preview`. A current Android bundle cannot resolve `app/viro-external.tsx`, so today's tree cannot be run on a headset without fixing this first.
6. **Prebuild fragility.** The checked-in BOM lines came from the fork plugin. With the public plugin installed, `expo prebuild --clean` drops them. Autolinking would still pull the 1.0.0 AARs through the `api(...)` deps, so this is a regression risk, not today's cause.
7. **Horizon OS version unknown.** Promotion needs v207+ per Callstack docs (quoted in `docs/META_VR_GLASSES.md:35`). No device evidence exists. This becomes relevant only after 1-3 are fixed.

Ruled out on source evidence: main window size (1280x800dp, same as the working expo-pico example), BOM/AAR/JS version skew (all 1.0.0), and missing Fabric codegen (descriptor is in `libappmodules.so`).

### 6. Minimal wiring (by repo/file)

Harlem-Might:
1. `apps/mobile/package.json:36-39`: repoint `@viro-external/{core,media,ui,xr-contract}` to `link:../../../viro-external/packages/{viro-external-core,media,ui,xr-platform-contract}` (or a git dep), add `@viro-external/meta-layout` the same way. Drop the `viro-external-specs-preview` watch folder in `metro.config.js:51`.
2. `apps/mobile/app.config.ts`: in the `@expo-pico/core` block set `metaLayoutSdk: true`; in the Viro block set `metaSpatialLayout: false` (one owner for the BOM, quest-only). Prebuild, then diff `android/app/build.gradle` and the three merged manifests before committing.
3. New `apps/mobile/src/spatial/metaWindows.ts` (+ `metaWindowsCore.ts`): port expo-pico's `createMetaWindows`, gated on `isHorizonBuild` via `requireOptionalNativeModule('ExpoHorizon')`, one `createWindowScene({ fallback: 'inline' })` initializer, exposing `usePlacement` from `useSpatialWindowState` and `useSpatialAvailable` from `useSpatialScene`.
4. `apps/mobile/app/_layout.tsx`: wrap the `Slot` (inside `AppQueryProvider`) in `<metaWindows.SceneProvider>`. Exactly one provider.
5. `apps/mobile/app/(drawer)/(tabs)/explore/_layout.tsx` + `src/navigation/split-view/index.android.tsx`: on Horizon builds, render the map column as the main window content and wrap `ExploreMasterPane` in `Window` (label `discover`, anchor `start`, priority 20) and the detail pane in `Window` (label `place-detail`, anchor `end`, priority 10). When `usePlacement(label) === 'spatial'`, the SplitView must not also tile that pane (avoid a duplicate or an empty column). `MightsPanel` stays in the main window (two-slot budget). Selected place stays in `useExplore`.
6. `packages/spatial/ForkSpatialLayout.native.tsx`: stop mounting a second provider; route through the same `metaWindows` facade or delete the tools window.

viro-external:
7. `packages/meta-layout`: add a React layer (or move the mapper next to the app facade) that renders a resolved intent to `SpatialWindow` props including `{parent, child}` anchors and `offset`; make size required on the window variant; publish `dist` or drop the `import/require` conditions in `xr-platform-contract/package.json`.

viro (fork):
8. Either merge `c10c89c6` into `decax9-three-panel` or change `assert-viro-fork.mjs`'s suggested override to `main`. Optional once step 3 lands, since the app would no longer go through `ViroSpatialSceneProvider`.

Verification gates, in order: `assembleQuestDebug assemblePicoDebug assembleMobileDebug` with `aapt2 dump xmltree`/dex grep showing Meta classes and `MANAGE_APP_VOLUMETRIC_WINDOWS` only in quest; Metro bundle for android succeeds; on a Quest at v207+, `useSpatialWindowState` reports `spatial` for both labels plus a capture; on PICO and phone, both panes render inline.

### 7. Open questions for the user

1. Which Quest and Horizon OS build will be the test device (`adb shell getprop ro.build.version.incremental` / Settings > About)? Promotion needs v207+.
2. Which Viro ref should Harlem-Might native builds use: fork `main` (has the initializer fix and quest-flavor manifest routing) or `decax9-three-panel` (what the assert script names)?
3. Where should `@viro-external/*` come from now that `viro-external-specs-preview` is gone: `~/viro-external` main via `link:`, a git dependency, or a registry publish? This also decides whether mobile can rejoin CI.
4. Is the `harlem-might-tools` window on `SpatialScreen` still wanted, given it would compete for one of the two slots?
5. Should Place Detail use `fallback="inline"` (current SplitView inspector behavior) or `drop` when no place is selected?

Not done in this audit: no build, no prebuild, no device or simulator run, no `pnpm install`. Every "build-tested" claim rests on the 2026-10-03 artifacts in `apps/mobile/android/app/build` or on the expo-pico commit message.
