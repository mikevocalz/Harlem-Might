import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const root = new URL('../../../', import.meta.url);
const riveRoot = dirname(require.resolve('@rive-app/react-native/package.json'));
const nativeViewPath = 'android/src/new/java/com/rive/RiveReactNativeView.kt';

test('Rive Android texture preserves pixel alpha before its surface becomes available', () => {
  const source = readFileSync(join(riveRoot, nativeViewPath), 'utf8');
  const initializer = source.match(
    /private val textureView = TextureView\(context\)\.apply \{([\s\S]*?)surfaceTextureListener =/,
  )?.[1];
  assert.ok(initializer, 'Inspect the native texture initializer when upgrading Rive');
  assert.match(initializer, /^\s*isOpaque = false\s*$/m);
  assert.doesNotMatch(source, /isOpaque\s*=\s*true|setOpaque\(true\)/);
  assert.match(source, /worker\.draw\(art, sm, rs, activeFit\)/);
});

test('Rive alpha fix is version-pinned, integrity-locked and selected by both native consumers', () => {
  const workspace = readFileSync(new URL('pnpm-workspace.yaml', root), 'utf8');
  const lock = readFileSync(new URL('pnpm-lock.yaml', root), 'utf8');
  const version = JSON.parse(readFileSync(join(riveRoot, 'package.json'), 'utf8')).version;
  assert.equal(version, '0.5.2');
  const registration = workspace.split('patchedDependencies:\n')[1];
  const patchPath = registration?.match(
    /^\s+["']?@rive-app\/react-native@0\.5\.2["']?:\s+(\S+)\s*$/m,
  )?.[1];
  assert.ok(patchPath, 'The TextureView fix must survive a clean pnpm install');
  const patch = readFileSync(new URL(patchPath, root), 'utf8');
  assert.ok(patch.includes(`+++ b/${nativeViewPath}`));
  assert.match(patch, /^\+\s+isOpaque = false$/m);
  const hash = createHash('sha256').update(patch).digest('hex');
  assert.ok(lock.includes(`'@rive-app/react-native@0.5.2': ${hash}`));
  for (const importer of ['apps/mobile', 'packages/spatial']) {
    const section = lock.split(`\n  ${importer}:\n`)[1]?.split(/\n  \S/)[0];
    const dependency = section?.match(/'@rive-app\/react-native':\n\s+specifier:.*\n\s+version: (.+)/)?.[1];
    assert.ok(dependency?.startsWith(`0.5.2(patch_hash=${hash})`), importer);
  }
});
