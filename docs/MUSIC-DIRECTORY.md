# Music directory — implementation and verification

This feature is an editorial catalog in Payload's Postgres schema, not a second database. A profile is **draft-only until biography, Harlem relationship, photo provenance and YouTube video ID have been verified**. Rights-cleared Payload/Commons portraits are preferred. When a rights-cleared portrait is not available, the public UI may display a pre-approved **external artist-profile reference image** with visible source attribution; that image is not copied into Payload, is never described as licensed, and must disappear rather than fall back to unrelated/generic imagery if its source cannot be verified.

## Photo selection boundary

Public photo metadata comes from `reviewed-artist-photo.ts` and its deterministic reviewed catalogue. Both public GET routes first restrict requests to published artists; unknown names do not trigger fuzzy search or changing upstream profile discovery. The image proxy retrieves only the selected external reference through Payload's bounded, DNS-validated photo fetcher. Neither GET writes media or changes artist records.

`artist-photo.ts` retains the shared result contract, name normalization, response validation, provider labels and image props used by web and native UI. Rights checks and proxy fetching remain separate live boundaries. The old Wikipedia/Commons/profile discovery engines and their uncalled Next metadata cache were retired after [the public route migration](https://github.com/mikevocalz/Harlem-Might/commit/cc8df13fdf926fc0bc2d75bb2ea1c2916e91f259). New source choices require explicit editorial review and preserved attribution; a page view must not rediscover or ingest them.

## Cross-platform requirements
- Put **Music** in the existing mobile navigation rail and desktop header, linking to /music; retain overflow behavior on narrow screens.
- List cards show a real photo of the artist, name, genre and short bio. Prefer a rights-cleared Payload/Commons portrait; otherwise an approved external reference photo must show its provenance and rights status. Full profile route /music/[slug] shows the same real artist photo, full biography, credited sources and featured song. Video thumbnails, album art and generic Harlem photos are never portrait fallbacks.
- Prefer `react-native-youtube-bridge` (which supports iOS, Android **and web** via a YouTube iframe) as a shared component behind packages/ui. Check npm latest and peer compatibility before installation. Do not maintain an independent raw DOM iframe outside the UI boundary.
- YouTube streams **cannot be extracted or rerouted** into arbitrary Web Audio/React Native Audio API spatial nodes using the normal iframe API. Provide standard embedded playback, with user-controlled spatial ambience or separately licensed audio files as an *independent* optional HRTF path; do not label embedded YouTube as 360°.
- For spatial audio, research React Native Audio API and supported node graph/panner on every target (web, iOS, Android, Quest/PICO, visionOS). Provide capabilities and honest fallback badges. Keep a single playing media source with explicit audio-focus behavior.
- Preserve user gesture requirements and YouTube player terms; verify allow-embed for each selected official upload.

## Data governance
- The [candidates file](../packages/payload/src/maintenance/data/music-artist-candidates.ts) lists artists from the discussion, **including scene-only visitors**; it is not a verified import of 100+ completed profiles.
- Curators verify birth/raised/residency relationships and use the scene value for visitors rather than mislabeling them as Harlem-born.
- Store one verified official YouTube watch/share URL per artist; ensure public embeds work; skip unavailable videos rather than fabricating IDs.
- Apply rights, attribution and source information for every artist photo. Rights-cleared media is stored in Payload. External reference photos remain remote, link back to their provider/editorial source, are explicitly marked as external references, and are not represented as locally licensed assets.

## Dependency audit
Run `pnpm outdated -r`, inspect latest stable npm tags (not canary/RC), and update central `pnpm-workspace.yaml` catalog and lockfile with compatible versions. In particular, verify Expo SDK + RN pairing, Viro/native forks, Skia, Rive, Kinetrell, Payload, Solito and YouTube bridge. Run install, typecheck, lint, tests and relevant platform build checks before claiming complete.

## Spatial Audio implementation track (PR #52)

The committed `packages/app/features/music/spatial-audio.ts` defines the portable engine API,
listener pose, source positioning and capability reporting. **This is an interface
and a fail-closed adapter, not yet a functioning React Native Audio API engine.**

The optional browser adapter is not currently wired to a production caller.
Its pending play requests are cancelled by pause, stop, dispose or a newer play;
cancelled work settles without reporting obsolete playback failures. Current
playback failures still reject. Tests drive the actual adapter with controllable
browser API leaves, including late media settlement and same-element reuse:
`node --test packages/app/features/music/spatial-audio.web.test.ts`.
These tests do not validate audible output, browser autoplay policy or device audio.

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

## Responsive artist detail and vinyl XR (approved)

### Screen architecture
- Public web: `apps/web/app/(site)/music/[slug]/page.tsx`; native Expo Router: `apps/mobile/app/(tabs)/music/[slug].tsx` (or nested Stack detail under Music tab).
- Reuse one domain layer under `packages/app/features/music`: `MusicArtistDetailScreen`, `MusicArtistSplitView`, `MusicYouTubePanel`, `PlayInXRButton` and `MusicArtistStore` (Zustand). Product UI must use `@acme/ui` semantic components, no raw HTML outside platform adapters.
- Tablet/desktop/expanded foldable: actual two-pane split layout, typically 42/58, resizable where existing split-view primitives support it. Left: headshot, artist name, genre/era, Harlem connection, short facts, full sourced biography; right: 16:9 YouTube player, *Play in XR* immediately below, track metadata, credited album art and appropriate unavailable-state.
- Phone / narrow foldables: stacked left then right, deep-linkable, keyboard/screen reader safe. For tabletop foldable posture respect hinge and do not span interactive media across the crease.
- XR action is enabled when device XR presentation works AND a 3D playback-compatible source is available. Video-only artists keep a standard video player. Do not present playing a YouTube iframe as spatial audio.
- One transport/audio focus owner: suspend embedded YouTube when entering XR, restore previous page position and player intent safely when exiting. No autoplay.

### Viro tabletop vinyl record player
- Shared `VinylTurntableXRScene` loaded through existing Viro spatial scene router. Native/Meta/PICO/visionOS use fork-supported Viro/OpenXR; web uses existing Viro web renderer if supported.
- World-locked table-height turntable with a base, spinning platter/record mesh, physically centered round record-label UV, and independently rigged tonearm. Use the CC0 Direct Spin candidate only after downloading, inspecting GLB mesh topology and verifying license: https://www.innerscene.com/tools/library/3d-parts/direct-spin-dj-turntable-ae143e16
- Texture at disc center uses **licensed album artwork** from the artist's `albumArt` media relation; UV clipping must be circular, correctly oriented and not stretched. Fall back to a tasteful generated text/graphic label when no rights-cleared art is available.
- 33⅓ RPM default (or explicit 45 RPM where recorded). Couple phase to authoritative playing time and elapsed playback time rather than frame count; stop on pause; accelerate/decelerate naturally; on pause/exit, lift tonearm and dispose media listeners, nodes and controllers.
- Add a **Go Back** control as a reachable, right-side world-locked XR panel with hand/controller/gaze activation and an accessible non-XR equivalent. Button closes the immersive scene and returns to the originating artist URL, preserving navigation stack and history; never trap users in XR.
- Other controls: Play/Pause, Restart, Volume, and optional spatial source positioning if source supports the engine. Show subtitles for instructions and no-motion alternatives for motion sensitivity.
- Stereo YouTube playback remains on profile page; separately licensed audio file with provenance is spatialized via the engine. True ambisonic 360 playback is allowed only when the engine actually decodes ambisonics; a rotating model does not imply 360 sound.

### Payload additions
Extend `music-artists` with `albumArt` (upload → media), `featuredAlbumTitle`, `spatialTrackUrl` (HTTPS), `spatialTrackLicenseSourceUrl`, `spatialTrackFormat` (mono/stereo/ambisonic), `vinylRpm` (33⅓/45), `xrSceneEnabled` (default false). Public XR play availability must require full licensing, valid media and platform support.

### Engineering steps
1. Connect a published-only Payload music reader to the shared content transport, preserve data unavailable/empty/error states; generate types and DB migration.
2. Implement shared list/artist detail routes, rails/header (existing shared route registry), and split-view semantics/accessibility.
3. Integrate cross-platform YouTube bridge with safe watch URLs and player lifecycle.
4. Inspect chosen free turntable GLB and its license, rig platter/tonearm/label; do not commit third-party assets unless rights and provenance have been verified.
5. Wire XR scene lifecycle, music metadata, texture loading, media transport, animation and return navigation.
6. Bind headtracked listener to Viro viewer pose for a separately licensed spatial audio recording; capability gate true HRTF/ambisonics.
7. Audit npm latest compatible catalog+lock, test web/iOS/Android/tablet/foldables/headsets and add regression coverage before declaring ready.

### Acceptance criteria
- [ ] 2-pane details on wide layouts, stacked on phone, hinge-safe on foldables.
- [ ] Verified headshot/bio left; usable YouTube player right; Play in XR button below.
- [ ] Button opens world-locked turntable scene; center record label displays album image; platter/tonearm follow actual playback.
- [ ] In-scene right-hand Go Back returns to the originating profile with navigation history intact.
- [ ] Audio is spatial only when backed by correctly licensed files and verified rendering capabilities; never scrape YouTube.
- [ ] Missing media, permissions, audio output and XR capabilities degrade gracefully.
- [ ] App builds, accessible interactions pass, required CI green.
