const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Binary / authored assets used by Rive, Viro/OpenXR, WebXR and spatial UI.
// Expo already handles common images/media. These extensions must remain
// assets (not source transforms) so native and web runtimes receive a URI.
const SPATIAL_ASSET_EXTS = [
  "riv",
  "glb", "gltf", "bin",
  "obj", "mtl", "fbx", "vrx",
  "hdr", "exr",
  "ktx", "ktx2",
  "arobject",
  "spz",
  "glxf",
  "uikitml",
  "wasm",
];

config.resolver.assetExts = Array.from(
  new Set([...config.resolver.assetExts, ...SPATIAL_ASSET_EXTS]),
);

/**
 * Solito must resolve the same React Navigation instance Expo Router mounts.
 * Keep Expo's resolver as the final fallback so SDK 58's package exports,
 * tsconfig aliases, web/server conditions and monorepo resolution stay intact.
 */
const VENDORED_NAVIGATION = {
  "@react-navigation/native": path.resolve(
    __dirname,
    "../../node_modules/expo-router/build/react-navigation/native",
  ),
  "@react-navigation/core": path.resolve(
    __dirname,
    "../../node_modules/expo-router/build/react-navigation/core",
  ),
};

/**
 * Linked checkouts outside this repo: the Viro fork and @viro-external. Metro
 * must watch their real paths, and their imports must resolve from this app's
 * node_modules, or each checkout's own react / react-native copies load too.
 */
const LINKED_CHECKOUTS = [
  path.resolve(__dirname, "../../../viro-specs-preview"),
  path.resolve(__dirname, "../../../viro-external-specs-preview"),
];
config.watchFolders = [...(config.watchFolders ?? []), ...LINKED_CHECKOUTS];
const APP_ORIGIN = path.join(__dirname, "package.json");
const isLinked = (file) => LINKED_CHECKOUTS.some((dir) => file && file.startsWith(dir + path.sep));
const isBare = (name) => !name.startsWith(".") && !path.isAbsolute(name);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const vendored = VENDORED_NAVIGATION[moduleName];
  if (vendored) {
    return { type: "sourceFile", filePath: require.resolve(vendored) };
  }
  if (isBare(moduleName) && isLinked(context.originModulePath)) {
    try {
      return context.resolveRequest({ ...context, originModulePath: APP_ORIGIN }, moduleName, platform);
    } catch (error) {
      // The fork requires nitro-canvas-in-Vision optionally, inside a try,
      // for live Rive panels. This app plays baked Rive, so leave it
      // unresolved: Metro then treats it as a missing optional dependency.
      if (moduleName === "nitro-canvas-in-Vision" || moduleName.startsWith("nitro-canvas-in-Vision/")) {
        throw error;
      }
      // Anything else not installed here: fall back to the checkout's copy.
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Uniwind remains the outermost Metro wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
  polyfills: {
    rem: 14,
  },
});
