import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
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

function commandEvents() {
  let deliver: (event: { json: string; expiresAt?: unknown }) => void = () => { throw new Error('No listener installed'); };
  const native = { addListener(name: string, listener: typeof deliver) {
    assert.equal(name, 'onCommand'); deliver = listener; return { remove() {} };
  } };
  // Only the Expo/native import boundary is doubled. The production listener,
  // its expiry check and the actual shared wire validator execute unchanged.
  const source = stripTypeScriptTypes(readFileSync(new URL('../modules/walk-companion/index.ts', import.meta.url), 'utf8'))
    .replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '');
  const transport = new Function('requireOptionalNativeModule', 'isCompanionCommand', 'isCompanionSnapshot', `${source}\nreturn watchTransport;`)(
    () => native, isCompanionCommand, isCompanionSnapshot);
  const commands: unknown[] = [];
  transport.addCommandListener((command: unknown) => commands.push(command));
  return { commands, emit: (event: Parameters<typeof deliver>[0]) => deliver(event) };
}

const nativeCommand = { schemaVersion: 1, commandId: 'native-action', handoffId: sample.handoffId,
  sessionId: sample.sessionId, expectedRevision: sample.revision, type: 'confirm-stop', stopId: sample.nextStopId, confirmed: true };

test('the actual native event listener forwards a live command without changing its wire schema', t => {
  t.mock.method(Date, 'now', () => now);
  const h = commandEvents();
  h.emit({ json: JSON.stringify(nativeCommand), expiresAt: new Date(now + 1).toISOString() });
  assert.deepEqual(h.commands, [nativeCommand]);
});

test('native receipt cannot authorize a command delivered to JS at or after its original expiry', t => {
  let deliveryTime = now;
  t.mock.method(Date, 'now', () => deliveryTime);
  const h = commandEvents();
  const event = { json: JSON.stringify(nativeCommand), expiresAt: new Date(now + 30_000).toISOString() };
  // A foreground native bridge accepted and emitted this event before expiry;
  // its JS callback was queued while the JS thread was unavailable.
  for (const at of [now + 30_000, now + 30_001, now + 60_000]) {
    deliveryTime = at; h.emit(event);
  }
  assert.deepEqual(h.commands, []);
});

test('a newer native event cannot extend an older queued command from the same handoff and revision', t => {
  t.mock.method(Date, 'now', () => now + 30_000);
  const h = commandEvents();
  const newer = { ...nativeCommand, commandId: 'newer-action' };
  h.emit({ json: JSON.stringify(newer), expiresAt: new Date(now + 60_000).toISOString() });
  h.emit({ json: JSON.stringify(nativeCommand), expiresAt: new Date(now + 30_000).toISOString() });
  assert.deepEqual(h.commands, [newer]);
});

test('missing or invalid native event expiry fails closed, including older native binaries', t => {
  t.mock.method(Date, 'now', () => now);
  const h = commandEvents();
  for (const expiresAt of [undefined, null, 42, '', 'invalid', new Date(now - 1).toISOString()]) {
    h.emit({ json: JSON.stringify(nativeCommand), expiresAt });
  }
  h.emit({ json: '{bad', expiresAt: new Date(now + 30_000).toISOString() });
  h.emit({ json: JSON.stringify({ ...nativeCommand, confirmed: false }), expiresAt: new Date(now + 30_000).toISOString() });
  assert.deepEqual(h.commands, []);
});

test('both native command emitters carry expiry from the exact snapshot that validated the command', () => {
  const swift = readFileSync(new URL('../modules/walk-companion/ios/WalkCompanionModule.swift', import.meta.url), 'utf8');
  const kotlin = readFileSync(new URL('../modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt', import.meta.url), 'utf8');
  assert.match(swift, /sendEvent\("onCommand", \["json": json, "expiresAt": expiresAt\]\)/);
  assert.match(swift, /CompanionCommand\.decode\(commandJSON, snapshot: snapshot\)/);
  assert.match(swift, /self\.onCommand\?\(commandJSON, snapshot\.expiresAt\)/);
  assert.match(kotlin, /CompanionWire\.command\(json, current\)/);
  assert.match(kotlin, /sendEvent\("onCommand", mapOf\("json" to json, "expiresAt" to current\.getString\("expiresAt"\)\)\)/);
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

// Structural source invariants, not a Swift/Kotlin or paired-device runtime test.
// The nil-to-first-snapshot adoption must invalidate the generation captured by
// reconnect, just like replacement of a non-null older handoff does.
test('Apple Watch first snapshot invalidates older reconnect callbacks', () => {
  const source = readFileSync(new URL('../targets/harlem-watch/WalkCompanion.swift', import.meta.url), 'utf8');
  const receive = source.slice(source.indexOf('private func receive('), source.indexOf('func send(')).replace(/\/\/[^\n]*/g, '');
  assert.match(receive, /\n        if snapshot\?\.handoffId != next\.handoffId \{\s*generation \+= 1/);
  assert.match(receive, /if let previous = snapshot \{ invalidHandoffs\.insert\(previous\.handoffId\) \}/);
  assert.ok(receive.indexOf('generation += 1') < receive.indexOf('snapshot = next'));
  const reconnect = source.slice(source.indexOf('func reconnect('), source.indexOf('func clear('));
  assert.match(reconnect, /let operation = generation/);
  assert.match(reconnect, /errorHandler:[\s\S]*self\?\.generation == operation[\s\S]*self\?\.clear/);
});

test('Wear OS first snapshot invalidates older reconnect failures', () => {
  const source = readFileSync(new URL('../../wearos/app/src/main/java/com/harlemmight/watch/WalkCompanion.kt', import.meta.url), 'utf8');
  const receive = source.slice(source.indexOf('override fun onMessageReceived('), source.indexOf('fun send(')).replace(/\/\/[^\n]*/g, '');
  assert.match(receive, /\n        if \(previous\?\.optString\("handoffId"\) != next\.getString\("handoffId"\)\) \{\s*generation\+\+/);
  assert.match(receive, /previous\?\.let \{ invalidHandoffs\.add\(it\.getString\("handoffId"\)\) \}/);
  assert.ok(receive.indexOf('generation++') < receive.indexOf('snapshot = next'));
  const reconnect = source.slice(source.indexOf('fun reconnect('), source.indexOf('override fun onCapabilityChanged('));
  assert.match(reconnect, /val operation = generation/);
  assert.equal((reconnect.match(/addOnFailureListener \{ if \(operation == generation && request == reconnectGeneration\) clear/g) ?? []).length, 2);
});

test('all accepted Apple Watch snapshots supersede reconnect callbacks without invalidating pending commands', () => {
  const source = readFileSync(new URL('../targets/harlem-watch/WalkCompanion.swift', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '');
  const reconnect = source.slice(source.indexOf('func reconnect('), source.indexOf('func clear('));
  assert.match(reconnect, /reconnectGeneration \+= 1\s*let request = reconnectGeneration/);
  assert.equal((reconnect.match(/self\?\.generation == operation && self\?\.reconnectGeneration == request/g) ?? []).length, 2);
  const receive = source.slice(source.indexOf('private func receive('), source.indexOf('func send('));
  // Top-level increment follows the previous-snapshot rejection block and is
  // outside the new-handoff condition, so same-handoff evidence counts as well.
  assert.match(receive, /\)\)\) \{ return \}\s*\}\s*reconnectGeneration \+= 1\s*if snapshot\?\.handoffId != next\.handoffId/);
  const commands = source.slice(source.indexOf('func send('));
  assert.doesNotMatch(commands, /reconnectGeneration/);
  assert.match(commands, /self\?\.generation == operation.*pendingCommand\?\.commandId == command\.commandId/);
});

test('all accepted Wear OS snapshots supersede reconnect callbacks without invalidating pending commands', () => {
  const source = readFileSync(new URL('../../wearos/app/src/main/java/com/harlemmight/watch/WalkCompanion.kt', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '');
  const reconnect = source.slice(source.indexOf('fun reconnect('), source.indexOf('override fun onCapabilityChanged('));
  assert.match(reconnect, /val request = \+\+reconnectGeneration/);
  assert.match(reconnect, /operation != generation \|\| request != reconnectGeneration/);
  assert.equal((reconnect.match(/operation == generation && request == reconnectGeneration/g) ?? []).length, 2);
  const receive = source.slice(source.indexOf('override fun onMessageReceived('), source.indexOf('fun send('));
  assert.match(receive, /return@post\s*\}\s*reconnectGeneration\+\+\s*if \(previous\?\.optString\("handoffId"\)/);
  const commands = source.slice(source.indexOf('fun send('));
  assert.doesNotMatch(commands, /reconnectGeneration/);
  assert.match(commands, /operation == generation && pendingCommand\?\.optString\("commandId"\) == c\.getString\("commandId"\)/);
});
