# AR navigation UX: the map part

Phase 2 of the navigation spec. It covers the directions panel, the route on
the map, the guidance HUD and arrival. The phone AR view is Phase 3 and gets
its own section here when it lands. The domain these screens read is in
[ROUTING_AND_AR_NAVIGATION.md](ROUTING_AND_AR_NAVIGATION.md); what runs where
is in [NAVIGATION_PLATFORM_MATRIX.md](NAVIGATION_PLATFORM_MATRIX.md).

## Flow

```
Place Detail ── Directions ──► Directions panel ── Start ──► Guidance (map + HUD)
     ▲                            │  Back                       │  End
     └────────────────────────────┘                             ▼
                                                           Arrival card
                                                   Place details · Save · End
```

- **Place Detail → Directions.** "Directions" replaces the old external
  "Get directions" link wherever the host passes `onDirections` (mobile) or
  wires the sheet (web). With no host wiring the link still opens Google Maps.
- **Directions panel.** It takes Place Detail's slot: the trailing column on
  tablets and foldables, the sheet on the web, the full screen on a phone.
  There is no second store and no second pane.
- **Start.** Guidance begins on the selected route. Phones bring the map
  forward; wider layouts keep the step list beside the map.
- **End** anywhere (HUD, the step list or the arrival card) cancels the
  session, stops the location feed and returns to Place Detail.

## One session

Every surface reads `useNavigationStore`. Nothing copies the route:

| Surface | Reads | Writes through |
|---|---|---|
| Directions panel | session, routeLoading, progress | `openDirections`, `requestDirections`, `selectRoute`, `startGuidance`, `closeDirections` |
| Map route line | `selectDisplayedRoute(session)`; redraws on `route.id` or `generation` | none |
| Map puck | `navigationFixStore` (match, else filtered fix) | none |
| HUD | session, positioning, progress, routeLoading | `pause`, `resume`, `endNavigation` |
| AR (Phase 3) | the same store | `enterAR`, `completeARCalibration`, `exitAR` |

`features/navigation/view/runtime.ts` holds the one controller. Hosts never
build their own; two controllers would write two sessions into one store.
Screen-only state (chosen mode and origin, the awareness notice, camera
follow, which place's panel is open) lives in `useNavigationUi`, never in the
session.

The per-fix store changes at sensor rate. Only the puck and the walked/ahead
split subscribe to it. The panel subscribes to a boolean ("a device position
exists"), so a GPS fix never re-renders a list.

## Directions panel

Order, top to bottom: header ("Directions to" + place, Back), mode picker,
From/To, the state body.

- **Mode picker.** Walk, Transit, Cycle, Drive. Walking comes first.
  Transit never reaches a provider. It shows "Transit directions open in
  another app" with Apple Maps and Google Maps links and draws no route.
- **From.** "Your location" with a contextual explanation before any prompt:
  *"To start from where you are, allow location. Harlem Might uses it only for
  directions, only while the app is open, and never saves it."* The prompt
  appears only after "Use my location". "Start from a place" lists catalogued
  places with coordinates. A chosen origin is always labelled
  "(chosen, not your location)", and guidance from it says it can't follow
  you.
- **To.** The place name, then the entrance line. The catalogue has no
  entrance records yet, so it reads "No entrance on record. Route ends on
  Malcolm X Boulevard." A verified entrance will read "Verified entrance.
  Main doors on …".
- **Routes are requested automatically** once an origin exists, and again
  when mode or origin changes. There is no "Get route" button to find.

### States

| State | When | Shows |
|---|---|---|
| default | No request yet | From/To, location notice, "Prefer another app?" links |
| loading | `calculatingRoute` | "Finding a walk route…" (polite live region), placeholder bars (`motion-reduce:animate-none`) |
| success | `routeReady` | Duration, distance, "Arrive around", entrance line, route options when there are alternatives (radio group), Start, the AR slot, every step, external links |
| error | `route-failed` | Title and body per failure kind; "Try again" only where retrying can help (not for a missing or refused token, not for an unroutable point) |
| empty | Place has no verified point | "No directions yet" and why |
| offline | Platform says offline, or the request failed on the network | "You're offline"; "Try again" only after a failed request |
| handoff | Transit | The honest "open in another app" |
| guiding | A trip to this place is under way | Time left, End trip, the step list with passed, current and upcoming steps |

Location states in the From row: `unknown` (explain, then ask), `granted`
("Finding your location…" until the first fix), `approximate` (iOS reduced
accuracy or desktop Wi-Fi; the route may start a block off), `denied`
(Settings, or start from a place), `disabled` (services off), `unsupported`
(no location source in this build; the place list opens by itself).

## Map

### Web (Mapbox GL JS, `apps/web/components/explore/ExploreMap.tsx`)

- Route line: gold (`primary`) over a warm-black casing, 5 px, round joins.
  The walked part dims to `rule-rail`. While choosing, alternatives draw
  muted beneath the chosen route. Route layers are added after the basemap,
  so they sit above its POIs (Mapbox cartography guidance).
- The `route` token is cyan. The map uses gold on purpose: the AR spec asks
  for gold/warm guidance, and the map line and AR chevrons must read as one
  route.
- Camera: a new preview or reroute frames the whole route inside the part of
  the map the sheet leaves visible (the same overlap padding selection uses).
  During guidance the camera follows the puck. A drag by the person stops
  following and Recenter appears in the HUD. Reduced motion jumps instead of
  easing.
- Sources update with `setData`. The map instance, layers and the puck
  marker are created once per map and torn down with it.
- The site never requests the camera.

### Mobile (schematic map)

The native street map is still deferred (see the matrix), so the route draws
on the schematic: the session's real route geometry, simplified in metres
(4 m Ramer–Douglas–Peucker), projected into the same fit as the markers. The
fit grows to hold the route, so a route starting outside the catalogue's
corner still lands in the box and the markers move with it. The line is
under the markers so a place stays tappable where the line crosses it. The
caption changes to "Schematic map. The route's shape is real; streets aren't
drawn yet."

## Guidance HUD

Top: the next maneuver as a 48 dp gold tile with the arrow, "In 80 m", the
provider's instruction, and "On West 126th Street". Below it, notices, most
urgent first:

1. Moving too fast: *"You're moving faster than walking pace. If you're in a
   vehicle, stop using guidance until you're on foot."* (`isMovingTooFast`)
2. Reroute failed: keep to the line, or end and plan again.
3. One positioning line: no location ("Guidance can't see your location…"),
   acquiring, lost, or a weak signal with its accuracy.
4. Awareness, dismissible with OK: *"Watch the street, not the screen. Check
   traffic before crossing; directions can be wrong."*

Rerouting comes from the session phase or `routeLoading.purpose ===
'reroute'` and is announced in a polite live region ("Off route. Finding a
new route…", then "New route found."). Pause swaps to Resume.

Bottom bar: time left, "330 m, arrive 5:25 PM", then Recenter (only when the
camera stopped following), Steps (phones), Pause/Resume and End.

The maneuver card fades in when the instruction changes or the route is
replaced (200 ms, `transitionFor` makes it instant under reduced motion).
That is the only non-user-triggered motion on the screen.

## Arrival

`confirmed` and `estimated` are worded differently, as the domain asks:

- Confirmed: "You've arrived at Sylvia's Restaurant". The entrance line
  follows when one is on record.
- Estimated: "You should be near Sylvia's Restaurant", then "Your location
  is approximate, so look around for it."

Actions: Place details (ends the trip and opens the place), Save (mobile;
in-memory until saved places sync, D8), End. The site has no Save, matching
its Place sheet.

## Accessibility

- Targets: `MightsButton` sizes from `useExploreType()`. That is 48 dp
  through hit slop on phones, and 48/60 dp `xr`/`xr-primary` in a Horizon
  window. Step rows, route options and origin rows are `min-h-target`.
- Every icon is decorative. Each step row is one accessible element:
  "Done. / Now. + instruction + distance". Route options are a radio group
  with spoken durations ("Suggested: 7 minutes, 570 m").
- Warnings use `role="alert"`, information `role="status"`. Selection never
  rests on colour: the active step and the chosen route get a 2 px rail.
- The summary is one accessible element with a spoken label ("7 minutes,
  570 m, arriving around 5:28 PM").

## Motion and Rive

- Legend Motion with `transitionFor(useReducedMotion())` for the HUD card
  and the arrival card. Kinetrell is a web-only dependency today (the
  home/site motion system), and no Kinetrell preset exists for sheets or
  cards. Shared components use the same Legend Motion path as the Explore
  panes instead of adding Kinetrell to `@acme/app` (DEFER in the matrix).
- **Rive gaps.** The repo has one `.riv`, a quiz demo
  (`packages/spatial/rive/assets/learning-question.riv`). Nothing fits GPS
  acquiring, calibrating, rerouting or arrival, so those states are text and
  the maneuver glyph. Assets needed: `nav-gps-acquiring`, `nav-rerouting`,
  `nav-arrival` (gold on warm black, a reduced-motion end frame for each).

## References

Mobbin, structure only (cited in the component headers): Fly Delta place
sheet with one filled directions action; Waymo route overview; Garmin Connect
route summary sheet and map controls; Places and Mindtrip external-maps
choice; Oura's quiet GPS status line.
