// Declares location permissions in the MOBILE flavor manifest only
// (android/app/src/mobile/AndroidManifest.xml). Explore's "My location" puck
// on the Mapbox map needs them on phones and foldables (docs/adr/0007); the
// quest APK draws the schematic and never asks, so it does not declare them.
//
// A finalized mod: expo-horizon-core and @reactvision/react-viro rewrite the
// flavor manifests in earlier mods, and only a finalized mod is sure to run
// after them (the same reason modules/spatial-panels/app.plugin.js is one).

const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { AndroidConfig, withFinalizedMod } = require('expo/config-plugins');

const PERMISSIONS = ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION'];

const EMPTY_MANIFEST =
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"/>\n';

/** Adds each permission once to a parsed manifest. Pure, for tests. */
function addLocationPermissions(manifest) {
  const existing = manifest.manifest['uses-permission'] ?? [];
  const names = new Set(existing.map((entry) => entry.$?.['android:name']));
  manifest.manifest['uses-permission'] = [
    ...existing,
    ...PERMISSIONS.filter((name) => !names.has(name)).map((name) => ({ $: { 'android:name': name } })),
  ];
  return manifest;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
const withMobileLocationPermission = (config) =>
  withFinalizedMod(config, [
    'android',
    async (config) => {
      const path = join(config.modRequest.platformProjectRoot, 'app/src/mobile/AndroidManifest.xml');
      if (!existsSync(path)) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, EMPTY_MANIFEST);
      }
      const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(path);
      await AndroidConfig.Manifest.writeAndroidManifestAsync(path, addLocationPermissions(manifest));
      return config;
    },
  ]);

module.exports = withMobileLocationPermission;
module.exports.addLocationPermissions = addLocationPermissions;
