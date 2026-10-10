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

## Spatial Audio implementation track (PR #52)

The committed `packages/app/features/music/spatial-audio.ts` defines the portable engine API,
listener pose, source positioning and capability reporting. **This is an interface
and a fail-closed adapter, not yet a functioning React Native Audio API engine.**

### Implementation phases

1. Validate the **installed latest compatible stable** `react-native-audio-api` against
   Expo SDK 58 and the app's React Native version. Investigate whether the
   positional `PannerNode` and `AudioListener` APIs are in the shipped package
   rather than only a development branch. Do not silently require unreleased APIs.
2. Add a lazy native adapter in `packages/app/features/music` that uses the
   available `AudioContext`, buffers/media sources, `PannerNode` and listener.
   Enforce user-gesture start, stop/dispose, audio interruptions, volume limiting,
   headphone route changes and one active player at a time.
3. Web adapter: prefer standards-based Web Audio `AudioContext` and `PannerNode`
   behind the same engine contract, gated by browser capability and permissions.
4. Bind listener `position/forward/up` to Viro/OpenXR viewer pose only when
   XR is active; rate-limit updates to the actual render/audio requirements.
   Non-XR offers manual positioning controls and a clearly labeled stereo fallback.
5. Differentiate ordinary 3D panning (including equal-power), HRTF binaural
   rendering and true ambisonics/360 recordings. Set capability flags from the
   **actual backend**; do not claim HRTF or ambisonics if unsupported.
6. Curated standalone audio needs rights/provenance and a public licensed audio
   URL separate from YouTube. YouTube is a standard iframe/player and **its
   streams must not be extracted, intercepted or treated as spatial inputs**.
7. Test iOS, Android, desktop web, Quest/Horizon, PICO and visionOS with speakers
   and headphones, user gestures, backgrounding and device/orientation changes.
   Record what works before enabling the spatial button.

### UI acceptance

- On an artist detail page, show standard embedded YouTube video and a
  separate **Listen in 3D** control only if `getCapabilities().supported`
  is true AND a licensed `SpatialTrack` is available.
- Explicitly describe unsupported playback; no fake 360-audio toggle.
- Turning on one source pauses/stops the other to prevent simultaneous music.
- Use semantic UI package controls and platform haptics; state should live in
  Zustand, not scattered per-frame React updates.
