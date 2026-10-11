# Harlem Might Wear OS companion

Independent native Jetpack Compose Material 3 wearable project. It intentionally
does not embed React Native, Viro or Expo inside a tiny watch display.

1. Configure `HARLEM_WIDGET_FEED_URL=https://YOUR_PUBLIC_DOMAIN/api/experience/widgets`
   as a Gradle property. The public feed contains no member secrets.
2. Use Google/Android Studio's supported Gradle/JDK 17 install to generate the
   **missing Gradle wrapper** for the pinned AGP version, and build `:app`.
3. Verify UI on round/small Wear OS emulators and actual hardware.
4. Validate the draft foreground Google Play Data Layer handoff in
   [Paired walk transport](../../docs/PAIRED_WALK_TRANSPORT.md). Phone/watch use
   application ID `com.harlemmight.app` and must be signed alike. Former watch
   development installs require reinstalling. Independent authenticated HTTPS,
   encrypted persistence and background guidance remain unimplemented. A public
   API must never include private member locations or auth credentials.
5. Add Tiles / complications via current stable APIs after the base app passes.

Material 3 1.7.1 based on Google's October 7, 2026 stable release.
Gradle + SDK versions must be validated together on the Android build host.
Wear Compose 1.7.x requires compile SDK 37; this project now explicitly uses it.

Avoid health/workout claims and invasive background location collection:
Harlem Might is a cultural guide, not an unconsented activity tracker.
