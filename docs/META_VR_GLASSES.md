# Meta VR Glasses, web AR glasses, and our panel layouts

Written 2026-10-07 from Meta, Callstack, Software Mansion and Snap docs read that day, plus the repos named under Sources.

Status words in this doc mean one thing each:

| Word | Meaning |
|---|---|
| preview | code exists on an unmerged branch or behind a flag |
| concept | design only, no code |
| integration path | code is merged and builds, nothing has run on the target |
| in testing | running on a simulator or a stand-in device |
| verified | passed the 8-point bar in `docs/XR-PLATFORM-MATRIX.md` on the real device |

Nothing in this doc is verified. Nobody on the team has run anything on Meta VR Glasses.

## 1. Scope

In scope:

- Meta VR Glasses: Horizon OS hardware announced at Connect 2026 with eye tracking, hand input and no controllers in the box.
- React Native 2D panels and Viro immersive scenes on that hardware.
- Web AR glasses: Meta IWSDK/WebXR on the glasses, and Snap Specs through a Lens (`specs:scene`) or a WebView.
- How `@viro-external/ui` layouts reach each of those targets.

Out of scope: Meta Ray-Ban Display. It uses the Wearables Device Access Toolkit and display web apps, a separate platform ([Meta blog](https://developers.meta.com/blog/build-for-display-glasses/)).

## 2. What React Native supports today

- Meta VR Glasses run the same OS and SDKs as Quest ([Unity guide](https://developers.meta.com/horizon/llmstxt/documentation/unity/unity-support-meta-vr-glasses.md), [Unreal guide](https://developers.meta.com/horizon/llmstxt/documentation/unreal/unreal-support-meta-vr-glasses.md)). An RN app is an Android app, so it runs as a 2D window on the glasses the same way it does on Quest.
- The Callstack docs for React Native on Horizon OS never mention glasses. They describe "Meta VR devices", name no models, and their examples target Quest (`supportedDevices: "quest2|quest3|quest3s"`, `questDebug`/`questRelease`) ([getting started](https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/), [create first app](https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/create-first-app), [prerequisites](https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/prerequisites), [platform guidelines](https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/platform-guidelines)).
- Tooling is Expo plus `expo-horizon-core`. The plugin adds `mobile` and `quest` flavors (`mobileDebug`, `mobileRelease`, `questDebug`, `questRelease`), strips prohibited permissions, writes the Horizon manifest and sets panel size. A plain `expo run:android` fails as ambiguous, so always pass `--variant` ([expo-horizon-core README](https://github.com/software-mansion-labs/expo-horizon/tree/main/expo-horizon-core)).
- Plugin options: `horizonAppId`, `defaultWidth`, `defaultHeight`, `supportedDevices` (required, pipe-delimited), `disableVrHeadtracking`, `allowBackup` ([README](https://github.com/software-mansion-labs/expo-horizon/tree/main/expo-horizon-core)). `orientation` is not a plugin option. If a sized window shows black bars, set the app's `"orientation"` from `"portrait"` to `"default"` ([create first app](https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/create-first-app)).
- Releases: `questRelease` builds an APK at `android/app/build/outputs/apk/quest/release/`, and EAS uses `:app:assembleQuestRelease`. Upload goes through Meta Quest Developer Hub ([building](https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/releasing/building), [submitting](https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/releasing/submitting)). Neither page covers 64-bit or device targeting.
- Meta VR Layout SDK: `npm install @metavr/layout-compat @metavr/layout-window-compat`. `SpatialSceneProvider` comes from `@metavr/layout-compat` and `SpatialWindow` from `@metavr/layout-window-compat`. The guide uses `useSpatialWindowState` but never shows which package exports it. Placement states are `spatial`, `pending` and `dropped`. "Spatial promotion requires Horizon OS v207 or later. On earlier versions everything falls back inline" ([UI/UX guide](https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/ui-ux)).
- Glasses requirements from Meta:
  - The app binary must be 64-bit. "A binary that contains only 32-bit native libraries cannot run on this device at all" ([app compatibility](https://developers.meta.com/vr/essentials/app-compatibility/)).
  - Windows must handle widths from 360 dp through 1280 dp, and targets must be at least 48 dp ([bring your app](https://developers.meta.com/vr/essentials/bring-your-app-glasses/)).
  - To ship, select **Future devices** under Supported Devices in the Developer Dashboard. Once the hardware ships, an approved Production build that targets Future devices reaches the glasses "without a new APK" ([app compatibility](https://developers.meta.com/vr/essentials/app-compatibility/)).
- Hardware dates come only from a secondary source (secondhand, unverified): announced September 23, 2026, $1,299, ships spring 2027, v207 SDK available now ([dev.to](https://dev.to/techaiwire/meta-vr-glasses-v207-sdk-is-out-hardware-ships-2027-337f)). Meta's own glasses page also says spring 2027 (seen in search results, page not fetched).

## 3. App config

`apps/mobile/app.config.ts`, lines 63 to 93, quoted exactly:

```ts
    [
      'expo-horizon-core',
      {
        // Horizon OS opens a 2D app at phone size unless the activity names a
        // window size; this matches the PICO window below (16:10, landscape).
        defaultWidth: '1280dp',
        defaultHeight: '800dp',
        supportedDevices: 'quest2|questpro|quest3|quest3s',
        disableVrHeadtracking: false,
        allowBackup: false,
      },
    ],
    [
      '@reactvision/react-viro',
      {
        provider: 'reactvision',
        rvApiKey: process.env.EXPO_PUBLIC_REACTVISION_API_KEY,
        rvProjectId: process.env.EXPO_PUBLIC_REACTVISION_PROJECT_ID,
        rvEndpoint: process.env.EXPO_PUBLIC_REACTVISION_ENDPOINT,
        android: {
          xRMode: ['AR', 'QUEST', 'PICO'],
          questAppId:
            process.env.EXPO_PUBLIC_META_QUEST_APP_ID ??
            process.env.META_QUEST_APP_ID,
          metaSpatialLayout: true,
          metaSpatialLayoutBomVersion: '1.2026.0.0',
          metaVrGlassesCompatible: true,
          questArm64Only: true,
        },
      },
    ],
```

Rule: the app config must always set `defaultWidth` and `defaultHeight`. Without them the plugin adds no size ("Not added" in the [README](https://github.com/software-mansion-labs/expo-horizon/tree/main/expo-horizon-core)) and Horizon OS opens the activity as a phone-shaped window.

Why 1280 by 800:

- 1280 dp is the top of Meta's 360 to 1280 dp width range for glasses ([bring your app](https://developers.meta.com/vr/essentials/bring-your-app-glasses/)), so the window opens at the widest size Meta asks us to support.
- 16:10 landscape matches the PICO window, so one layout serves both headsets.
- The user can still resize down to 360 dp, so the layout must reflow and cannot assume 1280. Callstack's own two-pane breakpoint is `TWO_PANE_MIN_WIDTH = 960` ([UI/UX guide](https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/ui-ux)).

Flags in this config:

- **Possible device-target conflict.** `supportedDevices` lists `quest2|questpro`, while `metaVrGlassesCompatible: true` writes Meta's `quest3+` delivery target (per `docs/SPATIAL.md`). Meta's public pages do not mention a `quest3+` value; they describe the dashboard **Future devices** option and the optional `com.meta.store.defaultDeviceTargets` manifest key ([app compatibility](https://developers.meta.com/vr/essentials/app-compatibility/)). Check the merged manifest from a `questRelease` build before upload. This doc does not resolve the conflict.
- `questArm64Only: true` covers the 64-bit requirement for the Viro native libraries. Other native dependencies have not been audited for 32-bit-only `.so` files.
- `expo-horizon-core` is the npm release, 57.0.2 (`apps/mobile/package.json`). It used to resolve from expo-pico's gitignored `.vendor` parity clone, which broke CI.

## 4. Input on glasses

Meta's input model on the glasses is look and pinch: "Eyes are used to target UI elements, and a hand pinch is the primary selection method." The device ships without controllers, and apps "should assume that most people will use look and pinch only" ([Unity guide](https://developers.meta.com/horizon/llmstxt/documentation/unity/unity-support-meta-vr-glasses.md)).

Hover:

- Meta's guidance: "Keep essential actions available without hover" ([bring your app](https://developers.meta.com/vr/essentials/bring-your-app-glasses/)).
- The stronger claim "No hover events. The glasses do not send them, by design" comes from one secondary article (secondhand, unverified) ([dev.to](https://dev.to/techaiwire/meta-vr-glasses-v207-sdk-is-out-hardware-ships-2027-337f)).
- The Callstack UI/UX guide builds hover feedback on `Pressable` `onHoverIn`/`onHoverOut` and says "Hover states are essential in VR" ([UI/UX guide](https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/ui-ux)). That holds on Quest with controllers or hand rays. On glasses, treat `onHoverIn` as a bonus that may never fire.

What to do in our RN screens:

1. Every interactive element needs a resting state that reads as interactive without hover: border, fill or icon.
2. Pressed and selected states carry the feedback. Use hover only to add polish.
3. Tooltips and hover menus become a visible label or a pinch-opened menu.
4. Keep targets at 48 dp or larger, with 8 to 12 dp between them ([UI/UX guide](https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/ui-ux)).
5. Keep Android accessibility info accurate, because "Meta Horizon OS infers gaze targets from the Android views behind React Native components" ([Gaze SDK](https://developers.meta.com/horizon/llmstxt/documentation/android-apps/gaze-and-hands-react-native-sdk.md)) and the system uses it "to identify interactive elements" ([bring your app](https://developers.meta.com/vr/essentials/bring-your-app-glasses/)).
6. A 2D-only app must not request eye-tracking permission ([bring your app](https://developers.meta.com/vr/essentials/bring-your-app-glasses/)).

Gaze SDK (`@metavr/gaze-compat`, wrapper `GazeInteraction`): needs React 18.2.0+, React Native 0.85.0+ and Horizon OS v207. It is unstable and available by request through developer support. "Apps submitted to the Meta Horizon Store with the SDK bundled will be rejected." "Most apps do not need a Gaze SDK to support Look and Pinch" ([Gaze SDK](https://developers.meta.com/horizon/llmstxt/documentation/android-apps/gaze-and-hands-react-native-sdk.md)). We do not plan to bundle it. If we try it, keep it on a branch that never ships to the Store.

## 5. Immersive with Viro

Status: integration path for glasses. In testing on Quest only for the floor and controller work listed below, and the Meta floor default has not run on a headset.

- Routing: `isMetaHorizonXR` decides the Meta immersive path. `isKnownQuest` and model strings are diagnostics only, because compatibility mode can report a Quest identity on newer hardware (`docs/XR-PLATFORM-MATRIX.md`, `docs/SPATIAL.md`).
- Capabilities: with an immersive view active, `getOpenXRRuntimeCapabilities(viewTag)` reports eye gaze, hand tracking, hand aim, passthrough, plane detection, scene understanding, foveation, eye-tracked foveation and local-floor support. Product code feature-detects these and never branches on a headset name.
- Gaze select in the virocore fork: `mikevocalz/virocore` `main` at `5db9550c` (merge of PR #98, `feat/meta-floor-default`) contains PR #96, `land/glasses-gaze-select` (commits `0d0aba1d`, then `e25a676c` ported onto the v3.0.2 base). With no controller aim active and a located gaze pose, a pinch on either hand produces one click on the `EyeGaze` ray. Select ownership runs controller, then a press already in flight, then gaze, then hand. Hand lasers hide while gaze owns select, and the reticle stays.
- `mikevocalz/expo-pico` PR #24, "Quest and Meta VR Glasses: correct floor, controllers, no PICO entries in Quest builds", merged 2026-10-07.
- Spatial windows: `ForkSpatialLayout` detects optional `ViroSpatialSceneProvider`, `ViroSpatialWindow` and layout-support exports in the fork. Quest uses Meta Layout system windows when the fork enables them. PICO falls back to inline windows (`docs/SPATIAL.md`). The config sets `metaSpatialLayout: true` with BOM `1.2026.0.0`.
- Field of view: 70 by 66 degrees nominal, 58 by 54 degrees perceived (p90) ([FOV page](https://developers.meta.com/vr/essentials/field-of-view/)). Panels sized and placed for Quest's wider view will clip. Place immersive panels against the perceived numbers.

## 6. Layouts by target

`@viro-external/ui` on `mikevocalz/viro-external` `main` exports `SpatialPanel`, `PanelHeader`, `PanelButton`, `SpatialScrollView`, `PanelImage` and `VideoPlayerPanel` (checked with `git show origin/main:packages/ui/src/index.ts`). `PanelStack`, `PanelRow`, `PanelLabel`, `PanelSurface`, `PanelBarChart`, `PanelStat`, `toPortableScene` and the `specs:scene` script (`packages/specs/package.json`) exist only on `codex/specs-generated-preview` (head `b94e5c3`, not merged into `main`).

On that branch, `toPortableScene` has mappers (`definePortable`) for `SpatialPanel`, `PanelStack`, `PanelRow`, `PanelLabel`, `PanelText`, `PanelImage`, `PanelSurface`, `PanelBarChart`, `PanelStat` and `RivePanel`. `PanelHeader`, `PanelButton` and `VideoPlayerPanel` have no mapper. `SpatialScrollView` has no mapper of its own; a scroll node appears only when a `SpatialPanel` holds one `PanelStack` taller than the panel.

| Component | Quest / glasses via Viro | Horizon 2D + Layout SDK | IWSDK / WebXR | Specs via `specs:scene` | Specs WebView |
|---|---|---|---|---|---|
| `SpatialPanel` | integration path | concept | concept | preview | concept |
| `PanelHeader` | integration path | concept | concept | concept (no mapper) | concept |
| `PanelButton` | integration path | concept | concept | concept (no mapper) | concept |
| `SpatialScrollView` | integration path | concept | concept | preview (implicit scroll only) | concept |
| `PanelImage` | integration path | concept | concept | preview | concept |
| `VideoPlayerPanel` | integration path | concept | concept | concept (no mapper) | concept |
| `PanelStack`, `PanelRow`, `PanelLabel`, `PanelSurface` | preview | concept | concept | preview | concept |
| `PanelBarChart`, `PanelStat` | preview | concept | concept | preview | concept |

How to read the columns:

- **Quest / glasses via Viro.** The components render inside a Viro scene. On glasses they depend on the fork's gaze select (section 5). Nothing here has run on glasses, and `PanelButton` needs a non-hover resting state before it can.
- **Horizon 2D + Layout SDK.** These are Viro 3D components and cannot render in a plain RN window or a `SpatialWindow`. The 2D route uses ordinary RN screens, and the Layout SDK promotes those into system windows. A shared layout description that compiles to both is a concept.
- **IWSDK / WebXR.** No adapter exists. The portable scene from `toPortableScene` is the likely input, but nobody has written that adapter.
- **Specs via `specs:scene`.** The branch compiles the scene into a snapshot for a Lens Studio runtime bridge. The branch README says a follow-up Lens Studio package must implement SceneObject/UI Kit/SIK mappings and run on the Spectacles simulator or device before it can be called renderer-complete.
- **Specs WebView.** It would need a hosted HTTPS web build of the screen. Nothing exists yet.

## 7. Web AR glasses

### Meta IWSDK on Meta VR Glasses

Status: concept. We have no IWSDK project.

`iwsdk.config.json` for glasses ([IWSDK glasses guide](https://developers.meta.com/horizon/documentation/iwsdk/guides/get-started-glasses/)):

- `world.xr.mode: "vr"`.
- `world.xr.features.handTracking: { "required": true }`. The hand provides the pinch.
- `world.xr.features.gazeTracking: true`. This is optional; without a gaze pose IWSDK falls back to head pointing. Use `{ "required": true }` to fail the session instead.
- `world.features.fieldOfViewMask: true` turns on the built-in glasses view profile. It also works on Quest 3 and 3S in native WebXR.
- `dev.emulator.device` selects the Glasses profile for desktop IWER only.

Interaction: add `RayInteractable` and handle the standard `Hovered` and `Pressed` states. Gaze uses the same targets and events as other ray pointers, so existing ray interactions need no gaze-specific code. `DistanceGrabbable` works with gaze plus pinch. IWSDK synthesizes a `Hovered` state from gaze inside its own scene. That says nothing about Android hover events reaching RN.

Desktop testing: IWER toolbar, **Select input mode**, **Gaze + Hands**. The FOV mask approximates angular coverage only and "does not reproduce lens-edge shape".

### Snap Specs

Two routes, both owned by Lens Studio on the device:

1. **Lens via `specs:scene`** (preview, branch only). Lens Studio owns SceneObjects, UI Kit/SIK, input, materials, camera, permissions and deployment (`docs/XR-PLATFORM-MATRIX.md`). Do not boot ViroCore on the glasses.
2. **WebView** (concept). The WebView script (`InternetModule.createWebView`) needs Lens Studio 5.3.0+, Spectacles OS 5.58.621+ and the Experimental API flag. It loads HTTPS content only, hosted externally, with no HTML loaded from the Lens. Camera and microphone are blocked, and pages that request them fail to load. Resolution caps at 2048 by 2048 and is fixed at init. The platform may suspend it and reload on interaction. It runs on Spectacles only, not in Snapchat or the Lens Studio preview. Snap's page mentions no JS bridge ([WebView](https://developers.snap.com/spectacles/about-spectacles-features/apis/web-view)).
   - Networking from the Lens itself: `fetch` on `InternetModule` (Lens Studio 5.9+). `http` requires Experimental APIs and such Lenses "cannot be published"; HTTPS Lenses can ([Internet access](https://developers.snap.com/spectacles/about-spectacles-features/apis/internet-access)).
   - The Experimental flag that WebView needs is the same one that blocks publishing for `http`. Snap's WebView page does not say whether a WebView Lens can be published. Treat WebView as a dev-only route until confirmed.

## 8. Testing ladder

Each step catches what the one before it cannot. Record results against the 8-point bar at the end.

1. **Meta Spatial Simulator (2D only).** It runs the RN `questDebug` APK as a desktop panel. It is "for 2D Android apps only", so no Viro, OpenXR or Spatial SDK. It reproduces Look and Pinch, which is on by default. Install with `metavr tools install spatialsim`, start with `metavr ssim start`, then `metavr app install <apk>` ([Spatial Simulator](https://developers.meta.com/vr/documentation/android-apps/spatial-sim-overview/), [Callstack testing](https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/testing)). Requirements: API 34+ target and no GMS. Use the device's free-resize mode, or resize the panel, to check 360 to 1280 dp ([bring your app](https://developers.meta.com/vr/essentials/bring-your-app-glasses/)). Note that Meta's January 2026 launch post describes simulated Quest input ([blog](https://developers.meta.com/horizon/blog/meta-spatial-simulator-android-horizon-os/)); the Look and Pinch mode comes from the current docs.
2. **Meta XR Simulator, Meta VR Glasses profile, Look and Pinch input.** Use this for immersive OpenXR builds ([Unity guide](https://developers.meta.com/horizon/llmstxt/documentation/unity/unity-support-meta-vr-glasses.md), [bring your app](https://developers.meta.com/vr/essentials/bring-your-app-glasses/)). Meta documents it for Unity and Unreal. Whether a Viro `questDebug` APK runs under it is untested.
3. **Quest 3S (or Quest 3 / Quest Pro) with `metavr device fov-sim enable`.** It crops to 70 by 66 degrees; add `--perceived` for 58 by 54. Turn it off with `fov-sim disable`. The setting resets on reboot. Check the boundary through the lenses, because casts and screenshots capture the frame before lens distortion, and before Horizon OS v209 compositor layers are not clipped ([FOV page](https://developers.meta.com/vr/essentials/field-of-view/)). Put the controllers down for this pass.
4. **Real Meta VR Glasses.** Not available. "A simulator does not replace testing on a physical device" ([bring your app](https://developers.meta.com/vr/essentials/bring-your-app-glasses/)).
5. **Matrix bar.** A target moves to verified only with all 8 items from `docs/XR-PLATFORM-MATRIX.md` recorded:
   1. exact device/runtime version;
   2. build artifact/commit;
   3. render success;
   4. input success;
   5. permissions/camera/passthrough behavior where applicable;
   6. resize/window behavior for system/spatial windows;
   7. performance baseline;
   8. any unsupported capabilities and fallbacks.

## 9. Open questions

1. Does the merged `questRelease` manifest carry both `quest2|questpro` and the `quest3+` target? Which one does the dashboard honor, and does `quest3+` exist in Meta's public docs at all?
2. Does `useSpatialWindowState` ship in `@metavr/layout-compat` or `@metavr/layout-window-compat`?
3. Do RN `onHoverIn`/`onHoverOut` ever fire on glasses? The Meta primary pages do not say; only a secondary source says no.
4. Does a Viro APK run in Meta XR Simulator with the glasses profile, or is Quest 3S with fov-sim the first useful immersive check?
5. Does the fork's gaze-select owner order hold up when a person picks up a controller mid-session on real glasses?
6. Can a Lens that uses WebView be published, given that WebView needs the Experimental API flag?
7. When does `codex/specs-generated-preview` merge, and who writes mappers for `PanelHeader`, `PanelButton` and `VideoPlayerPanel`?
8. Are any non-Viro native dependencies 32-bit only?

## 10. Sources

Meta, primary:

- https://developers.meta.com/horizon/llmstxt/documentation/unity/unity-support-meta-vr-glasses.md
- https://developers.meta.com/horizon/llmstxt/documentation/unreal/unreal-support-meta-vr-glasses.md
- https://developers.meta.com/horizon/llmstxt/documentation/android-apps/gaze-and-hands-react-native-sdk.md
- https://developers.meta.com/horizon/documentation/iwsdk/guides/get-started-glasses/
- https://developers.meta.com/vr/essentials/app-compatibility/
- https://developers.meta.com/vr/essentials/bring-your-app-glasses/
- https://developers.meta.com/vr/essentials/field-of-view/
- https://developers.meta.com/vr/documentation/android-apps/spatial-sim-overview/
- https://developers.meta.com/horizon/blog/meta-spatial-simulator-android-horizon-os/
- https://developers.meta.com/blog/build-for-display-glasses/ (Ray-Ban Display, out of scope)

React Native on Horizon OS:

- https://oss.callstack.com/react-native-meta-horizon-os
- https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/
- https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/prerequisites
- https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/create-first-app
- https://oss.callstack.com/react-native-meta-horizon-os/docs/getting-started/platform-guidelines
- https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/ui-ux
- https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/testing
- https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/releasing/building
- https://oss.callstack.com/react-native-meta-horizon-os/docs/guides/releasing/submitting
- https://github.com/software-mansion-labs/expo-horizon/tree/main/expo-horizon-core

Snap:

- https://developers.snap.com/spectacles/about-spectacles-features/apis/web-view
- https://developers.snap.com/spectacles/about-spectacles-features/apis/internet-access

Secondary (facts that come only from here are marked secondhand, unverified):

- https://dev.to/techaiwire/meta-vr-glasses-v207-sdk-is-out-hardware-ships-2027-337f

Repos (read-only checks, 2026-10-07):

- `~/Harlem-Might/apps/mobile/app.config.ts`, `docs/XR-PLATFORM-MATRIX.md`, `docs/SPATIAL.md`
- `mikevocalz/viro-external`: `origin/main`, `origin/codex/specs-generated-preview` (`b94e5c3`)
- `mikevocalz/virocore` fork `main` (`5db9550c`; gaze select in `e25a676c`)
- `mikevocalz/expo-pico` PR #24 (merged 2026-10-07T19:43:14Z)
