# Phone and shared Take Me There journey (#41)

This is a connected **foreground** journey slice, not a watch-navigation release.
Read alongside `TAKE_ME_THERE_WIDGETS_WATCH.md`, `WATCH_COMPANIONS.md`, and the
paired-companion implementation notes. Hardware and release gates remain open.

## What is connected

- Canonical Explore Place details offer **Take Me There** for a verified, sourced
  point. The existing directions panel, Mapbox provider, route store and map own
  that trip. Place directions do not fabricate a one-stop curated Walk.
- The shared `WalkJourney` component lives in `packages/app/features/journey` and
  is rendered by the existing `WalkScreen`, including its loading/offline states.
  Phone, web and tablet use the same UI primitives, copy and confirmation flow.
  Mobile files only bind content, device capabilities, routing and paired transport.
- Starting a Walk re-reads its published content and constructs ordered canonical
  stop IDs. Each visit and stopping a walk require an explicit confirmation tied
  to the displayed session, stop and revision. GPS arrival is advisory.
- Pause, resume, stop, completion and command retries use `@acme/widgets` commands.
  Repeated starts and uncertain member start responses reuse the same attempt;
  duplicate local command IDs do not apply twice. Revision conflicts show the
  server state and require fresh user intent.
- Native location uses Expo Location **foreground** permission, precise timestamped
  positions and optional true-north heading through the existing navigation
  controller. Cancellation during permission/subscription setup is respected.
  Headsets retain `NO_LOCATION_SOURCE`. Older native binaries without the new module
  can still browse, with location marked unsupported.
- The mobile root owns the location host across Walks, Explore and Viro routes.
  `src/ar/navigationRuntime.ts` now aliases the existing controller instead of
  creating a second controller that writes into the same store.

## Truth and privacy rules

Live progress, turn distance and ETA require fresh accepted GPS, permission still
`granted`, a matching current stop/route, precise matching confidence, no wrong-way
or off-route state, an active session and no known offline state. Missing or stale
sensor input never creates arrival or confirms a visit. A fresh position received
*after* the directions action is required to plan the next stop.

A routed stop requires `locationAccuracy: verified`, a valid source URL and a
non-future source review date no more than **365 days old**. That conservative gate
is `MAX_LOCATION_REVIEW_AGE_MS` in the pure journey model. Records needing review
remain browsable. This repository has no verified entrance field, so the UI says
routes end at the sourced map point and makes no step-free promise.

Native Walk sessions are explicitly **anonymous, local-only** until secure native
member authentication is implemented. The app sandbox's private MMKV instance is
not an app group. Web anonymous sessions use that browser's local storage. The
bounded seven-day cache holds only the walk synopsis, session confirmations and
provider-written route synopsis. It excludes raw GPS, route geometry, origin,
live ETA, account records, tokens and media. Cached instructions are labeled as
saved estimates and are never replayed as live navigation. Storage failures leave
an honestly labeled in-memory session.

The web member transport verifies the actual same-origin Better Auth cookie and
uses the owner-scoped command endpoint. Auth outages do not silently switch a
member to an anonymous session. Member state is never written to the anonymous
cache. Authentication beginning clears private journey UI on all platforms;
web focus/visibility and each command recheck ownership. Account mismatch/revocation
clears the local private view rather than replaying an old owner's command.

## Story and Viro handoff

Stop context comes only from a new public published-story reader result, with a
real publication date, an attributed source URL and a non-future source read date.
Historical source citations do not expire solely because their evidence is old;
the source and story dates remain visible. Stories are not persisted in the offline
cache. Journey excerpts are text-only, so no unreviewed archive or audio assets
are copied into the experience. Full article links retain existing rights-gated
editorial content. No licensed story audio is available in this slice.

The native binding checks the actual `isARSupportedOnDevice()` result before
showing Viro entry. A fresh active route or validated arrival opens the existing
Viro navigation scene and the same route/session. Entering at arrival sets AR
tracking initialization without fabricating another navigation phase or trip.
Camera/tracking failure retains the map/text exit. No AR support or no fresh route
means the published text remains the non-AR experience.

## Optional paired watch

The button explains the title, stop names and instruction being shared and requires
opt-in. The native module allocates a random handoff epoch. Every watch command
must match that epoch, the current session and expected revision before the shared
strict validator receives it. The projection excludes owner, auth, saves and raw
location. Native operations are serialized so a late clear cannot wipe a newer
handoff. Titles are bounded to the wire contract.

Backgrounding, disconnect, sign-in, stop, completion or opt-out revokes the handoff.
A reconnect needs a new explicit opt-in. The foreground refresh expires after 30
seconds if no new projection arrives. A watch command never optimistically confirms
a stop or queues an offline action. There is no independent watch HTTPS login,
background location, ActivityKit, foreground notification, complication or Wear Tile
implementation in this phone slice.

User-action haptics map to actual start/visit/completion changes. Turn, route-change
and arrival cues are deduplicated and require the same current-stop/fresh-GPS truth
gates. The walk preference and foreground state gate every emitted cue. Matching
visual instructions remain available with haptics off. No background haptic loop
or notification permission is introduced.

## Validation and remaining gates

Focused Node tests exercise the public controller, member transport, pure data/cue
policies and injectable Expo adapter:

    node --test packages/app/features/journey/*.test.ts apps/mobile/src/navigation/expoLocationSource.test.ts

Coverage includes cancellation during location setup/auth, denial, coarse/stale GPS,
wrong destination/direction, offline/no-match estimates, revoked/switched owners,
revision conflicts, uncertain start retry, duplicate stop confirmation, refresh
concurrent with a member save, storage corruption/expiry/failure, source dates,
rights-safe story excerpts, haptic opt-out and event deduplication. Pending GPS
requests capture the walk session/revision/current stop and cancel when another
destination is selected or its trip takes over. Pause, stop, clear and timeout release a request-owned
feed before its first fix; an existing device-origin trip can retain its own feed.

Shared app TypeScript and scoped shared/mobile ESLint have been exercised. The
integrating branch must rerun all aggregate checks with the frozen SDK 58 lockfile
and the actual linked Viro/Mapbox forks. No iPhone/Apple Watch, Android/Wear OS,
simulator screenshot, real GPS walk, VoiceOver/TalkBack, permission-settings,
background battery or native Xcode/Gradle build was verified in this environment.
Those are merge gates, not implied by pure tests.

Concurrent PR #56 (`feat/member-session-ui`, reviewed at `46a369e`) uses the same
`/payload-api/auth/get-session` endpoint and exposes a richer member store. This
slice does not duplicate profile UI or import its unmerged store. Once combined,
wire that store's identity/sign-out transitions to `journeyController().clear()`
(and native handoff revocation) immediately; keep the per-command cookie ownership
check. Do not treat a member menu as proof of secure native credential storage.
