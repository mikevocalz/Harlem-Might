# Native widgets — implementation and release gates

Stacked on `feat/harlem-take-me-there-shared` (PR #37).

## Targets
- **iOS:** `expo-widgets ~58.0.14`, 4 independent WidgetKit kinds in
  `apps/mobile/widgets/ios`. Targets are configured solely by Expo Widgets.
  **Do not** generate another phone widget target using Apple Targets.
- **Android:** `react-native-android-widget 0.22.1`, four provider kinds;
  widget handler registered next to Expo Router's entry exactly once.
- **Web:** normal Next.js site, widget refresh module is a no-op.
- **Public data:** `GET /api/experience/widgets` uses already published,
  curator-filtered Payload readers. No member credentials, precise location,
  or account-specific saved places in this API.

## Data movement
- The foreground mobile app refreshes `EXPO_PUBLIC_WIDGET_FEED_URL` on
  startup / resume and publishes native snapshots.
- Android also refreshes on provider update; snapshots in MMKV are explicitly
  public and expire after an hour. Stale / failed refresh yields an honest CTA.
- iOS widget components contain `'widget'` as first statement and reference
  only their props and `WidgetEnvironment`. No React hooks or imported
  business logic inside the serialized widget function.
- Walk and saved-place personal cards remain null until an explicitly
  authenticated / on-device handoff is implemented. Do not fake progress.
- All screens keep a useful default destination even without a CMS connection.

## BEFORE MERGE — mandatory blocking checks
1. Generate and commit a refreshed `pnpm-lock.yaml` with the pinned SDK
   versions: `pnpm install --lockfile-only` on Node 24 and pnpm 12.8.1.
   This GitHub-only implementation environment cannot resolve the new packages
   and intentionally does not claim a synchronized lockfile.
2. `pnpm install --frozen-lockfile`, then
   `pnpm --filter @acme/widgets test && pnpm --filter @acme/widgets typecheck`,
   `pnpm --filter mobile typecheck`, `pnpm --filter web typecheck`.
3. `pnpm --filter mobile prebuild`, Xcode build on iOS simulator/device;
   Android emulator + real device build including the correct widget
   provider receivers and Expo Router entry registration.
4. Verify actual native WidgetKit preview and Android launcher resizing on
   Pixel / Samsung; test with React Compiler enabled and source content empty.
5. QA link destinations, VoiceOver/TalkBack, Dynamic Type, Android font
   clipping, light/dark/tinted widgets and content margin variations.
6. Verify entitlements and signing for `group.com.harlemmight.app`.
   App IDs require the production Apple Developer team to provision.
7. Verify that `/stories/[slug]`, `/walks/[slug]` and `/explore?place=...`
   resolve on both web and Expo Router. Fix routing parity before release.
8. Set `EXPO_PUBLIC_WIDGET_FEED_URL` to the deployed HTTPS public route.

## Follow-on
Create a secure user-specific sync channel, watch targets with Apple Targets
and Wear OS Compose, and native navigation feedback. Do not use a widget
timeline for real-time navigation steps (iOS Live Activities/Android foreground
navigation surfaces are a separate phase).

Skills: official Expo Skills; Apple Targets widget/watch/app-intent skill;
Pulsar haptics; Argent Agent Device; mattpocock TypeScript; Impeccable;
no-ai-slop; Kinetrell.
