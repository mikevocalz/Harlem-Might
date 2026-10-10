# Music directory — implementation and verification

This feature is an editorial catalog in Payload's Postgres schema, not a second database. A profile is **draft-only until biography, Harlem relationship, image rights and YouTube video ID have been verified**.

## Cross-platform requirements
- Put **Music** in the existing mobile navigation rail and desktop header, linking to /music; retain overflow behavior on narrow screens.
- List cards show licensed portrait, name, genre and short bio. Full profile route /music/[slug] shows licensed portrait, full biography, credited sources and featured song.
- Prefer `react-native-youtube-bridge` (which supports iOS, Android **and web** via a YouTube iframe) as a shared component behind packages/ui. Check npm latest and peer compatibility before installation. Do not maintain an independent raw DOM iframe outside the UI boundary.
- YouTube streams **cannot be extracted or rerouted** into arbitrary Web Audio/React Native Audio API spatial nodes using the normal iframe API. Provide standard embedded playback, with user-controlled spatial ambience or separately licensed audio files as an *independent* optional HRTF path; do not label embedded YouTube as 360°.
- For spatial audio, research React Native Audio API and supported node graph/panner on every target (web, iOS, Android, Quest/PICO, visionOS). Provide capabilities and honest fallback badges. Keep a single playing media source with explicit audio-focus behavior.
- Preserve user gesture requirements and YouTube player terms; verify allow-embed for each selected official upload.

## Data governance
- The candidates file lists artists from the discussion, **including scene-only visitors**; it is not a verified import of 100+ completed profiles.
- Curators verify birth/raised/residency relationships and use the scene value for visitors rather than mislabeling them as Harlem-born.
- Store one verified official YouTube watch/share URL per artist; ensure public embeds work; skip unavailable videos rather than fabricating IDs.
- Apply rights, attribution and source information for each portrait.

## Dependency audit
Run `pnpm outdated -r`, inspect latest stable npm tags (not canary/RC), and update central `pnpm-workspace.yaml` catalog and lockfile with compatible versions. In particular, verify Expo SDK + RN pairing, Viro/native forks, Skia, Rive, Kinetrell, Payload, Solito and YouTube bridge. Run install, typecheck, lint, tests and relevant platform build checks before claiming complete.
