# Finish AR HUD recovery and arrival

Implemented on top of #69 and #70, using the shared trip, existing Explore shell and one Viro walking renderer.

- Keep one experience per AR route visit. End, unavailable camera or arrival never accidentally open a tabletop renderer. Ownership guards protect a newer visit from old asynchronous cleanup; Strict Mode effect replay is safe.
- Back/hardware Back preserves the walk and restores compact map intent. Arrival ends the watch and opens destination Detail with map as the return pane.
- Release the camera when navigation no longer requires it. Unsupported/non-phone direct entries suppress camera and return to the existing map shell.
- Recalibrate without refetching the route; pause/resume through the shared runtime; offer reroute retry, End and map return. Speed, GPS, camera and heading recovery have actionable text.
- A separate Check walking pace action resolves a speed-pause/background deadlock. It checks current native permission and revalidates foreground, mounted lifetime, exact session/source and newer denial events before restarting one watch. Guidance stays paused until an explicit Resume; fresh high-speed readings keep it paused.
- Direction arrows require fresh matched position and actual phone heading, never course over ground. Text communicates left/right/ahead/behind independently of the decorative arrow.
- Distinguish estimated arrival and placement. Current build is compass/VIO-only, and estimated height never claims measured pavement.
- Shared semantic controls provide 48 dp minimum targets, wrapping labels, scrollable content and safe-area padding. Native large-text and screen-reader acceptance still requires devices.

## Hardware scope

Walking AR uses the existing Viro iOS/Android support check and stays inside Explore's map region, retaining existing tabs/right rail and pane identities. The map remains mounted but hidden from input/accessibility. HUD residual insets reserve the existing Detail overlay without double-consuming shell safe areas. Tab departure or hiding the compact map closes AR; backgrounding releases only the camera and resets its old-world placement before restart. No hardware classifier, invented hinge geometry, duplicate rail/router or new Apple bridge is introduced. Existing shell detection limits and physical fold/rotation acceptance remain documented in 01-entry.md.

## Checks

Pure recovery and real-store visit/compact-pane regressions cover stale direction, camera/GPS recovery, pause, End watcher cleanup, exit intent, late cleanup, new visits, and Strict Mode replay. See the PR for exact isolated-branch test/type/lint and hosted CI results. No native device or emulator was available; camera lifecycle, screen-reader order, large text, outdoor walking and physical arrival remain acceptance items. CodeRabbit skips drafts; independent local review was performed. No merge, deployment, credential change, Payload change or live migration.
