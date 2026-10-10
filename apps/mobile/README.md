# Harlem Might mobile

Expo SDK 58 app for phones, Meta Quest and PICO. Routes live in `app/`, shared screens come from `@acme/app`.

## Run on Quest

```sh
pnpm --filter mobile quest --install
```

That one command:

1. checks Node 24.15 (`.nvmrc`) and that the Viro fork and the Nitro Rive bridge are installed;
2. regenerates `android/` with `expo prebuild --clean --platform android`;
3. checks the generated project against the Quest/PICO contract (`pnpm spatial:verify-android`);
4. builds `:app:assembleQuestDebug` with `--no-daemon` and fails on Gradle's exit code;
5. reads the APK manifest with `aapt2` and fails on any `pico`/`pvr.` entry or a missing `MANAGE_APP_VOLUMETRIC_WINDOWS`;
6. with `--install`: uninstalls `com.harlemmight.app` (nothing else), installs the APK, starts Metro for this app on a free port (it skips a port held by another project's Metro), runs `adb reverse tcp:8081 tcp:<port>` and opens `harlemmight://explore`.

Leave off `--install` to build and check without a headset. With more than one device attached, add `--serial <adb serial>`. Every step prints one line; a failure prints the fix. Prebuild, Gradle and Metro logs go to `$TMPDIR/harlem-might-quest/`.

### android/ is generated

`android/` is gitignored, the same way the expo-pico example works. Never edit it: the next run deletes it. A native change goes into a config plugin option in `app.config.ts`, or into the plugin package that owns the file (`expo-horizon-core`, `@reactvision/react-viro`, `@expo-pico/core`).

CI cannot run prebuild because the Viro fork is private, so `pnpm spatial:verify-android` in CI checks the plugin options in `app.config.ts`. The generated tree is checked by the quest command on every local build.

There is no PICO build by default. The `@expo-pico/core` block in `app.config.ts` is commented out, so prebuild makes only the `mobile` and `quest` flavors. To add the `pico` flavor, uncomment that block, set `picoAppId` to the app ID from the PICO Developer Console, and add `'PICO'` back to Viro's `xRMode`. Then build with `expo run:android --variant picoDebug`.
