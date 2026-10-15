import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// Execute both platform barrels against one inert pinned-runtime boundary.
// This validates exported values and wrapper behavior, not device rendering.
const runtimeExports = ['Viro3DObject', 'Viro3DSceneNavigator', 'ViroAnimations', 'ViroARScene', 'ViroARPlaneSelector', 'ViroSharedFrame', 'ViroAmbientLight', 'ViroBox', 'ViroController', 'ViroDirectionalLight', 'ViroGameLoop', 'ViroMaterials', 'ViroNode', 'ViroPolyline', 'ViroQuad', 'ViroScene', 'ViroSound', 'ViroText', 'ViroVirtualButton', 'ViroVirtualJoystick', 'invertTransform', 'parseLocationTransform', 'poseCsv', 'transformDirection', 'worldToLocation', 'ViroXRSceneNavigator', 'useViroColocation', 'useViroColocationRoom', 'useViroReplicatedState', 'metaSpatialAnchorFrameSource', 'cloudAnchorFrameSource', 'visionOSSharedSpaceFrameSource', 'normaliseJoinCode', 'formatJoinCode', 'isQuest'];
const runtimeSource = runtimeExports.map(name =>
  `export const ${name} = ${name === 'isQuest' ? 'true' : `Symbol('${name}')`};`,
).join('\n');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@reactvision/react-viro') return { url: 'viro-contract-test:runtime', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'viro-contract-test:runtime') return { format: 'module', source: runtimeSource, shortCircuit: true };
    return next(url, context);
  },
});
const native = await import('./viro.native.ts');
const anchor = await import('./viro.ts');
const nativeValues = native as unknown as Record<string, unknown>;

test('native Viro exports the object and sound primitives its native consumers import', () => {
  assert.equal(nativeValues.Viro3DObject, anchor.Viro3DObject);
  assert.equal(nativeValues.ViroSound, anchor.ViroSound);
  assert.notEqual(nativeValues.Viro3DObject, undefined);
  assert.notEqual(nativeValues.ViroSound, undefined);
});

test('native and TypeScript Viro barrels expose the same runtime values', () => {
  assert.deepEqual(Object.keys(native).sort(), Object.keys(anchor).sort());
  for (const name of runtimeExports) assert.equal(nativeValues[name], (anchor as unknown as Record<string, unknown>)[name], name);
});

test('the common runtime preserves public-fork capability fallbacks', async () => {
  assert.equal(native.isMetaHorizonXR, true);
  assert.equal(native.isKnownQuest, true);
  assert.equal(native.metaHorizonFormFactor, 'quest');
  assert.equal(native.isPico, false);
  assert.equal(native.isVisionOS, false);
  assert.equal(native.useViroVRViewTag(), null);
  assert.equal(await native.getOpenXRRuntimeCapabilities(null), null);
  assert.equal(await native.getOpenXRRuntimeCapabilities(42), null);
  assert.doesNotThrow(() => native.triggerViroHaptic(null));
  assert.doesNotThrow(() => native.triggerViroHaptic(42));
});
