// Declares SpatialPanelActivity in the QUEST flavor manifest only
// (android/app/src/quest/AndroidManifest.xml), so mobile and PICO APKs never
// carry it and `SpatialPanels.isAvailable` is false there.
//
// A finalized mod: expo-horizon-core rewrites the quest manifest from scratch
// in a dangerous mod, and only a finalized mod is sure to run after it (the
// same reason @reactvision/react-viro's quest-manifest sync is finalized).

const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { AndroidConfig, withFinalizedMod } = require('expo/config-plugins');

const ACTIVITY = 'com.harlemmight.spatialpanels.SpatialPanelActivity';

/** Meta's documented panel width range (panel-sizing docs): 384dp to 1440dp. */
const MIN_WIDTH_DP = 384;
const MAX_WIDTH_DP = 1440;

function parseDp(label, value) {
  const match = /^(\d+)dp$/.exec(String(value));
  if (!match) throw new Error(`spatial-panels: ${label} must look like "400dp", got ${JSON.stringify(value)}.`);
  return Number(match[1]);
}

/**
 * The quest-manifest `<activity>` element for the panel. Pure, for tests.
 *
 * @param {{ defaultWidth: string, defaultHeight: string }} options
 */
function panelActivityElement(options) {
  const width = parseDp('defaultWidth', options.defaultWidth);
  parseDp('defaultHeight', options.defaultHeight);
  if (width < MIN_WIDTH_DP || width > MAX_WIDTH_DP) {
    throw new Error(`spatial-panels: defaultWidth ${width}dp is outside Meta's ${MIN_WIDTH_DP}–${MAX_WIDTH_DP}dp panel range.`);
  }
  return {
    $: {
      'android:name': ACTIVITY,
      'android:exported': 'false',
      'android:theme': '@style/AppTheme',
      'android:configChanges':
        'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|density',
      'android:resizeableActivity': 'true',
      'android:excludeFromRecents': 'true',
      // Its own task, so the panel never stacks on the main window's task.
      'android:taskAffinity': 'com.harlemmight.app.panel',
    },
    layout: [{ $: { 'android:defaultWidth': options.defaultWidth, 'android:defaultHeight': options.defaultHeight } }],
  };
}

/** Adds or replaces the panel activity in a parsed manifest. Pure, for tests. */
function addPanelActivity(manifest, options) {
  const application = manifest.manifest.application?.[0];
  if (!application) throw new Error('spatial-panels: the quest manifest has no <application>.');
  const activities = (application.activity ?? []).filter((activity) => activity.$?.['android:name'] !== ACTIVITY);
  application.activity = [...activities, panelActivityElement(options)];
  return manifest;
}

/** @type {import('expo/config-plugins').ConfigPlugin<{ defaultWidth: string, defaultHeight: string }>} */
const withSpatialPanels = (config, options) => {
  panelActivityElement(options); // fail at config time, not mid-prebuild
  return withFinalizedMod(config, [
    'android',
    async (config) => {
      const path = join(config.modRequest.platformProjectRoot, 'app/src/quest/AndroidManifest.xml');
      if (!existsSync(path)) {
        throw new Error(
          'spatial-panels: app/src/quest/AndroidManifest.xml is missing. List expo-horizon-core before this plugin.',
        );
      }
      const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(path);
      await AndroidConfig.Manifest.writeAndroidManifestAsync(path, addPanelActivity(manifest, options));
      return config;
    },
  ]);
};

module.exports = withSpatialPanels;
module.exports.addPanelActivity = addPanelActivity;
module.exports.panelActivityElement = panelActivityElement;
module.exports.PANEL_ACTIVITY = ACTIVITY;
