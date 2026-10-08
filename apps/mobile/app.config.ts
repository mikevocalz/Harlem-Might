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
        // 1440 is Meta's documented maximum panel width. The PICO window
        // below keeps its own size.
        defaultWidth: '1440dp',
        defaultHeight: '900dp',
        supportedDevices: 'quest2|questpro|quest3|quest3s',
        disableVrHeadtracking: false,
        allowBackup: false,
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
          xRMode: ['AR', 'QUEST', 'PICO'],
          questAppId:
            process.env.EXPO_PUBLIC_META_QUEST_APP_ID ??
            process.env.META_QUEST_APP_ID,
          // The Meta VR Layout SDK is linked by @expo-pico/core below
          // (metaLayoutSdk), quest flavor only. Viro's option would add it to
          // every flavor, so it stays off: one owner for the BOM.
          metaSpatialLayout: false,
          metaVrGlassesCompatible: true,
          questArm64Only: true,
        },
      },
    ],
    // Adds the pico flavor: PICO OS 5 OpenXR loader, manifest and SDK levels.
    // Build with `pnpm --filter mobile android:pico` (picoDebug).
    [
      '@expo-pico/core',
      {
        // PICO Platform Services (account, IAP, social) need the developer-portal app id.
        // Omit the key when unset: @expo-pico/core spreads options over its
        // defaults, so an explicit `undefined` replaces the '' default and
        // prebuild dies writing <string name="pico_app_id"> with no text.
        ...(process.env.PICO_APP_ID ? { picoAppId: process.env.PICO_APP_ID } : {}),
        buildVariant: 'pico',
        xrMode: 'pico-os5',
        appType: 'mr',
        targetProfile: 'auto',
        targetDevices: ['pico-4-ultra'],
        spatialMode: 'windowed',
        defaultContainerMode: 'window-container',
        defaultWidth: '1024dp',
        defaultHeight: '640dp',
        handTracking: true,
        passthrough: true,
        sceneUnderstanding: false,
        highSamplingRateSensors: true,
        refreshRates: [72, 90],
        ndkAbiFilters: true,
        openXrLoaderDeclaration: true,
        developerTools: true,
        enableEmulatorOptimizations: false,
        targetSdkVersion: 34,
        // Meta VR Layout SDK (@metavr/layout-compat + layout-window-compat):
        // BOM and both artifacts as questImplementation, excluded from the
        // pico and mobile classpaths, with stub ReactPackages there so the
        // shared PackageList compiles. JS gates on isHorizonBuild.
        metaLayoutSdk: true,
      },
    ],
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
