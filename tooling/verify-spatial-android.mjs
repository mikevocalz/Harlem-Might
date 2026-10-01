import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'apps/mobile/android');

const read = (relative) => readFileSync(join(android, relative), 'utf8');
const checks = [
  ['settings.gradle', [
    "include ':react_viro', ':arcore_client', ':gvr_common', ':viro_renderer'",
    "android/viro_renderer",
  ]],
  ['app/build.gradle', [
    "implementation project(path: ':react_viro')",
    "implementation project(path: ':viro_renderer')",
    "com.meta.metavrx:metavrx-bom:1.2026.0.0",
    "layout-react-compat",
    "layout-window-react-compat",
  ]],
  ['gradle.properties', [
    'reactNativeArchitectures=arm64-v8a',
    'android.targetSdkVersion=34',
  ]],
  ['app/src/main/java/com/harlemmight/app/MainApplication.kt', [
    'ReactViroPackage.ViroPlatform.AR',
    'ReactViroPackage.ViroPlatform.QUEST',
    'ReactViroPackage.ViroPlatform.PICO',
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
for (const [relative, needles] of checks) {
  const body = read(relative);
  for (const needle of needles) {
    if (!body.includes(needle)) failures.push(`${relative}: missing ${needle}`);
  }
}

const manifest = read('app/src/main/AndroidManifest.xml');
if (manifest.includes('android:name="android.hardware.vr.headtracking" android:required="true"')) {
  failures.push(
    'app/src/main/AndroidManifest.xml: VR head tracking must remain optional for the combined phone + Quest APK',
  );
}

if (manifest.includes('android.permission.SYSTEM_ALERT_WINDOW')) {
  failures.push(
    'app/src/main/AndroidManifest.xml: SYSTEM_ALERT_WINDOW must not ship in the Quest manifest',
  );
}

const vrActivity =
  'app/src/main/java/com/harlemmight/app/VRActivity.kt';
if (!existsSync(join(android, vrActivity))) {
  failures.push(`${vrActivity}: missing`);
} else if (!read(vrActivity).includes('getMainComponentName(): String = "VRQuestScene"')) {
  failures.push(`${vrActivity}: does not mount VRQuestScene`);
}

if (failures.length) {
  console.error('[spatial:verify-android] Native XR project drift detected:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('[spatial:verify-android] Android XR project matches the checked-in Viro Meta Horizon/PICO contract.');
