# Finish AR HUD recovery and arrival

Implemented on top of #69 and #70, using the shared trip, existing /explore-ar route and one Viro renderer.

- Keep one experience per AR route visit. End, unavailable camera or arrival never accidentally open a tabletop renderer. Ownership guards protect a newer visit from old asynchronous cleanup; Strict Mode effect replay is safe.
- Back/hardware Back preserves the walk and restores compact map intent. Arrival ends the watch and opens destination Detail with map as the return pane.
- Release the camera when navigation no longer requires it. Unsupported/non-phone direct entries suppress camera and return to the existing map shell.
- Recalibrate without refetching the route; pause/resume through the shared runtime; offer reroute retry, End and map return. Speed, GPS, camera and heading recovery have actionable text.
- A separate Check walking pace action resolves a speed-pause/background deadlock. It checks current native permission and revalidates foreground, mounted lifetime, exact session/source and newer denial events before restarting one watch. Guidance stays paused until an explicit Resume; fresh high-speed readings keep it paused.
- Direction arrows require fresh matched position and actual phone heading, never course over ground. Text communicates left/right/ahead/behind independently of the decorative arrow.
- Distinguish estimated arrival and placement. Current build is compass/VIO-only, and estimated height never claims measured pavement.
- Shared semantic controls provide 48 dp minimum targets, wrapping labels, scrollable content and safe-area padding. Native large-text and screen-reader acceptance still requires devices.

## Hardware scope

The current bridge exposes device-family booleans, not live hinge geometry. The new walking-AR entry is Android-only in current builds, gated to positively resolved ordinary Android phones. iOS remains on the existing map until its mounted native capability bridge is implemented and validated; see 01-entry.md for the Apple API path. Tablets, foldables, unknown Android capability, measured Apple hardware columns and headsets retain existing map/rail/pane behavior. Existing Android detection gaps remain explicit. No invented hinge measurements or duplicate rail/router are added.

## Checks

Pure recovery and real-store visit/compact-pane regressions cover stale direction, camera/GPS recovery, pause, End watcher cleanup, exit intent, late cleanup, new visits, and Strict Mode replay. See the PR for exact isolated-branch test/type/lint and hosted CI results. No native device or emulator was available; camera lifecycle, screen-reader order, large text, outdoor walking and physical arrival remain acceptance items. CodeRabbit skips drafts; independent local review was performed. No merge, deployment, credential change, Payload change or live migration.
