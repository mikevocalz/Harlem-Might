# Phone AR placement confidence

The navigation controller owns the trip and the one Viro scene renders it.
This change does not add a location controller, camera, renderer, map provider,
or Payload schema. Compass guidance remains available when Earth cannot localize.

## Provider and accuracy audit

The current native build configures ReactVision and does not opt into ARCore
Earth's SDK/key configuration. Navigation is **compass-only in this build**.
`NAVIGATION_AR_BUILD` in `navArBuild.ts` is shared by Expo's provider configuration,
the Viro wrapper and the scene. Its `earth: 'unconfigured'` guard prevents all Earth
support probes, mode enabling, polling, anchor creation and fix ingestion.
Presence of Viro methods is not evidence that the native build is configured.

The audited Earth path is retained behind an explicit build capability for a
future correctly configured ARCore build. That opt-in must include the native SDK
and existing credential configuration together with `provider: 'arcore'` and
`earth: 'arcore-configured'`; changing the runtime provider alone is insufficient.
No dependencies, credentials or native Google configuration are added here. Only
a configured build proceeds to runtime support/precise-location checks. Phone
platform support remains subject to a real native build and device validation.

Audited dependency sources:

- Viro CI pin: `99b1d87c55ca9f43a6452144183a0b32a2bfb3c9`.
- Nitro Mapbox AR source: `5ef7c59947155f9a2e6565b9263c3f47e124bf49`.
- Viro [`components/AR/ViroARSceneNavigator.tsx`](https://github.com/mikevocalz/viro/blob/99b1d87c55ca9f43a6452144183a0b32a2bfb3c9/components/AR/ViroARSceneNavigator.tsx)
  maps the unified provider to the native cloud and geospatial providers.
- The [Android native module](https://github.com/mikevocalz/viro/blob/99b1d87c55ca9f43a6452144183a0b32a2bfb3c9/android/viro_bridge/src/main/java/com/viromedia/bridge/module/ARSceneNavigatorModule.java)
  copies horizontal, vertical and yaw accuracy directly into the JS pose.
  The [Android navigator](https://github.com/mikevocalz/viro/blob/99b1d87c55ca9f43a6452144183a0b32a2bfb3c9/android/viro_bridge/src/main/java/com/viromedia/bridge/component/VRTARSceneNavigator.java)
  forwards the renderer pose and reports `Enabled`, `Paused`, `Localizing` or `Stopped`.
- The [iOS native navigator](https://github.com/mikevocalz/viro/blob/99b1d87c55ca9f43a6452144183a0b32a2bfb3c9/ios/ViroReact/AR/Views/VRTARSceneNavigator.mm)
  explicitly supports the ARCore Geospatial provider, checks for `GARAPIKey`,
  and copies the same accuracy fields without scaling. No credentials are changed.
- Nitro's [`packages/reactvision/src/bridge.ts`](https://github.com/mikevocalz/nitro-mapbox-ar/blob/5ef7c59947155f9a2e6565b9263c3f47e124bf49/packages/reactvision/src/bridge.ts)
  returns that pose without an accuracy conversion.

[ARCore's GeospatialPose reference](https://developers.google.com/ar/reference/java/com/google/ar/core/GeospatialPose)
defines these intervals at the 68th percentile. The pinned Viro TypeScript
comments saying 95% conflict with this contract; the audited native bridges
contain no conversion. Horizontal radius and yaw pass through unchanged.
For example, 15 m / 19.6° is medium, not high. The location pipeline's
`FilteredPosition.sigmaM` is per-axis uncertainty, but the controller already
converts it to a rounded 68% radius in the legacy `positioning.sigmaM` display
field. `positioningRadius68M` names that boundary explicitly and does not convert
it a second time. The runtime regression sends an 18 m fix through the actual
controller/matcher and compass solver: it remains medium confidence, rather
than being incorrectly inflated to 27.17 m and low confidence.

The shipped renderer AAR/framework is opaque in this checkout. This audit covers
the pinned source bridges and SDK contract, not a native binary reconstruction.
The Viro bridge also omits a native pose timestamp. A bounded request-start time
is recorded, rather than making a delayed reply fresh on receipt. This cannot
prove the age of a pose cached inside the native renderer.

## Evidence required to render

These are conservative app policies, not additional SDK guarantees:

- Camera callback: at most 1 second old and Viro tracking normal.
- Compass heading: at most 1.5 seconds old, medium/high confidence, from phone
  direction. Course over ground cannot calibrate the phone camera's yaw.
- Compass calibration pairs: heading and camera no more than 400 ms apart;
  distinct heading reports only. Expired sample windows cannot settle.
- Matched route position: at most 5 seconds old and medium/high position confidence.
- Earth response: request completed within 1 second, Earth `Enabled`, camera
  fresh, finite valid WGS84 coordinates/altitude and positive accuracy values.
- Earth placement: live Earth evidence at most 3 seconds old, plus a placement
  no more than 20 seconds old. Compass placements also expire after 20 seconds.
- Re-solves: every 10 seconds; compass additionally after 15 m. A comparable
  fresh solve can renew evidence. Rejected candidates cannot refresh old evidence.

The scene publishes the observation clock at 4 Hz even if camera callbacks stop.
World cues therefore disappear on stale camera, heading, route match or Earth
observations. The presented confidence is no higher than its weakest live input;
an estimated height caps the result at medium. Frame id and generation must match
the active controller route before rendering or polling. Arrival markers use the same trust gates as active guidance.
Tracking loss invalidates the previous placement; a new camera callback alone
cannot re-authorize the pre-loss world origin.

## Height is estimated

The route geometry has no elevation profile. Subtracting a fixed 1.4 m from
camera altitude is a visual offset, not measured ground, plane detection, terrain
tracking or pavement alignment. Both current solvers mark their height reference
`estimated-eye-height`.

An approximate floating turn cue can render when horizontal evidence is usable.
The road ribbon, ground chevrons and exact destination marker remain hidden
without a measured ground reference. No current code path produces that reference.
A future ground implementation must provide real surface evidence and device tests;
it must not simply change the discriminator to make those graphics appear.

## Async ownership

The injected polling boundary permits one request at a time. Unmount, route change
and recalibration invalidate pending replies and solves. Native mode setup is
serialized per navigator so a late cancelled enable is disabled before a remount
enables it. Every allocated temporary anchor is released, including partial
failure, second-anchor rejection, cancellation and solve exceptions. One removal
failure does not prevent cleanup of another anchor.

Recalibration preserves the route, along-track progress and acknowledged awareness
notice. It clears placement and observation evidence without remounting Viro.

## Checks

Host checks performed for this scope:

- `cd apps/mobile && node --conditions=react-native --import ./scripts/node-test-resolve.mjs --test src/ar/navAr.test.ts src/ar/navArGeospatial.test.ts src/ar/navAr.store.test.ts src/ar/navArRuntime.test.ts`
- `node --test packages/app/features/navigation/**/*.test.ts`
- `cd apps/mobile && node ../../node_modules/typescript/bin/tsc --noEmit --pretty false`
  passed after the exact pinned fork declarations were made available locally.
- Focused AR scope: 51 tests passed. The integrated working tree passed
  310 mobile tests and 178 navigation-domain tests; each scoped branch is
  rerun separately before publication.

These tests cover real controller-to-compass accuracy, current-build Earth suppression,
freshness/arrival/height gates, anchor cleanup,
late replies, enable/remount ordering, cancellation generations and retry after
localization failure. They do not establish physical placement quality.

Still required on supported Android/iOS phones: native build with existing provider
configuration; outdoor localization and tracking loss; leave/re-enter/background
while requests are pending; moving and stationary recalibration; magnetic
interference, camera pointed down, poor GPS/VPS and real street elevation changes.
No emulator, browser screenshot or host test counts as those hardware checks.

Skills used: pinned `mikevocalz-foldable-layouts` at
`256a97b132803fd2fb8049f7a120cef9cb641f41`, Nitro Mapbox AR, Expo development client,
Margelo API design and Matt Pocock bug diagnosis. Existing native shell and pane
policies are unchanged; this scope is the phone-only renderer adapter.
