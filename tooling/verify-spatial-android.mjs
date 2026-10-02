import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'apps/mobile/android');
const javaRoot = join(android, 'app/src/main/java');

const read = (relativePath) => readFileSync(join(android, relativePath), 'utf8');

const findSourceFile = (filename) => {
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
  return fullPath
    ? relative(android, fullPath).split('\\').join('/')
    : null;
};

const checks = [
  ['settings.gradle', [
    "include ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'",
    'android/viro_renderer',
  ]],
  ['app/build.gradle', [
    "implementation project(path: ':react_viro')",
    "implementation project(path: ':viro_renderer')",
    'com.meta.metavrx:metavrx-bom:1.2026.0.0',
    'layout-react-compat',
    'layout-window-react-compat',
  ]],
  ['gradle.properties', [
    'reactNativeArchitectures=arm64-v8a',
    'android.targetSdkVersion=34',
  ]],
  ['app/src/main/AndroidManifest.xml', [
    'android:scheme="harlemmight"',
    'android:name=".VRActivity"',
    'com.oculus.intent.category.VR',
    'com.oculus.supportedDevices',
    'com.meta.store.defaultDeviceTargets',
    'android:value="quest3+"',
    'horizonos.permission.USE_ANCHOR_API',
    'horizonos.permission.HEADSET_CAMERA',
    'horizonos.permission.IMPORT_EXPORT_IOT_MAP_DATA',
    'com.oculus.permission.HAND_TRACKING',
    'com.oculus.feature.PASSTHROUGH',
    'android:name="android.hardware.vr.headtracking" android:required="false"',
    'android:glEsVersion="0x00030000"',
  ]],
  ['app/src/main/res/values/strings.xml', [
    '<string name="app_name">Harlem Might</string>',
  ]],
];

const failures = [];
for (const [relativePath, needles] of checks) {
  if (!existsSync(join(android, relativePath))) {
    failures.push(`${relativePath}: missing`);
    continue;
  }

  const body = read(relativePath);
  for (const needle of needles) {
    if (!body.includes(needle)) failures.push(`${relativePath}: missing ${needle}`);
  }
}

const mainApplication = findSourceFile('MainApplication.kt');
if (!mainApplication) {
  failures.push('app/src/main/java/**/MainApplication.kt: missing');
} else {
  const body = read(mainApplication);
  for (const needle of [
    'ReactViroPackage.ViroPlatform.AR',
    'ReactViroPackage.ViroPlatform.QUEST',
    'ReactViroPackage.ViroPlatform.PICO',
  ]) {
    if (!body.includes(needle)) failures.push(`${mainApplication}: missing ${needle}`);
  }
}

const manifestPath = 'app/src/main/AndroidManifest.xml';
if (existsSync(join(android, manifestPath))) {
  const manifest = read(manifestPath);
  if (manifest.includes('android:name="android.hardware.vr.headtracking" android:required="true"')) {
    failures.push(
      `${manifestPath}: VR head tracking must remain optional for the combined phone + Quest APK`,
    );
  }

  if (manifest.includes('android.permission.SYSTEM_ALERT_WINDOW')) {
    failures.push(
      `${manifestPath}: SYSTEM_ALERT_WINDOW must not ship in the Quest manifest`,
    );
  }
}

const vrActivity = findSourceFile('VRActivity.kt');
if (!vrActivity) {
  failures.push('app/src/main/java/**/VRActivity.kt: missing');
} else if (!read(vrActivity).includes('getMainComponentName(): String = "VRQuestScene"')) {
  failures.push(`${vrActivity}: does not mount VRQuestScene`);
}

if (failures.length) {
  console.error('[spatial:verify-android] Native XR project drift detected:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `[spatial:verify-android] Android XR project matches the checked-in Viro Meta Horizon/PICO contract (${mainApplication}, ${vrActivity}).`,
);
