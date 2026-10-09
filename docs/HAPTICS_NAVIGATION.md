# Harlem Might — Pulsar haptic interaction system

Built on the existing lazy-loaded `@acme/ui/haptics` wrapper; uses
`react-native-pulsar@1.7.0` already pinned to the repo catalog.
Native Pulsar SDK: https://docs.swmansion.com/pulsar/sdk/react-native/

## Vocabulary
- tap → `System.impactLight`, selection → `System.selection`
- successful save / stop → `System.notificationSuccess`
- walk started → `bloom` (calm confirmation)
- approaching turn → `System.impactMedium` (distinct directional cue)
- landmark nearby → `blip` (short low-salience discovery)
- arrived → `bloom` (positive, non-alarm)
- tour complete → `ascent` (completion flourish)
- route changed → `System.notificationWarning`

These are **semantic events**, not timer- or distance-derived automatic
feedback. The caller must confirm that GPS routing produced a reliable
maneuver/arrival; never vibrate when location is stale or permission denied.
Only use familiar cue patterns; direction must also be readable / spoken.

## API
`@acme/ui/haptics` exports the legacy `tap`, `selection`,
`success` and `warning` methods and the new `walkStarted`,
`approachingTurn`, `landmarkNearby`, `arrived`,
`stopConfirmed`, `tourCompleted`, `routeChanged`,
`setEnabled(boolean)` and `setForeground(boolean)`.

The runtime drops cues while disabled or backgrounded and throttles repeats
according to pure policy in `haptic-policy.ts`. A missing native module is a
no-op rather than an app crash. Web stays a no-op.

## Production requirements
- Persist the user's enabled/disabled choice with an approved, non-sensitive
  member preference or local store, apply on startup and provide an in-app
  setting; currently this PR provides the interface, not a settings screen.
- Check reduced motion and system feedback controls without conflating
  animation preferences with haptic preferences.
- Map cue semantics to native `WKInterfaceDevice` (Apple Watch) and Wear OS
  platform feedback. Pulsar's React Native SDK is **not** a watchOS runtime.
- Test real iPhone and Android hardware, including haptics-off, offline
  routes, route updates, duplicate positioning events and VoiceOver/TalkBack.
- No custom pattern may announce an emergency or claim verified arrival.

Resources/skills: Expo Skills; Pulsar SDK docs; Argent Agent Device;
Kinetrell; Impeccable; no-ai-slop; mattpocock TypeScript skills.
