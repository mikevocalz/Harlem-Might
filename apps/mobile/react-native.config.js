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
    // The Podfile pins ViroReact + ViroKit to the local fork by hand; letting
    // the linked package autolink its podspec installs libviroreact.a twice.
    '@reactvision/react-viro': {
      platforms: { ios: null },
    },
  },
};
