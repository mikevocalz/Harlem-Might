import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isCompanionSnapshot, isCompanionCommand, type CompanionSnapshot } from '../modules/walk-companion/src/protocol.ts';

const now = Date.parse('2026-10-11T05:00:00Z');
const sample: CompanionSnapshot = {
  schemaVersion: 1, handoffId: 'new-account-epoch', sessionId: 'walk-session', revision: 1,
  status: 'active', walkTitle: 'Harlem', nextStopId: 'stop-a', nextStopTitle: 'First stop',
  completedCount: 0, totalStops: 2, updatedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 60_000).toISOString(), routeState: 'unavailable', instruction: null, hapticsEnabled: false,
};

test('paired snapshot is a bounded expiring projection, not a session/token container', () => {
  assert.equal(isCompanionSnapshot(sample, now), true);
  for (const field of ['token', 'owner', 'member', 'latitude', 'longitude', 'savedPlaces']) {
    assert.equal(isCompanionSnapshot({ ...sample, [field]: 'private' }, now), false);
  }
  assert.equal(isCompanionSnapshot({ ...sample, revision: 1.5 }, now), false);
  assert.equal(isCompanionSnapshot({ ...sample, completedCount: 3 }, now), false);
  assert.equal(isCompanionSnapshot({ ...sample, nextStopTitle: null }, now), false);
  assert.equal(isCompanionSnapshot({ ...sample, instruction: 'x'.repeat(501) }, now), false);
  assert.equal(isCompanionSnapshot({ ...sample, hapticsEnabled: 'yes' }, now), false);
});

test('expired, long-lived, stale and future guidance fails closed', () => {
  assert.equal(isCompanionSnapshot(sample, now + 60_000), false);
  assert.equal(isCompanionSnapshot({ ...sample, expiresAt: new Date(now + 300_001).toISOString() }, now), false);
  assert.equal(isCompanionSnapshot({ ...sample, updatedAt: new Date(now + 31_000).toISOString() }, now), false);
  assert.equal(isCompanionSnapshot({ ...sample, updatedAt: 'not-a-date' }, now), false);
});

test('commands require explicit confirmation and only allowed action fields', () => {
  const command = { schemaVersion: 1, commandId: 'action', handoffId: 'epoch', sessionId: 'session', expectedRevision: 0, type: 'confirm-stop', stopId: 'stop', confirmed: true };
  assert.equal(isCompanionCommand(command), true);
  assert.equal(isCompanionCommand({ ...command, confirmed: false }), false);
  assert.equal(isCompanionCommand({ ...command, confirmed: undefined }), false);
  assert.equal(isCompanionCommand({ ...command, type: 'start' }), false);
  assert.equal(isCompanionCommand({ ...command, type: 'pause' }), false);
  assert.equal(isCompanionCommand({ ...command, expectedRevision: -1 }), false);
  assert.equal(isCompanionCommand({ ...command, token: 'secret' }), false);
  assert.equal(isCompanionCommand({ ...command, type: 'stop', stopId: undefined }), true);
});

test('watch and phone share identical Swift wire validator source', () => {
  const phone = readFileSync(new URL('../modules/walk-companion/ios/CompanionWire.swift', import.meta.url), 'utf8');
  const watch = readFileSync(new URL('../targets/harlem-watch/CompanionWire.swift', import.meta.url), 'utf8');
  assert.equal(phone, watch);
});

test('paired native state has no durable private cache or queued mutations', () => {
  const paths = [
    '../modules/walk-companion/ios/WalkCompanionModule.swift',
    '../targets/harlem-watch/WalkCompanion.swift',
    '../modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt',
    '../../wearos/app/src/main/java/com/harlemmight/watch/WalkCompanion.kt',
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source.replace(/^\s*\/\/.*$/gm, ''), /UserDefaults\s*\.|getSharedPreferences\s*\(|putDataItem\s*\(|transferUserInfo\s*\(|updateApplicationContext\s*\(/);
  }
});

test('native lifecycle revocation cannot be undone by an old JS publisher', () => {
  const swift = readFileSync(new URL('../modules/walk-companion/ios/WalkCompanionModule.swift', import.meta.url), 'utf8');
  const kotlin = readFileSync(new URL('../modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt', import.meta.url), 'utf8');
  assert.match(swift, /next\.handoffId == authorizedHandoff/);
  assert.match(swift, /authorizedHandoff = nil/);
  assert.match(kotlin, /next\.optString\("handoffId"\) != authorizedHandoff/);
  assert.match(kotlin, /authorizedHandoff = null/);
});
