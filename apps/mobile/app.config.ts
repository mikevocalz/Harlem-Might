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
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.harlemmight.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.harlemmight.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: palette.ink[50],
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    // Quest and PICO run Android 12+; Meta's layout library and
    // react-native-webgpu's AHardwareBuffer use both need minSdk 29.
    ['expo-build-properties', { android: { minSdkVersion: 29 } }],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: palette.ink[50],
        dark: { backgroundColor: palette.ink[50] },
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          '../../packages/assets/fonts/ArchivoBlack-Regular.ttf',
          '../../packages/assets/fonts/SpaceGrotesk-Variable.ttf',
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
        // window size; this matches the PICO window below (16:10, landscape).
        defaultWidth: '1280dp',
        defaultHeight: '800dp',
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
        picoAppId: process.env.PICO_APP_ID,
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
