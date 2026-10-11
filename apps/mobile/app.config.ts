import type { ExpoConfig } from 'expo/config';
import { loadProjectEnv } from '@expo/env';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette } from '@acme/theme';

const appDir = dirname(fileURLToPath(import.meta.url));
loadProjectEnv(join(appDir, '../..'), { silent: true, force: true });

const config: ExpoConfig = {
  name: 'Harlem Might',
  slug: 'harlem-might',
  scheme: 'harlemmight',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  // Dark only, like the site (DECISIONS S14). Light tokens stay in @acme/theme, unused here.
  userInterfaceStyle: 'dark',
  ios: {
    bundleIdentifier: 'com.harlemmight.app',
    supportsTablet: true,
    // Viro's dist binaries are device-arm64 only, so the iOS build must run on a
    // physical iPhone; signing needs the team that owns the paired device.
    appleTeamId: 'GK27ABX7SN',
    infoPlist: {
      // Explore's "My location" puck on the Mapbox map (docs/adr/0007). The
      // Maps SDK shows the system prompt the first time the puck turns on.
      NSLocationWhenInUseUsageDescription:
        'Harlem Might shows where you are on the Explore map, so you can see which places are near you.',
    },
  },
  android: {
    package: 'com.harlemmight.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: palette.mights['warm-black'],
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    // Registers native watchOS application in apps/mobile/targets/harlem-watch.
    // Expo Widgets remains sole owner of the iPhone WidgetKit extension.
    '@bacons/apple-targets',
    [
      'expo-widgets',
      {
        groupIdentifier: 'group.com.harlemmight.app',
        widgets: [
          { name: 'HarlemStory', displayName: 'This Is Harlem', description: 'A sourced Harlem story each day.', ios: { supportedFamilies: ['systemSmall', 'systemMedium'], initialLayout: './widgets/ios/HarlemStory.tsx' } },
          { name: 'HarlemEvent', displayName: 'Happening in Harlem', description: 'Verified neighborhood events.', ios: { supportedFamilies: ['systemSmall', 'systemMedium'], initialLayout: './widgets/ios/HarlemEvent.tsx' } },
          { name: 'HarlemPlace', displayName: 'My Harlem', description: 'A place you saved in Harlem.', ios: { supportedFamilies: ['systemSmall', 'systemMedium'], initialLayout: './widgets/ios/HarlemPlace.tsx' } },
          { name: 'HarlemWalk', displayName: 'Take Me There', description: 'Pick up your walking tour.', ios: { supportedFamilies: ['systemSmall', 'systemMedium', 'accessoryRectangular'], initialLayout: './widgets/ios/HarlemWalk.tsx' } },
        ],
      },
    ],
    [
      'react-native-android-widget',
      {
        widgets: [
          { name: 'HarlemStory', label: 'This Is Harlem', description: 'Sourced daily Harlem stories', minWidth: '180dp', minHeight: '100dp', resizeMode: 'horizontal|vertical', updatePeriodMillis: 1800000 },
          { name: 'HarlemEvent', label: 'Happening in Harlem', description: 'Current verified Harlem events', minWidth: '180dp', minHeight: '100dp', resizeMode: 'horizontal|vertical', updatePeriodMillis: 1800000 },
          { name: 'HarlemPlace', label: 'My Harlem', description: 'Saved places around Harlem', minWidth: '180dp', minHeight: '100dp', resizeMode: 'horizontal|vertical', updatePeriodMillis: 1800000 },
          { name: 'HarlemWalk', label: 'Take Me There', description: 'Your ongoing Harlem walking tour', minWidth: '180dp', minHeight: '100dp', resizeMode: 'horizontal|vertical', updatePeriodMillis: 1800000 },
        ],
      },
    ],
    // Quest and PICO run Android 12+; Meta's layout library and
    // react-native-webgpu's AHardwareBuffer use both need minSdk 29.
    ['expo-build-properties', { android: { minSdkVersion: 29 } }],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        // The app canvas (`surface` dark), so splash and first frame share one colour.
        backgroundColor: palette.mights['warm-black'],
        dark: { backgroundColor: palette.mights['warm-black'] },
      },
    ],
    [
      'expo-font',
      {
        // Upstream static TTFs. File name = PostScript name, so the same
        // fontFamily string resolves on iOS and Android. Native font tokens
        // in packages/theme/tokens.ts (nativeFontFamilies) name these files.
        fonts: [
          '../../packages/assets/fonts/native/MonaSans-Regular.ttf',
          '../../packages/assets/fonts/native/MonaSans-Medium.ttf',
          '../../packages/assets/fonts/native/MonaSans-SemiBold.ttf',
          '../../packages/assets/fonts/native/MonaSans-Bold.ttf',
          '../../packages/assets/fonts/native/MonaSansDisplayCondensed-Bold.ttf',
          '../../packages/assets/fonts/native/MonaSansSemiExpanded-SemiBold.ttf',
          '../../packages/assets/fonts/native/Newsreader16pt-Regular.ttf',
          '../../packages/assets/fonts/native/Newsreader16pt-Italic.ttf',
        ],
      },
    ],
    'expo-image',
    'react-native-webgpu',
    // Adds the device flavors (mobile, quest) and the Quest manifest: VR
    // intent category, headtracking, hand tracking and supported devices.
    // Build with `pnpm --filter mobile android:quest` (questDebug).
    [
      'expo-horizon-core',
      {
        // Horizon OS opens a 2D app at phone size unless the activity names a
        // window size. 1440x900dp (16:10) fits Explore's three columns,
        // Discover 360 | map | Detail 400, in one window (DECISIONS S17);
        // 1440 is Meta's documented maximum panel width. The commented PICO
        // block below keeps its own size.
        defaultWidth: '1440dp',
        defaultHeight: '900dp',
        supportedDevices: 'quest2|questpro|quest3|quest3s',
        disableVrHeadtracking: false,
        allowBackup: false,
        // Quest-flavor options, handled by the quest plugin that
        // release/horizon-core runs after the upstream one.
        // Meta VR Layout SDK (@metavr/layout-compat + layout-window-compat):
        // BOM and both artifacts as questImplementation, excluded from the
        // mobile classpath, with stub ReactPackages there so the shared
        // PackageList compiles. JS gates on isHorizonBuild.
        metaLayoutSdk: true,
      },
    ],
    [
      '@reactvision/react-viro',
      {
        provider: 'reactvision',
        rvApiKey: process.env.EXPO_PUBLIC_REACTVISION_API_KEY,
        rvProjectId: process.env.EXPO_PUBLIC_REACTVISION_PROJECT_ID,
        rvEndpoint: process.env.EXPO_PUBLIC_REACTVISION_ENDPOINT,
        android: {
          // Add 'PICO' back together with the @expo-pico/core block below.
          xRMode: ['AR', 'QUEST'],
          questAppId:
            process.env.EXPO_PUBLIC_META_QUEST_APP_ID ??
            process.env.META_QUEST_APP_ID,
          // The Meta VR Layout SDK is linked by expo-horizon-core above
          // (metaLayoutSdk), quest flavor only. Viro's option would add it to
          // every flavor, so it stays off: one owner for the BOM.
          metaSpatialLayout: false,
          metaVrGlassesCompatible: true,
          questArm64Only: true,
        },
      },
    ],
    // Place Detail as its own Horizon OS panel (DECISIONS S20, ADR 0006):
    // declares SpatialPanelActivity with a 400x600dp <layout> in the QUEST
    // flavor manifest only. After expo-horizon-core, which writes that file.
    [
      './modules/spatial-panels/app.plugin.js',
      { defaultWidth: '400dp', defaultHeight: '600dp' },
    ],
    // Location permissions for the Explore map's "My location" puck, in the
    // mobile flavor manifest only (docs/adr/0007). Finalized, so it runs
    // after the plugins above that rewrite the flavor manifests.
    './plugins/with-mobile-location-permission.js',
    // Copies and signs the Mapbox dynamic frameworks (MapboxCommon, MapboxCoreMaps)
    // into the app; without it iOS refuses to launch with "Library not loaded".
    '@mikevocalz/nitro-mapbox-ar',
    // PICO: uncomment and set your PICO Developer Console app ID to add the pico flavor.
    // [
    //   '@expo-pico/core',
    //   {
    //     picoAppId: '1234567',
    //     buildVariant: 'pico',
    //     xrMode: 'pico-os5',
    //     appType: 'mr',
    //     targetProfile: 'auto',
    //     targetDevices: ['pico-4-ultra'],
    //     spatialMode: 'windowed',
    //     defaultContainerMode: 'window-container',
    //     defaultWidth: '1024dp',
    //     defaultHeight: '640dp',
    //     handTracking: true,
    //     passthrough: true,
    //     sceneUnderstanding: false,
    //     highSamplingRateSensors: true,
    //     refreshRates: [72, 90],
    //     ndkAbiFilters: true,
    //     openXrLoaderDeclaration: true,
    //     developerTools: true,
    //     enableEmulatorOptimizations: false,
    //     targetSdkVersion: 34,
    //   },
    // ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: { policy: 'appVersion' },
  // @expo-pico/core registers its package in the New Architecture shape,
  // which is the only architecture in SDK 58.
};

export default config;
