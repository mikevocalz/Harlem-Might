import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkQuestManifest,
  chooseMetroPort,
  isRequiredNode,
  newestBuildTools,
  parseAdbDevices,
  parseArgs,
  pickDevice,
} from './quest-lib.mjs';

test('parseArgs: --serial implies --install and rejects unknown flags', () => {
  assert.deepEqual(parseArgs([]), { install: false, serial: undefined, help: false });
  assert.deepEqual(parseArgs(['--serial', 'ABC']), { install: true, serial: 'ABC', help: false });
  assert.deepEqual(parseArgs(['--serial=ABC']), { install: true, serial: 'ABC', help: false });
  assert.throws(() => parseArgs(['--serial']), /needs a value/);
  assert.throws(() => parseArgs(['--release']), /unknown argument --release/);
});

test('isRequiredNode pins major.minor 24.15', () => {
  assert.equal(isRequiredNode('24.15.0'), true);
  assert.equal(isRequiredNode('24.15.3'), true);
  assert.equal(isRequiredNode('24.14.1'), false);
  assert.equal(isRequiredNode('22.15.0'), false);
});

test('newestBuildTools compares numerically, not lexically', () => {
  assert.equal(newestBuildTools(['34.0.0', '36.1.0', '36.0.0', '9.0.0', 'licenses']), '36.1.0');
  assert.equal(newestBuildTools(['36.0.0', '37.0.0']), '37.0.0');
  assert.equal(newestBuildTools([]), undefined);
});

test('checkQuestManifest flags PICO leaks and a missing volumetric permission', () => {
  const clean = 'E: uses-permission\n  A: android:name="horizonos.permission.MANAGE_APP_VOLUMETRIC_WINDOWS"';
  assert.equal(checkQuestManifest(clean).ok, true);

  const leaky = `${clean}\nE: meta-data\n  A: android:name="pvr.app.type"\n  A: android:value="com.picovr.intent.category.VR"`;
  const result = checkQuestManifest(leaky);
  assert.equal(result.ok, false);
  assert.equal(result.leaks.length, 2);

  assert.equal(checkQuestManifest('E: manifest').hasVolumetric, false);
});

test('parseAdbDevices keeps only authorised devices', () => {
  const out = 'List of devices attached\n2G0YC1\tdevice\nemulator-5554\toffline\n3H1\tunauthorized\n\n';
  assert.deepEqual(parseAdbDevices(out), ['2G0YC1']);
});

test('pickDevice: one device, --serial, none, several', () => {
  assert.deepEqual(pickDevice(['A'], undefined), { serial: 'A' });
  assert.deepEqual(pickDevice(['A', 'B'], 'B'), { serial: 'B' });
  assert.match(pickDevice([], undefined).error, /no adb device/);
  assert.match(pickDevice(['A', 'B'], undefined).error, /--serial/);
  assert.match(pickDevice(['A'], 'Z').error, /not attached/);
});

test("chooseMetroPort reuses this app's Metro and skips another project's", () => {
  const app = '/Users/me/Harlem-Might/apps/mobile';
  const other = new Map([[8081, '/Users/me/deviant/apps/mobile']]);
  assert.deepEqual(chooseMetroPort(other, app, [8081, 8082]), { port: 8082, reuse: false });

  const ours = new Map([[8081, '/Users/me/deviant'], [8083, app]]);
  assert.deepEqual(chooseMetroPort(ours, app, [8081, 8082, 8083]), { port: 8083, reuse: true });

  assert.deepEqual(chooseMetroPort(new Map(), app, [8081]), { port: 8081, reuse: false });
  assert.equal(chooseMetroPort(new Map([[8081, '/x']]), app, [8081]), undefined);
  // A sibling directory that only shares the prefix is not this app.
  assert.deepEqual(chooseMetroPort(new Map([[8081, `${app}-old`]]), app, [8081, 8082]), { port: 8082, reuse: false });
});
