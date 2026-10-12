# Take Me There to phone AR

The existing Place Details → Take Me There → DirectionsPanel flow now exposes **Walk in AR** on a walking route from the device's location. The map guidance HUD exposes the same action. Both use the existing navigation controller, selected route, progress, location feed, and `/explore-ar` route. No route is fetched for AR.

## Entry and cancellation

- The native adapter excludes web, Quest/Horizon, PICO, and visionOS. It checks Viro's actual device support before opening the camera.
- Camera permission is requested only on a button press, using the pinned Viro API with `['camera']`. No microphone, storage, or extra location permission is requested.
- Non-walking routes and manually selected starting points do not offer phone AR.
- A route preview starts through the existing `startGuidance`; an active map walk retains its route and location watcher.
- Both entry buttons share one pending native check. Repeated presses cannot create duplicate prompts or screens.
- A late native result is discarded after cancellation, route replacement, host unmount, or loss of location permission. Denied permission, unsupported devices, and native failures leave the map trip intact. Router failure returns an entered trip to map guidance.

## Checks and platform limits

The 18 entry tests include the real shared navigation runtime, controller, and stores, with only route-provider/native boundaries substituted. They cover selected-route identity, exactly one route request and location watcher, return-to-map, End cleanup, duplicate presses, denied camera, native failure, cancellation, unmount, newer routes, and unsupported travel modes/manual origins.

At the implementation checkpoint: all 595 app tests, app TypeScript, and changed-file ESLint passed. Full mobile type checking is awaiting the pinned private Viro and Viro External sources in hosted CI; the local stock dependency cannot represent that fork. No phone, simulator, or headset was available here. Native camera prompts, visual layout, and physical walking accuracy are not device-verified.

## Skills and preserved contracts

Read repository AGENTS/CLAUDE, the pinned `mikevocalz-foldable-layouts` reference at `256a97b132803fd2fb8049f7a120cef9cb641f41`, Expo Router/native UI, Matt Pocock TDD, Margelo API design, Impeccable, no-ai-slop, and Nitro Mapbox AR guidance. The original Argent/agent-device URL was unavailable; the official Software Mansion Argent Android setup reference was read, and no SDK/device tools were present. Impeccable's context launcher could not write its engine cache; existing repository context was used. CodeRabbit review remains a separate gate.

Existing semantic MightsButton/Text/View, Kinetrell map HUD, Expo Router ownership, native hardware navigation policy, and keep-mounted ExplorePane remain in place. No dependency upgrade, Payload change, new navigation shell, merge, deployment, or live migration is included.
