import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const configPlugins = require('expo/config-plugins');
const { withStaticPlugin } = configPlugins;
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

test('linked Viro resolves the host Expo config-plugin runtime', () => {
  const requireFromViro = createRequire(
    require.resolve('@reactvision/react-viro/app.plugin.js'),
  );
  assert.equal(
    requireFromViro('@expo/config-plugins'),
    configPlugins,
    'The sibling checkout must use the host SDK runtime, not a missing or separately installed version',
  );
});

test('Expo loads the linked Viro plugin and registers its native mods', () => {
  // Exercise Expo's real plugin resolver without running prebuild or native mods.
  const config = withStaticPlugin({
    name: 'Viro plugin test',
    slug: 'viro-plugin-test',
    _internal: { projectRoot },
  }, {
    plugin: ['@reactvision/react-viro', { android: { xRMode: ['AR', 'QUEST'] } }],
  });
  assert.equal(typeof config.mods?.android?.manifest, 'function');
  assert.equal(typeof config.mods?.android?.appBuildGradle, 'function');
  assert.equal(typeof config.mods?.ios?.dangerous, 'function');
});
