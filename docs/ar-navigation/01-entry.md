# Take Me There to phone AR

The existing Place Details → Take Me There → DirectionsPanel flow now exposes **Walk in AR** on a walking route from the device's location. The map guidance HUD exposes the same action. Both use the existing navigation controller, selected route, progress, location feed, and `/explore-ar` route. No route is fetched for AR.

## Entry and cancellation

- The native adapter requires ordinary-phone capability evidence and excludes tablets, foldables, missing Android capability data, measured Apple hardware columns, web, Quest/Horizon, PICO, and visionOS. The existing Android device-family detection gaps remain; no width or model heuristic is added. It checks Viro's actual device support before opening the camera.
- Camera permission is requested only on a button press, using the pinned Viro API with `['camera']`. No microphone, storage, or extra location permission is requested.
- Non-walking routes and manually selected starting points do not offer phone AR.
- A route preview starts through the existing `startGuidance`; an active map walk retains its route and location watcher.
- Both entry buttons share one pending native check. Repeated presses cannot create duplicate prompts or screens.
- A late native result is discarded after cancellation, route replacement, host unmount, app backgrounding, loss of location permission, or newly detected non-phone layout. Denied permission, unsupported devices, and native failures leave the map trip intact. Router failure returns an entered trip to map guidance.

The shared foreground `resumeGuidance` action restarts a paused device-origin watch after backgrounding, only with existing location permission. Map and AR HUDs use the same action; manual origins and denied permission cannot start a new watch.

## Checks and platform limits

The 20 entry tests include the real shared navigation runtime, controller, and stores, with only route-provider/native boundaries substituted. They cover selected-route identity, exactly one route request and location watcher, return-to-map, End cleanup, duplicate presses, denied camera, native failure, cancellation, unmount, newer routes, and unsupported travel modes/manual origins.

Entry, hardware-capability and real-runtime resume regressions run alongside the full app/mobile suites. Mobile typing uses exact, blob-verified declarations/source from the CI-pinned Viro and Viro External forks, not the public stock package. The initial implemented head also passed hosted full CI; the PR reports results for the latest head. No phone, simulator, or headset was available here. Native camera prompts, visual layout, and physical walking accuracy are not device-verified.

## Skills and preserved contracts

Read repository AGENTS/CLAUDE, the pinned `mikevocalz-foldable-layouts` reference at `256a97b132803fd2fb8049f7a120cef9cb641f41`, Expo Router/native UI, Matt Pocock TDD, Margelo API design, Impeccable, no-ai-slop, and Nitro Mapbox AR guidance. The original Argent/agent-device URL was unavailable; the official Software Mansion Argent Android setup reference was read, and no SDK/device tools were present. Impeccable's context launcher could not write its engine cache; existing repository context was used. The independent local review found and drove the hardware gate and paused-watch recovery fixes. CodeRabbit skips drafts; its success status is not a substantive review.

Existing semantic MightsButton/Text/View, Kinetrell map HUD, and Expo Router ownership remain in place. Tablets/foldables stay in the existing map shell with their physical-right rail and keep-mounted ExplorePane because this root AR route cannot satisfy their shell or hinge contract. Ordinary phones use the existing full-screen AR route. No dependency upgrade, Payload change, new navigation shell, merge, deployment, or live migration is included.
