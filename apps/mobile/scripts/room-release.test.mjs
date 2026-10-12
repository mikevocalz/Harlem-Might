import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getConfig } = require('expo/config');
const { updateAndroidProguardRules } = require(
  join(dirname(require.resolve('expo-build-properties/package.json')), 'build/android.js'),
);

test('host Room compatibility: Expo generates an explicit no-arg constructor keep rule', () => {
  const { exp } = getConfig(fileURLToPath(new URL('..', import.meta.url)));
  const buildProperties = exp.plugins.filter(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  );
  assert.equal(buildProperties.length, 1);
  const rules = updateAndroidProguardRules(
    '',
    buildProperties[0][1].android.extraProguardRules,
    'append',
  );
  assert.ok(
    rules.split('\n').map((line) => line.trim()).includes(
      '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
    ),
    'AGP 9 strict keep rules must preserve Room constructors explicitly, not only class names',
  );
});

test('host WorkManager compatibility: release DEX retains the public Room constructor', {
  skip: process.env.QUEST_RELEASE_APK ? false : 'Set QUEST_RELEASE_APK to inspect a minified release APK',
}, () => {
  const code = execFileSync(process.env.APKANALYZER ?? 'apkanalyzer', [
    'dex', 'code', '--class', 'androidx.work.impl.WorkDatabase_Impl',
    process.env.QUEST_RELEASE_APK,
  ], { encoding: 'utf8' });
  assert.ok(
    code.split('\n').map((line) => line.trim()).includes('.method public constructor <init>()V'),
    'Room reflectively instantiates WorkDatabase_Impl through its public no-arg constructor',
  );
});
