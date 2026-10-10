/**
 * The app imports only `@mapbox/react-native-mapbox-ar/navigation` (the
 * Directions client, plain TypeScript). The package root also ships a Nitro
 * C++ module for terrain, which the Quest build does not use, so it is kept
 * out of native autolinking on both platforms.
 */
module.exports = {
  dependencies: {
    '@mapbox/react-native-mapbox-ar': {
      platforms: { android: null, ios: null },
    },
    // Viro stays out of autolinking on every platform: expo.autolinking.exclude
    // in package.json covers Expo autolinking, this entry covers the community
    // CLI path. iOS pins ViroReact/ViroKit in the Podfile against the
    // node_modules dist (device-arm64 binaries only, so simulator builds pass
    // HARLEM_VIRO=skip); Android is wired through settings.gradle by the fork.
    '@reactvision/react-viro': {
      platforms: { android: null, ios: null },
    },
  },
};
