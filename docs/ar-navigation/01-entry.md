# Take Me There to walking AR

The existing Place Details → Take Me There → DirectionsPanel flow exposes **Walk in AR** on a walking route from the device's location. The map guidance HUD exposes the same action. Both keep the existing controller, selected route, progress and location feed. No route is fetched for AR.

## Cross-platform entry and shell

- iOS and Android use the existing ReactVision `ViroARSceneNavigator`. Entry checks Viro's actual native AR support and camera permission, not an Android-only device-family module. Web, Quest/Horizon, PICO and visionOS remain outside this walking-AR build path; their existing experiences are unchanged.
- Walking AR mounts inside Explore's permanent map region. Existing Expo Router ownership, tabs/right rail, Discover and Detail `ExplorePane` instances remain in place. There is no new navigator, hardware classifier, width-based device guess or Apple capability bridge.
- The native map remains mounted underneath AR but is hidden from touch and accessibility. Resizing changes pane styles and HUD clearance, not the AR visit or selected trip. The existing trailing Detail overlay reserves its actual width in the AR HUD; shell safe-area/rail space is not consumed twice.
- A legacy `/explore-ar` walking visit redirects to Explore without attaching a second navigation owner or mounting tabletop. The same root route continues to own existing tabletop/street experiences.
- Camera-only permission is requested on explicit press through the pinned Viro API. No microphone, storage or extra location prompt is added. Non-walking routes and manually selected starting points do not offer walking AR.
- A preview starts through the existing `startGuidance`; an active map walk retains its route and location watcher. Both buttons share one pending native check.
- Late native results are discarded after cancellation, route replacement, unmount, tab blur, app backgrounding or location-permission loss. Denial and unsupported/native preflight failures preserve the map trip. An AR refusal after guidance starts reports unavailability and keeps that map walk active; failure opening the host also restores map guidance.

## Visit and camera lifetime

The map-return intent is committed before opening AR, including rotation during a native prompt. Back and hardware Back leave AR before handling Detail/Discover and preserve the walk. Arrival opens the existing destination Detail intent. Tab departure or a compact Detail/Discover screen closes the AR visit and releases its camera, without ending the trip.

App backgrounding releases only the native camera, preserving the latched HUD/paused-trip intent. Camera attach and detach invalidate the previous native-world placement, so a new Viro world must calibrate again. Shared `resumeGuidance` restores a paused device-origin location watch with already-granted permission. Map and AR HUDs use that same action.

## Validation and physical acceptance

The 25 entry tests use the real shared runtime, controller and stores, substituting only routing/native boundaries. They cover route identity, one route request/watch, map return, End, duplicate presses, denied camera, native failure, delayed permission cancellation, tab blur, unsupported modes/manual origins and a refused AR transition after guidance starts. Host/visit/camera regressions cover backgrounding, tab departure, hidden compact maps, overlay clearance, resize identity and stale cleanup.

Mobile typing uses exact, blob-verified declarations/source from the CI-pinned Viro forks. Hosted CI runs the full repository checks; current head results are linked in the PR. These are not device tests. No phone, simulator or headset was available. Before release, validate supported iOS and Android builds, native camera prompts, background/reentry, actual fold/rotation geometry, physical-right rail in RTL, large text, screen-reader focus and outdoor walking/arrival. The existing shell's hardware-detection limits remain; AR does not claim new hinge geometry support.

## Preserved contracts

Read repository AGENTS/CLAUDE, the pinned `mikevocalz-foldable-layouts` reference at `256a97b132803fd2fb8049f7a120cef9cb641f41`, Expo/native UI, Matt Pocock TDD, Margelo API, Impeccable, no-ai-slop and Nitro Mapbox AR guidance. Existing semantic UI, Kinetrell, Viro/Mapbox and Payload remain in use. No dependency upgrade, credential change, deployment or live migration is included.
