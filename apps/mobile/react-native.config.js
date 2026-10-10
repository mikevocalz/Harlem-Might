/**
 * `@mikevocalz/nitro-mapbox-ar` (core) and `@mikevocalz/nitro-mapbox-ar-maps`
 * (the `MapboxMapView` hybrid view) autolink on both platforms: Explore draws
 * the native Mapbox map on phones and foldables (docs/adr/0007). The maps
 * package's Android module depends on the core by its autolinked project
 * name, `:mikevocalz_nitro-mapbox-ar`, so the core keeps its real npm name.
 * Autolinking cannot scope a library to one product flavor, so the quest APK
 * carries both too; JS keeps the headset on the schematic (isHorizonBuild).
 */
module.exports = {
  dependencies: {
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
