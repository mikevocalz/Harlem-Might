# Routing and AR navigation

Phase 1 of AR navigation is the route domain: pure TypeScript in
`packages/app/features/navigation/`, with no platform imports. Mobile, web and
the spatial panels all share it. It plans a route, filters GPS, snaps
positions to the route, tracks progress, detects deviation and arrival,
reroutes, and publishes all of it through one Zustand session.

Map UI is Phase 2 and the phone AR view (Viro) is Phase 3. Both read this
domain; neither recomputes a route or draws a straight line to the
destination. The map screens are described in
[AR_NAVIGATION_UX.md](AR_NAVIGATION_UX.md), and what runs on which platform
in [NAVIGATION_PLATFORM_MATRIX.md](NAVIGATION_PLATFORM_MATRIX.md).

## Flow

```
Discover → select place → directions → start → AR view → arrival → explore place
```

## Session phases

`NavigationSession` (`model/session.ts`) is a discriminated union on `phase`.
Each phase carries exactly the data that exists in it.

| Phase | Carries | Enters from |
|---|---|---|
| `idle` | nothing | start, `cancel()` |
| `selectingDestination` | origin | `beginSelection()` |
| `calculatingRoute` | trip, request id | `planRoute()` |
| `routeReady` | trip, routes (best first), selected index | provider answered with routes |
| `navigating` | active trip | `start()`, `exitAR()`, reroute finished |
| `calibratingAR` | active trip | `enterAR()`, AR tracking `relocalizing` |
| `navigatingAR` | active trip | `completeARCalibration()` |
| `rerouting` | active trip, `resumePhase` | confirmed off-route or wrong direction, `reroute()` |
| `paused` | active trip, `resumePhase` | `pause()` |
| `arrived` | active trip, arrival (`confirmed` or `estimated`) | arrival detector |
| `error` | error, trip to retry | provider failure, transit handoff |

An active trip is `origin`, `destination` (with optional `entrance`), `mode`,
`activeRoute` (`route`, `alternatives`, `generation`), `deviation`, `arrival`
and `reroute` status. `generation` goes up by one on every reroute so the map
line and AR chevrons can tell a new route from a re-render.

Transit never gets a route. It ends in `error` with
`kind: 'unsupported-mode'` and Apple/Google Maps links.

Commands that don't fit the current phase return `false` and change nothing.
UI events and GPS events race, so a stale tap must not throw.

## Store

`session/navigationStore.ts` holds five slices that change independently:

- **`session`:** the phase union above.
- **`routeLoading`:** `idle`, `loading`, or `failed`, each with `purpose:
  'initial' | 'reroute'`, so the UI can show a reroute spinner while guidance
  continues.
- **`positioning`:** `acquiring`, `tracking` (with confidence, a rounded 68%
  radius and `isMovingTooFast`), or `lost`.
- **`arTracking`:** `off`, `initializing`, `normal`, `limited` or
  `unavailable`, reported by the AR view.
- **`progress`:** `none`, or `tracking` with a `RouteProgress`.

High-frequency values (the last fix result, the route match, the heading)
live in a separate vanilla store, `navigationFixStore`. Only components that
draw them (the AR scene, the map puck) subscribe. The session is written only
when a phase, deviation kind or arrival kind changes. In the recorded
Apollo → Sylvia's walk, 385 fixes produce fewer than 15 session writes.
`progress` is written only when the active step or the whole-metre distance
remaining changes.

`createNavigationController()` is the only writer. Screens read through the
selectors (`selectPhase`, `selectProgress`, `selectActiveRoute`, …).
`summarizeSession()` returns everything the spec lists for a session in one
object, for the inspector panel.

## Per-fix pipeline

```
LocationFix (raw, never edited)
  → location pipeline   validity, accuracy ≤ 50 m, age ≤ 10 s, skew ≤ 5 s,
                        duplicates, out-of-order, implied speed, χ² gate,
                        4-state Kalman in ENU      → FilteredPosition
  → route matcher       snap if accuracy ≤ 20 m; cost = cross-track
                        + heading + continuity     → RouteMatch
  → progress            step index, distance to next maneuver,
                        remaining distance and time → RouteProgress
  → off-route detector  3 reliable fixes over 3 s beyond max(20 m, r68);
                        4 backward fixes at ≥ 1 m/s → RouteDeviation
  → arrival detector    entrance, 12 m + min(r68, 8 m), 2 fixes;
                        leave beyond 35 m for 3 fixes → ArrivalState
  → reroute controller  1 s debounce, ≥ 8 s apart, abort the older request,
                        deliver only the newest
```

### Location pipeline

`location/locationPipeline.ts` rejects a fix with a named reason (`invalid`,
`inaccurate`, `stale`, `future`, `duplicate`, `out-of-order`, `outlier`,
`implausible-speed`). After three rejections in a row it restarts the filter
at the latest fix, because the person really did move (for example coming up
out of the subway). A manual origin always restarts the filter.

The Kalman filter (`location/kalman.ts`) is a constant-velocity model in
local east/north metres. Process noise follows the white-noise-acceleration
model (Bar-Shalom, Li & Kirubarajan 2001, §6.2.2) with q = 1 m²/s³ for
walking. The measurement variance per axis is (r68 / 1.51)².

The heading smoother (`location/heading.ts`) averages unit vectors, so 359°
and 1° average to 0°. Its gain is time-based, α = 1 − e^(−Δt/τ) with
τ = 0.6 s. Confidence comes from the mean resultant length over the last
10 samples: high at 0.85 or above, medium at 0.6 or above. A change of source
(compass to AR) restarts it. Above 1 m/s the matcher uses course over ground
from the filter velocity instead of the compass, because the compass shows
where the phone points, not where the person walks.

### Matching

`matching/routeMatcher.ts` scores every segment within max(30 m, 3σ):

```
cost = (crossTrack/σ)² + 4·(1 − cos Δheading) + (along-track jump beyond what the person could walk / σ)²
```

The continuity term keeps a fix on the street being walked. On the recorded
U-shaped route (West 125th → Malcolm X Boulevard → West 126th), a fix that
lands 43 m from 126th and 55 m from 125th stays on 125th, because 126th is
480 m further along the route. With no history, the same fix snaps to 126th;
a test pins both outcomes. On the stretch of Malcolm X Boulevard the route
walks twice, the matcher picks the pass the walker is on.

### Progress

Step boundaries are where each maneuver point lies on the geometry
(`progress/routeProgress.ts`). Where the route touches the same point twice,
the provider's cumulative step distances pick the right pass. Remaining time
sums the unwalked part of the active step and every later step's provider
duration, so slow stretches such as crossings keep their real time.

### Rerouting

1. The off-route detector reports `off-route` or `wrong-direction`.
2. The session goes to `rerouting`, remembering `resumePhase`.
3. After the debounce, a request goes out from the filtered position. It
   carries the movement heading as a bearing and the session's destination
   object, so the entrance is always kept.
4. The new route replaces the old one in **one** store write: new
   `activeRoute` with `generation + 1`, deviation reset, progress cleared, and
   the phase back to `resumePhase`. A new matcher and step index are built
   for it.
5. On failure the old route stays, the phase returns to `resumePhase`, and
   `reroute` becomes `failed`. The next confirmed deviation tries again, no
   sooner than 8 s after the last request.

`cancel()` aborts any planning or reroute request and returns both stores to
their initial state.

### Arrival

Arrival is measured from the filtered position to `destination.entrance` when
the place has one. Mapbox's routable point can serve as the entrance until
Payload holds a verified one. At Sylvia's (real fixture data) the door is 10 m
from the CMS point. Standing behind the building puts you 16 m from the CMS
point but 26 m from the door. A
centroid-based detector calls that "arrived"; this one doesn't, and a test
pins it. An arrival from a fix with r68 above 10 m is `estimated`, and a later
precise fix upgrades it to `confirmed`.

## Safety and privacy

- **Driving-speed guard:** filtered speed above 6.7 m/s (24 km/h) for 5 s
  sets `positioning.isMovingTooFast`. The AR view must pause on it.
- Fixes stay in memory in the controller and the transient store. Nothing in
  this package sends location history anywhere. The only network call is the
  route request (origin and destination).
- Headsets have no GPS. `NavigationOrigin` is `device-location`,
  `companion-phone` or a labelled `manual` place, and a manual origin is
  never filtered as if it were moving.

## Thresholds

All thresholds live in `config.ts`, each with its source: the reference-repo
study and the Mapbox Navigation SDK for iOS v2.20.0 constants. Override them
with `createNavigationController({ config: { deviation: { minDistanceM: 25 } } })`.
They have only been tested on traces synthesised from the recorded routes.
They need re-tuning on real recorded walks before they are final.

## Tests

`pnpm --filter @acme/app test` runs the navigation suites alongside the rest
of the app's tests:

| Suite | Covers |
|---|---|
| `geo/geo.test.ts` | ENU parity with nitro-mapbox-ar, round trip, no Mercator, degree-space bias, polyline projection signs |
| `location/location.test.ts` | Kalman convergence and gating, heading wraparound/drift/scatter/source change, every pipeline rejection reason, reset after repeated outliers, speed guard |
| `matching/routeMatcher.test.ts` | snapping on real routes, parallel streets, doubled-back stretch, backward travel, coarse and far fixes |
| `progress/routeProgress.test.ts` | step starts on every fixture, every maneuver in order, turn timing, per-step ETA |
| `deviation/deviationArrival.test.ts` | multi-fix confirmation, accuracy-scaled threshold, unreliable fixes hold, wrong direction, arrival dwell/hysteresis/estimated/confirmed, wrong side of the building |
| `providers/providers.test.ts` | fixtures are token-free, adapter rebuilds each recorded request, parsing, status mapping, network/abort, transit handoff, token handling |
| `reroute/rerouteController.test.ts` | debounce, minimum interval, abort and stale-result dropping, cancel, failures |
| `session/navigationController.test.ts` | full walks on recorded routes: arrival, GPS jump, drift, leaving the route with atomic replacement, wrong direction, failed reroute, cancel, AR phases, pause, speed guard, lost positioning |

## Known gaps

- **Cycling and driving tuning:** at 9 m/s a 90° corner exceeds the walking
  acceleration density, so the filter rejects two fixes and restarts.
  `accelerationDensity` should be set per mode before those modes are used.
- **No real GPS recordings yet:** all traces are synthesised from real route
  geometry.
- **Arrival is terminal:** walking away after `arrived` does not resume
  guidance.
- **Library math is ported, not imported:** the ENU math is a pinned port of
  nitro-mapbox-ar's. `packages/app` cannot import that library in CI today:
  it is a sibling checkout, and Node's test runner cannot resolve its
  extensionless imports. Once it publishes a built package, swap the port for
  the import.
