// Checks the Quest/PICO Android contract in two layers.
//
// 1. Config (always, CI included): apps/mobile/app.config.ts declares the
//    plugins and options that generate the XR native project. CI cannot run
//    prebuild because the Viro fork is private, so this is what CI enforces.
// 2. Generated tree (when apps/mobile/android/ exists): android/ is not
//    checked in. `pnpm --filter mobile quest` regenerates it with
//    `expo prebuild --clean` and runs this with --require-android, so the
//    entries below are checked against real plugin output on every build.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = join(root, 'apps/mobile');
const android = join(appDir, 'android');
const requireAndroid = process.argv.includes('--require-android');
const failures = [];

// --- 1. config contract ----------------------------------------------------

const { default: config } = await import(pathToFileURL(join(appDir, 'app.config.ts')).href);
const plugin = (name) => {
  const entry = config.plugins?.find((p) => (Array.isArray(p) ? p[0] : p) === name);
  if (!entry) failures.push(`app.config.ts: plugin ${name} missing`);
  return Array.isArray(entry) ? (entry[1] ?? {}) : {};
};
const expect = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`app.config.ts: ${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
};

expect('scheme', config.scheme, 'harlemmight');
expect('android.package', config.android?.package, 'com.harlemmight.app');
expect('expo-build-properties android.minSdkVersion', plugin('expo-build-properties').android?.minSdkVersion, 29);

const horizon = plugin('expo-horizon-core');
expect('expo-horizon-core supportedDevices', horizon.supportedDevices, 'quest2|questpro|quest3|quest3s');
expect('expo-horizon-core disableVrHeadtracking', horizon.disableVrHeadtracking, false);

const viro = plugin('@reactvision/react-viro').android ?? {};
expect('@reactvision/react-viro android.xRMode', viro.xRMode, ['AR', 'QUEST', 'PICO']);
expect('@reactvision/react-viro android.questArm64Only', viro.questArm64Only, true);
// One owner for the Meta VR Layout SDK BOM: @expo-pico/core, quest flavor only.
expect('@reactvision/react-viro android.metaSpatialLayout', viro.metaSpatialLayout, false);

const pico = plugin('@expo-pico/core');
expect('@expo-pico/core buildVariant', pico.buildVariant, 'pico');
expect('@expo-pico/core metaLayoutSdk', pico.metaLayoutSdk, true);
if ('picoAppId' in pico && !pico.picoAppId) {
  // An explicit undefined replaces the plugin's '' default and prebuild dies
  // writing an empty <string name="pico_app_id">.
  failures.push('app.config.ts: @expo-pico/core picoAppId is present but empty; omit the key when PICO_APP_ID is unset');
}

// --- 2. generated tree -----------------------------------------------------

const read = (relativePath) => readFileSync(join(android, relativePath), 'utf8');

const findSourceFile = (filename) => {
  const javaRoot = join(android, 'app/src/main/java');
  if (!existsSync(javaRoot)) return null;
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        const found = walk(fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name === filename) {
        return fullPath;
      }
    }
    return null;
  };
  const fullPath = walk(javaRoot);
  return fullPath ? relative(android, fullPath).split('\\').join('/') : null;
};

const treeChecks = [
  ['settings.gradle', [
    "include ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'",
    'android/viro_renderer',
  ]],
  ['app/build.gradle', [
    "implementation project(path: ':react_viro')",
    "implementation project(path: ':viro_renderer')",
    'questImplementation platform("com.meta.metavrx:metavrx-bom:1.2026.0.0")',
    'questImplementation "com.meta.metavrx.layout:layout-react-compat"',
    'questImplementation "com.meta.metavrx.layout:layout-window-react-compat"',
    'c.exclude group: "com.meta.metavrx.layout"',
    'src/metaLayoutStub/java',
  ]],
  ['app/src/metaLayoutStub/java/metavrx/layout/react/SpatialScenePackage.java', [
    'public final class SpatialScenePackage implements ReactPackage',
  ]],
  ['app/src/metaLayoutStub/java/metavrx/layout/window/react/SpatialWindowPackage.java', [
    'public final class SpatialWindowPackage implements ReactPackage',
  ]],
  ['gradle.properties', [
    'reactNativeArchitectures=arm64-v8a',
    'android.targetSdkVersion=34',
  ]],
  ['app/src/main/AndroidManifest.xml', [
    'android:scheme="harlemmight"',
    'android:name=".VRActivity"',
    'android:glEsVersion="0x00030000"',
  ]],
  // Meta entries live in the quest flavor so the mobile and pico APKs never
  // carry them.
  ['app/src/quest/AndroidManifest.xml', [
    'com.oculus.intent.category.VR',
    'com.oculus.vr.focusaware',
    'com.oculus.supportedDevices',
    'android:value="quest2|questpro|quest3|quest3s"',
    'com.meta.store.defaultDeviceTargets',
    'horizonos.permission.USE_ANCHOR_API',
    'horizonos.permission.HEADSET_CAMERA',
    'horizonos.permission.IMPORT_EXPORT_IOT_MAP_DATA',
    'HAND_TRACKING',
    'com.oculus.feature.PASSTHROUGH',
    'android:defaultWidth="1280dp"',
  ]],
  ['app/src/pico/AndroidManifest.xml', [
    'com.picovr.intent.category.VR',
  ]],
  ['app/src/main/res/values/strings.xml', [
    '<string name="app_name">Harlem Might</string>',
  ]],
];

let mainApplication = null;
let vrActivity = null;

if (existsSync(android)) {
  for (const [relativePath, needles] of treeChecks) {
    if (!existsSync(join(android, relativePath))) {
      failures.push(`android/${relativePath}: missing`);
      continue;
    }
    const body = read(relativePath);
    for (const needle of needles) {
      if (!body.includes(needle)) failures.push(`android/${relativePath}: missing ${needle}`);
    }
  }

  // The Layout SDK and its volumetric-window permission must never reach the
  // pico or mobile APKs, so no flavor-wide declaration of the artifacts.
  if (existsSync(join(android, 'app/build.gradle'))) {
    for (const line of read('app/build.gradle').split('\n')) {
      if (/^\s*implementation\b.*com\.meta\.metavrx/.test(line)) {
        failures.push(`android/app/build.gradle: Meta VR Layout SDK declared for every flavor: ${line.trim()}`);
      }
    }
  }

  const mainManifestPath = 'app/src/main/AndroidManifest.xml';
  if (existsSync(join(android, mainManifestPath))) {
    const manifest = read(mainManifestPath);
    for (const leak of ['com.oculus.intent.category.VR', 'com.oculus.supportedDevices', 'horizonos.permission.', 'com.picovr.', 'pvr.app.type']) {
      if (manifest.includes(leak)) failures.push(`android/${mainManifestPath}: ${leak} belongs in a flavor manifest, not main`);
    }
    if (manifest.includes('android.permission.SYSTEM_ALERT_WINDOW')) {
      failures.push(`android/${mainManifestPath}: SYSTEM_ALERT_WINDOW must not ship`);
    }
  }

  mainApplication = findSourceFile('MainApplication.kt');
  if (!mainApplication) {
    failures.push('android/app/src/main/java/**/MainApplication.kt: missing');
  } else {
    const body = read(mainApplication);
    for (const needle of [
      'ReactViroPackage.ViroPlatform.AR',
      'ReactViroPackage.ViroPlatform.QUEST',
      'ReactViroPackage.ViroPlatform.PICO',
    ]) {
      if (!body.includes(needle)) failures.push(`android/${mainApplication}: missing ${needle}`);
    }
  }

  vrActivity = findSourceFile('VRActivity.kt');
  if (!vrActivity) {
    failures.push('android/app/src/main/java/**/VRActivity.kt: missing');
  } else if (!read(vrActivity).includes('getMainComponentName(): String = "VRQuestScene"')) {
    failures.push(`android/${vrActivity}: does not mount VRQuestScene`);
  }
} else if (requireAndroid) {
  failures.push('apps/mobile/android/: not generated. Run `pnpm --filter mobile quest` (it runs expo prebuild --clean first).');
}

if (failures.length) {
  console.error('[spatial:verify-android] Quest/PICO contract broken:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  existsSync(android)
    ? `[spatial:verify-android] app.config.ts and the generated android/ (${mainApplication}, ${vrActivity}) match the Quest/PICO contract.`
    : '[spatial:verify-android] app.config.ts matches the Quest/PICO contract. android/ is generated, not checked in; `pnpm --filter mobile quest` checks the generated tree.',
);
