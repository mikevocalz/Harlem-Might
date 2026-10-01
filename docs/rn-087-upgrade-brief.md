# React Native 0.87 Upgrade Brief

**Date:** August 12, 2026
**Repo:** `solito-nativeui-starter` (pnpm workspace catalog, Expo SDK 57 / RN 0.86.0, Metro 0.84)
**Target:** React Native 0.87 + Metro 0.87
**Decision:** Option A — stay on SDK 57, land the channel-independent work. *(approved)*

> **This revision corrects the previous draft.** The earlier version asserted that the Strict
> TypeScript API was adoptable today on SDK 57 and that WS-1 was therefore channel-independent.
> **That is false for this repo.** See §3 — it was attempted, it failed, and the failure was
> root-caused to a change RN made in 0.87. Everything in §3 is reproduced, not inferred.

---

## 1. Measured exposure to 0.87's breaking changes

Grepped across `apps/*` and `packages/*`, excluding `node_modules`, `.next`, `.turbo`, `dist`, `.expo`.

| 0.87 breaking change | Occurrences | Notes |
| :--- | :--- | :--- |
| Deep imports `react-native/Libraries/*`, `src/private/*` | **0** | Nothing to migrate. No `next.config.ts` alias either — web maps `react-native` → `react-native-web` via Turbopack `resolveAlias`. |
| `InteractionManager` removed | **0** | |
| `ImageBackground` deprecated | **0** | |
| `StatusBar` `backgroundColor`/`translucent`/`networkActivityIndicatorVisible` | **0** | |
| `Modal` `animated`; boolean `keyboardShouldPersistTaps` | **0** | One `keyboardShouldPersistTaps="handled"` in `packages/ui/BottomSheet.tsx` — the *string* form, which is retained. |
| `NativeMethods` / `NativeMethodsMixin` / `Animated.LegacyRef` | **0** | |
| `*Properties` aliases, `*Static` types | **0** | |
| `StyleSheet.absoluteFillObject` | **0** | |
| Codegen deep imports → `CodegenTypes` | **0** | No native modules in-repo. |
| Refs typed with component names | **0** | The 3 `useRef` generics are `StoreApi`, `QueryClient`, `HTMLDivElement`. |
| YAML / `.es6` Metro config | **0** | Plain `metro.config.js`. |
| `useColorScheme()` `'unspecified'` → `null` | **0** | Both call sites test `=== 'dark'`, correct under both. |
| `Appearance.setColorScheme('unspecified')` → `'auto'` | **1** | `packages/theme/switch.native.ts:11`. **Cannot be fixed on 0.86** — see §4. |

**The codebase is effectively clean.** The upgrade risk here is not our source; it is the
dependency stack.

## 2. Expo channel coupling — canary does NOT yet ship RN 0.87

The RN 0.87 release post says 0.87 "will be available as part of the `expo@canary` releases."
**As of August 12, 2026 that has not happened yet.** Verified against npm, two independent
sources:

| Source | `react-native` |
| :--- | :--- |
| `expo@canary` → `58.0.0-canary-20260812-27f94d4`, `bundledNativeModules.json` | **0.86.2** |
| `expo-template-default@canary` (what a fresh SDK 58 project pins) | **0.86.2** |
| `expo@canary` → `58.0.0-canary-20260806-8c2d007` | **0.86.2** |

Expo dist-tags: `latest` and `next` are both `57.0.12`; `canary` is SDK 58 **still on the RN 0.86
line**. There is no Expo channel on RN 0.87 today.

Meanwhile `react-native@0.87.0` is `latest` on npm and `0.88.0-nightly-*` is publishing — but
that is the bare package, not the Expo-integrated stack, and this is an Expo app.

**So "go canary" is not a route to 0.87 right now.** Moving the catalog to canary today would
buy RN 0.86.2 — a patch bump — while costing:

- canary volatility across ~15 `expo-*` packages, on a channel Expo does not call production;
- `react-native-gesture-handler` 2.32.0 → `~3.1.0`, a **major** bump (canary's pin);
- `react-native-reanimated` 4.5.3 → 4.5.1 and `react` 19.2.8 → 19.2.3, both **downgrades** from
  what this repo currently resolves;
- and it would **not** unblock the Strict API, because §3's blocker is `ViewProps` being a type
  alias on the 0.86 line — which 0.86.2 still is.

All cost, no 0.87. Re-check when a canary appears with `react-native: 0.87.x`:

```bash
npm view expo@canary version
npm pack expo@canary && tar -xzOf expo-*.tgz package/bundledNativeModules.json | grep '"react-native"'
```

## 3. The finding that changes the plan: the Strict API is blocked on 0.86

WS-1 was attempted end-to-end following the upstream Strict API migration guide. It was
**reverted**, per that guide's own "Bailing out" procedure.

### What happened

Adding `"customConditions": ["react-native", "react-native-strict-api"]` to the five
RN-consuming tsconfigs took the workspace from **8/8 typecheck green to 3 packages failing with
14 distinct errors** (`@acme/ui`, and cascading into `@acme/app` and `mobile`). Not one error
was in our use of the React Native API. They all came from third-party props derived from
`ViewProps`: `solito` (`SolitoImage`), `expo-image`, `@legendapp/motion`, `@legendapp/list`,
`expo-drag-drop-content-view`.

### Root cause

Under the Strict API on **RN 0.86**, `ViewProps` loses every accessibility prop —
`accessibilityLabel`, `role`, `aria-label`, and the rest:

```ts
import type { ViewProps } from 'react-native';
const v: ViewProps = { accessibilityLabel: 'a' };
// TS2353: 'accessibilityLabel' does not exist in type 'ViewProps'
```

The cause is a declaration-merging collision. NativeWind v5 pulls in
`react-native-css/types.d.ts` (via `nativewind/types`, referenced from every
`nativewind-env.d.ts`), which augments the module:

```ts
declare module "react-native" {
  interface ViewProps { className?: string; cssInterop?: boolean }
}
```

An `interface` can only merge into an `interface`. And the two RN versions differ exactly here:

| | Generated `ViewProps` declaration |
| :--- | :--- |
| **RN 0.86** | `export type ViewProps = Readonly<Omit<...> & ...>` — a **type alias** |
| **RN 0.87** | `export interface ViewProps extends Readonly<Omit<...> & ...>` — an **interface** |

On 0.86 the augmentation cannot merge into a type alias, so it **shadows** it, collapsing
`ViewProps` to `{ className?, cssInterop? }`. Every library type built on `ViewProps` then loses
its real props, which is precisely the 14 errors. RN 0.87 emits props as interfaces, so the
augmentation merges and everything resolves.

### Evidence

Verified in isolated single-file projects (`react-native` tarballs unpacked, identical tsconfig,
`customConditions` on, control property asserted to error in every run):

- RN 0.86 **alone**, no NativeWind: accessibility props **present** → not an RN bug on its own.
- RN 0.86 **+ the NativeWind augmentation**: accessibility props **gone**.
- RN 0.87 **+ the same augmentation**: accessibility props **present**, `className` also accepted.
- Reproduced identically on TypeScript **5.8, 5.9, and the repo's pinned 6.0.3** → the TS 6.0.3
  pin is exonerated; this is not a TypeScript-version interaction.

### Consequence

**WS-1 is not channel-independent for this repo. It is gated on RN 0.87**, i.e. on Expo SDK 58.
The previous draft's claim that "the Strict API isn't a loss, because we can adopt it now" is
wrong: for a NativeWind v5 codebase it is precisely one of the things gained *at* 0.87.

No opt-out was added, and none is needed — the repo simply stays on the legacy types, which is
the RN 0.86 default. The tsconfigs are unchanged from their original state.

Worth reporting upstream to the
[Strict API feedback thread](https://github.com/react-native-community/discussions-and-proposals/discussions/1015):
libraries that augment `react-native` interfaces are silently broken by the Strict API on
0.80–0.86, and the failure surfaces in *user* code, far from its cause.

## 4. What landed (channel-independent)

| Change | File |
| :--- | :--- |
| Node floor declared: `engines.node >= 22.13.0` | `package.json` |
| Floor enforced rather than decorative: `engine-strict=true` | `.npmrc` |
| Single source of truth for the Node version | `.nvmrc` (new, `22.13.0`) |
| CI reads that file instead of the floating `node-version: 22` | `.github/workflows/ci.yml` |
| EAS builds pinned to the same floor via a shared `base` profile | `apps/mobile/eas.json` |
| Dated marker at the one `setColorScheme` call site | `packages/theme/switch.native.ts` |

`turbo typecheck` is **8/8 green** after these changes (verified with `--force`, 0 cached).

The `setColorScheme('unspecified')` → `'auto'` rename is **deferred to WS-5, not skipped**: on
RN 0.86 `ColorSchemeName` is `'light' | 'dark' | 'unspecified'`, so writing `'auto'` today is a
type error. The call site now carries a comment saying so.

## 5. Native dependency matrix

`compileSdk` was read from each library's `android/build.gradle`, not assumed.

| Dependency | Installed | Latest | Android | `compileSdk` source |
| :--- | :--- | :--- | :--- | :--- |
| react-native-gesture-handler | 2.32.0 | **3.1.0** | yes | root `ext` via `safeExtGet` |
| react-native-screens | 4.26.2 | 4.27.0 | yes | `safeExtGet('compileSdkVersion', …)` |
| react-native-safe-area-context | 5.7.0 | 5.9.0 | yes | `getExtOrDefault('compileSdkVersion', …)` |
| react-native-svg | 15.15.4 | 15.15.5 | yes | `safeExtGet('compileSdkVersion', …)` |
| react-native-pulsar | 1.6.1 | 1.7.0 | yes | `getExtOrIntegerDefault('compileSdkVersion')` |
| @expo/ui | 57.0.7 | 57.0.10 | yes | `expo-module-gradle-plugin` |
| expo-image / -font / -splash-screen / -system-ui / -linking | 57.0.x | 57.0.x | yes | `expo-module-gradle-plugin` |
| expo-paste-input, expo-drag-drop-content-view | 0.2.2 / 0.9.2 | same | yes | `expo-module-gradle-plugin` |
| react-native-reanimated | 4.5.3 | 4.5.3 | JS+worklets | — |
| react-native-worklets | 0.10.2 | **0.11.4** | — | — |
| react-native-css, @legendapp/list, @legendapp/motion, solito | — | — | no | — |

**Result: no `minCompileSdk 34` blocker among the direct native dependencies.** Not one library
pins its own `compileSdk`; every one inherits it from the Expo/CNG-generated root
`build.gradle`. So `compileSdk 37` arrives with SDK 58 and the whole tree follows. Residual risk
is transitive AndroidX AARs, which resolve upward with `compileSdk`, not downward.

### Verified by an actual RN 0.87 Android build (§6)

The versions below are **required**, measured by compiling — not by reading peer ranges:

| Dependency | For RN 0.87 | Channel |
| :--- | :--- | :--- |
| react-native-worklets | 0.10.2 → **0.12.0** (`0.83 - 0.87`) | stable (`next` tag) |
| react-native-reanimated | 4.5.3 → **4.6.0-nightly-20260812** | **nightly only** — no stable release supports 0.87 |
| react-native-safe-area-context | 5.7.0 → **5.9.0** | stable |
| gesture-handler, screens, svg, pulsar | **unchanged** | codegen + CMake passed as-is |

Two earlier predictions in this document were wrong and are corrected:

- **gesture-handler 2.32 → 3.x is NOT required.** It was called "the single largest native
  risk"; at 2.32.0 it passed codegen and compiled against RN 0.87 without changes.
- **safe-area-context ≥ 5.8.1 is not a "types-only nicety" to defer.** It is a hard *native*
  requirement: 5.7.0 fails to compile on 0.87 with
  `SafeAreaView.kt:59 Unresolved reference 'uiImplementation'` (an Android UIManager API 0.87
  removed). 5.9.0 rewrites the call to `uiManager.setViewLocalData`. The upstream compatibility
  table flagged this library and was right for a bigger reason than it stated.

## 6. The RN 0.87 Android native build — attempted, and where it dies

`expo export` only proves the JS bundles. A real `expo prebuild` + `expo run:android` against a
physical Pixel 6a was run to test the native layer. It reached **417 Gradle tasks** and stopped
at a defect in React Native's own Android artifact.

### The hard stop: RN 0.87's AAR ships a broken header shim

```text
react-android-0.87.0-debug/prefab/modules/reactnative/include/cxxreact/ErrorUtils.h:10
  warning: Deprecated: use <jserrorhandler/ErrorUtils.h> instead.
ErrorUtils.h:12: fatal error: 'jserrorhandler/ErrorUtils.h' file not found
```

RN 0.87's Android AAR ships exactly three prefab modules — `hermestooling`, `jsi`, `reactnative`
— and the only `ErrorUtils.h` anywhere in the package is that deprecated shim, which forwards to
a header **the artifact does not contain**. Any native module including `cxxreact/ErrorUtils.h`
cannot compile; `expo-modules-core` does. This is an RN packaging defect, not an Expo one, and
there is no workaround short of hand-authoring React Native's missing headers.

### What DID compile against RN 0.87

`react-native-worklets`, `react-native-screens` and `react-native-reanimated` all completed
`buildCMakeDebug[arm64-v8a]`; codegen passed for gesture-handler, svg, pulsar and
safe-area-context. The native stack is closer to ready than the peer ranges suggest — the blocker
is upstream of all of it.

### Nine blockers, and only three were RN 0.87's

| # | Blocker | Owner |
| :--- | :--- | :--- |
| 1 | `expo-template-bare-minimum@sdk-58` dist-tag does not exist; needs `--template …@canary` | Expo canary |
| 2 | Template wrapper ships Gradle 9.3.1; its AGP demands ≥ 9.4.1 | Expo canary |
| 3 | Gradle 9.4.1 embeds Kotlin 2.3.0; Expo's Gradle plugins pin 2.1.20 → `Incompatible classes were found in dependencies` → FIR type-checker crash | Expo |
| 4 | `Cannot add extension with name 'kotlin'` — AGP 9 built-in Kotlin vs `org.jetbrains.kotlin.android` | AGP 9 |
| 5 | `buildConfig` off by default **and** the global `android.defaults.buildfeatures.buildconfig` opt-in removed in AGP 9 — must be set per-module | AGP 9 |
| 6 | Gradle **daemon** inherited the system PATH and spawned Node 26, breaking `stripTypeScriptTypes(mode:'transform')` in `expo-constants:createExpoConfig` | environment |
| 7 | `assertMinimalReactNativeVersionTask` gates in reanimated/worklets | **RN 0.87** |
| 8 | safe-area-context 5.7.0 `Unresolved reference 'uiImplementation'` | **RN 0.87** |
| 9 | `jserrorhandler/ErrorUtils.h` missing from the RN 0.87 AAR | **RN 0.87 packaging** |

### WS-4 corrected: the AGP 9 flags are mandatory, not premature

An earlier revision of this document deferred `android.builtInKotlin=false` and
`android.newDsl=false` as "dead config on AGP 8… premature work that ages into debt." **That was
wrong.** On AGP 9 the build cannot even configure without them (blocker #4). They are now set in
`apps/mobile/android/gradle.properties` with the AGP-10 expiry comment the brief required. The
original WS-4 instruction was correct; only the timing judgement was not.

Blocker #5 additionally requires enabling `buildConfig` **per-module** — the global property was
removed in AGP 9 — done via a `subprojects` block in `apps/mobile/android/build.gradle`.

### Operational trap worth keeping

**`.nvmrc` does not protect Gradle.** The Gradle daemon is long-lived and keeps the environment
of whichever shell first forked it, so it can keep invoking a wrong `node` indefinitely. Run
`./gradlew --stop` after changing Node versions, or the Node floor is silently bypassed.

## 7. Recommendation

Hold Option A. The revised scorecard for waiting:

**Genuinely deferred until SDK 58** — Metro 0.87 (2× faster source maps, half the memory, stable
`metro.config.mts`, package self-resolve), SwiftPM evaluation, **and the Strict TypeScript API**,
which §3 moves out of the "available now" column.

**Cheap to defer** — our Metro config is 8 lines with no hand-written resolution workarounds, so
Metro 0.87's self-resolve cleanup has almost nothing to delete here. The migration surface is one
`setColorScheme` string.

**Already banked** — Node 22 floor, declared and enforced (§4).

**The trigger is not "SDK 58 exists" — it already does, on canary, on RN 0.86.2 (§2).** The
trigger is a canary whose `bundledNativeModules.json` reads `react-native: 0.87.x`. Until then
there is no Expo channel that delivers 0.87, so Options B and C from the original brief are not
merely risky, they are **inert** — they cannot deliver the thing they exist to deliver.

**§6 strengthens this from "risky" to "not currently possible."** Forcing RN 0.87 onto SDK 58
canary was tried end to end. The JS bundles (`expo export`, 2395 modules) and `turbo typecheck`
passes 8/8 — but the Android native build cannot complete, and the final blocker is a missing
header in React Native's own AAR that no amount of project configuration can fix. Until RN ships
an Android artifact containing the `jserrorhandler` headers, RN 0.87 on Android is blocked for
every Expo project, not just this one.

WS-5 then carries: the RN/Metro bump, the Strict API migration (near-free given §1),
**worklets 0.12.0, reanimated ≥ 4.6.0 (nightly today), safe-area-context 5.9.0** (§5, measured —
gesture-handler needs no change), the AGP 9 flags (§6, mandatory), and the `setColorScheme`
rename.

## 8. Reproducing §3

```bash
# 1. Enable the Strict API on the RN-consuming packages
#    (apps/mobile, apps/storybook, packages/{ui,app,theme}):
#    "customConditions": ["react-native", "react-native-strict-api"]
# 2. pnpm turbo typecheck --force --continue   -> 3 packages fail, 14 errors
# 3. Minimal repro of the cause:
cat > probe.ts <<'EOF'
import type { ViewProps } from 'react-native';
export const v: ViewProps = { accessibilityLabel: 'a' };
EOF
# fails on RN 0.86 with nativewind/types loaded; passes on RN 0.87.
```

## 9. Reference links

- [RN 0.87 release post](https://reactnative.dev/blog/2026/08/11/react-native-0.87)
- [Strict TypeScript API](https://reactnative.dev/docs/strict-typescript-api) ·
  [migration guide](https://reactnative.dev/docs/strict-typescript-api#migration-guide) ·
  [opting out](https://reactnative.dev/docs/strict-typescript-api#opting-out-since-087)
- [Moving Towards a Stable JavaScript API](https://reactnative.dev/blog/2025/06/12/moving-towards-a-stable-javascript-api)
- [Strict API feedback thread](https://github.com/react-native-community/discussions-and-proposals/discussions/1015)
- [Metro configuration](https://metrobundler.dev/docs/configuration/) · [Metro releases](https://github.com/react/metro/releases)
- [SwiftPM RFC #0994](https://github.com/react-native-community/discussions-and-proposals/pull/994) ·
  [AGP 9 RFC #1006](https://github.com/react-native-community/discussions-and-proposals/pull/1006) ·
  [AGP 9.0 release notes](https://developer.android.com/build/releases/agp-9-0-0-release-notes)
- [Upgrade Helper](https://react-native-community.github.io/upgrade-helper/) · [Upgrading docs](https://reactnative.dev/docs/upgrading)

WS-1 followed the upstream Strict API migration guide steps 1–5 and then its documented
"Bailing out" path; no parallel migration was hand-rolled.
