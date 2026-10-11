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

test('paired snapshots reject revisions below confirmed progress and status transitions', () => {
  for (const fields of [
    { status: 'active', completedCount: 1, revision: 0 },
    { status: 'completed', completedCount: 2, revision: 1, nextStopId: null, nextStopTitle: null },
    { status: 'paused', completedCount: 0, revision: 0 },
    { status: 'stopped', completedCount: 0, revision: 0, nextStopId: null, nextStopTitle: null },
    { status: 'paused', completedCount: 1, revision: 1 },
    { status: 'stopped', completedCount: 1, revision: 1, nextStopId: null, nextStopTitle: null },
  ]) assert.equal(isCompanionSnapshot({ ...sample, ...fields }, now), false, JSON.stringify(fields));
});

test('paired snapshots retain minimum revisions and histories with extra pause/resume commands', () => {
  for (const fields of [
    { status: 'active', completedCount: 0, revision: 0 },
    { status: 'active', completedCount: 1, revision: 1 },
    { status: 'active', completedCount: 1, revision: 7 },
    { status: 'completed', completedCount: 2, revision: 2, nextStopId: null, nextStopTitle: null },
    { status: 'completed', completedCount: 2, revision: 8, nextStopId: null, nextStopTitle: null },
    { status: 'paused', completedCount: 0, revision: 1 },
    { status: 'paused', completedCount: 1, revision: 2 },
    { status: 'stopped', completedCount: 0, revision: 1, nextStopId: null, nextStopTitle: null },
    { status: 'stopped', completedCount: 1, revision: 2, nextStopId: null, nextStopTitle: null },
  ]) assert.equal(isCompanionSnapshot({ ...sample, ...fields }, now), true, JSON.stringify(fields));
});

test('only ready routes may carry maneuver guidance', () => {
  for (const routeState of ['offline', 'unavailable']) {
    assert.equal(isCompanionSnapshot({ ...sample, routeState, instruction: 'Turn right' }, now), false);
    assert.equal(isCompanionSnapshot({ ...sample, routeState, instruction: null }, now), true);
  }
  assert.equal(isCompanionSnapshot({ ...sample, routeState: 'ready', instruction: 'Turn right' }, now), true);
  assert.equal(isCompanionSnapshot({ ...sample, routeState: 'ready', instruction: null }, now), true);
});

test('status, confirmed progress and next stop must describe one canonical walk state', () => {
  for (const fields of [
    { status: 'completed', completedCount: 0 },
    { status: 'completed', completedCount: 1, nextStopId: null, nextStopTitle: null },
    { status: 'completed', completedCount: 2 },
    { status: 'active', completedCount: 2 },
    { status: 'active', completedCount: 2, nextStopId: null, nextStopTitle: null },
    { status: 'paused', completedCount: 2, nextStopId: null, nextStopTitle: null },
    { status: 'stopped', completedCount: 2, nextStopId: null, nextStopTitle: null },
    { status: 'active', completedCount: 1, nextStopId: null, nextStopTitle: null },
    { status: 'paused', completedCount: 1, nextStopId: null, nextStopTitle: null },
    { status: 'stopped', completedCount: 1 },
  ]) assert.equal(isCompanionSnapshot({ ...sample, revision: 4, ...fields }, now), false, JSON.stringify(fields));
});

// Structural parity checks; native execution remains a separate acceptance gate.
test('native validators reject non-ready maneuver guidance before returning a snapshot', () => {
  const swift = readFileSync(new URL('../modules/walk-companion/ios/CompanionWire.swift', import.meta.url), 'utf8');
  const kotlin = readFileSync(new URL('../modules/walk-companion/shared/android/com/harlemmight/companion/CompanionWire.kt', import.meta.url), 'utf8');
  assert.match(swift, /s\.routeState == "ready" \|\| s\.instruction == nil else \{ return nil \}/);
  assert.match(kotlin, /s\.getString\("routeState"\) != "ready" && !s\.isNull\("instruction"\)/);
});

test('native validators enforce canonical completion and outstanding next-stop relationships', () => {
  const swift = readFileSync(new URL('../modules/walk-companion/ios/CompanionWire.swift', import.meta.url), 'utf8');
  const kotlin = readFileSync(new URL('../modules/walk-companion/shared/android/com/harlemmight/companion/CompanionWire.kt', import.meta.url), 'utf8');
  assert.match(swift, /guard \(s\.status == "completed"\) == \(s\.completedCount == s\.totalStops\)/);
  assert.match(swift, /\(s\.nextStopId != nil\) == \["active", "paused"\]\.contains\(s\.status\)/);
  assert.match(kotlin, /\(s\.getString\("status"\) == "completed"\) != \(s\.getLong\("completedCount"\) == s\.getLong\("totalStops"\)\)/);
  assert.match(kotlin, /\(!s\.isNull\("nextStopId"\)\) != \(s\.getString\("status"\) in listOf\("active", "paused"\)\)/);
});

// Source parity checks only; Swift/Kotlin execution still needs native builds.
test('native snapshot validators enforce the same progress and status revision floor', () => {
  const swift = readFileSync(new URL('../modules/walk-companion/ios/CompanionWire.swift', import.meta.url), 'utf8');
  const kotlin = readFileSync(new URL('../modules/walk-companion/shared/android/com/harlemmight/companion/CompanionWire.kt', import.meta.url), 'utf8');
  assert.match(swift, /let minimumRevision = s\.completedCount \+ \(\["paused", "stopped"\]\.contains\(s\.status\) \? 1 : 0\)/);
  assert.match(swift, /guard s\.revision >= minimumRevision else \{ return nil \}/);
  assert.match(kotlin, /val minimumRevision = s\.getLong\("completedCount"\) \+ \(if \(s\.getString\("status"\) in listOf\("paused", "stopped"\)\) 1 else 0\)/);
  assert.match(kotlin, /if \(s\.getLong\("revision"\) < minimumRevision\) return null/);
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

test('Android foreground authority follows lifecycle state rather than transient window focus', () => {
  const source = readFileSync(new URL('../modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt', import.meta.url), 'utf8');
  const build = readFileSync(new URL('../modules/walk-companion/android/build.gradle', import.meta.url), 'utf8');
  assert.match(build, /implementation 'com\.facebook\.react:react-android'/);
  assert.doesNotMatch(source, /hasWindowFocus/);
  assert.match(source, /private var foreground = false/);
  assert.match(source, /private fun active\(\) = observing && foreground/);
  assert.match(source, /OnStartObserving[\s\S]*foreground = context\?\.lifecycleState == LifecycleState\.RESUMED/);
  assert.match(source, /OnActivityEntersForeground \{ main\.post \{ foreground = true \} \}/);
  assert.match(source, /OnActivityEntersBackground \{ main\.post \{ foreground = false; clearState\(\) \} \}/);
  for (const event of ['OnStopObserving', 'OnDestroy']) {
    assert.ok(source.includes(`${event} { main.post { observing = false; foreground = false; clearState(); removeListeners() } }`));
  }
});

test('Android accepts watch revocation only from the current paired node and handoff before freshness checks', () => {
  const source = readFileSync(new URL('../modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt', import.meta.url), 'utf8');
  const receive = source.slice(source.indexOf('override fun onMessageReceived('));
  assert.match(receive, /if \(event\.path == CompanionWire\.CLEAR\) \{[\s\S]*event\.sourceNodeId == targetNode && handoffId\.isNotEmpty\(\) &&[\s\S]*event\.data\.toString\(Charsets\.UTF_8\) == handoffId\) clearState\(\)[\s\S]*return@post/);
  assert.ok(receive.indexOf('event.path == CompanionWire.CLEAR') < receive.indexOf('val current = snapshotJSON'));
});

test('Apple phone revocation matches the current handoff before foreground and snapshot checks', () => {
  const source = readFileSync(new URL('../modules/walk-companion/ios/WalkCompanionModule.swift', import.meta.url), 'utf8');
  const receive = source.slice(source.indexOf('didReceiveMessage message:'));
  assert.match(receive, /if message\["kind"\] as\? String == "clear" \{[\s\S]*CompanionWire\.text\(cleared\), cleared == self\.handoffId[\s\S]*self\.clear\(\)[\s\S]*replyHandler\(\["accepted": true\]\)/);
  assert.ok(receive.indexOf('message["kind"] as? String == "clear"') < receive.indexOf('guard UIApplication.shared.applicationState'));
});

test('both watches notify revocation without echoing phone-originated clears or reviving old snapshots', () => {
  const swift = readFileSync(new URL('../targets/harlem-watch/WalkCompanion.swift', import.meta.url), 'utf8');
  const kotlin = readFileSync(new URL('../../wearos/app/src/main/java/com/harlemmight/watch/WalkCompanion.kt', import.meta.url), 'utf8');
  assert.match(swift, /if notifyPhone \{ notifyPhoneCleared\(snapshot\.handoffId\) \}/);
  assert.match(swift, /if invalidHandoffs\.contains\(next\.handoffId\) \{ notifyPhoneCleared\(next\.handoffId\); return \}/);
  assert.match(swift, /clear\("Share your walk again from the phone\.", notifyPhone: false\)/);
  // A reply handler selects the phone's reply-bearing WCSession delegate method.
  assert.match(swift, /session\.sendMessage\(\["kind": "clear", "handoffId": handoff\], replyHandler: \{ _ in \}, errorHandler: nil\)/);
  assert.match(kotlin, /if \(notifyPhone\) notifyPhoneCleared\(it\.getString\("handoffId"\)\)/);
  assert.match(kotlin, /if \(next\.getString\("handoffId"\) in invalidHandoffs\) \{[\s\S]*notifyPhoneCleared\(next\.getString\("handoffId"\)\); return@post/);
  assert.match(kotlin, /clear\("Share your walk again from the phone\.", notifyPhone = false\)/);
  assert.match(kotlin, /sendMessage\(node, CompanionWire\.CLEAR, handoff\.toByteArray\(Charsets\.UTF_8\)\)/);
});

test('source-derived CLEAR guards reject wrong peers and stale epochs after revocation or renewed opt-in', () => {
  const kotlin = readFileSync(new URL('../modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt', import.meta.url), 'utf8');
  const swift = readFileSync(new URL('../modules/walk-companion/ios/WalkCompanionModule.swift', import.meta.url), 'utf8');
  const androidGuard = kotlin.match(/if \((event\.sourceNodeId == targetNode && handoffId\.isNotEmpty\(\) &&\s*event\.data\.toString\(Charsets\.UTF_8\) == handoffId)\) clearState\(\)/)?.[1];
  const appleGuard = swift.match(/if (CompanionWire\.text\(cleared\), cleared == self\.handoffId) \{\s*self\.clear\(\)/)?.[1];
  assert.ok(androidGuard); assert.ok(appleGuard);
  // Exercise the actual source predicates after syntax-only translation. This
  // does not execute native transport/lifecycle code or replace device tests.
  const android = new Function('sourceNode', 'pairedNode', 'incoming', 'current', `return ${androidGuard
    .replaceAll('event.sourceNodeId', 'sourceNode').replaceAll('targetNode', 'pairedNode')
    .replaceAll('handoffId.isNotEmpty()', '(current.length > 0)')
    .replaceAll('event.data.toString(Charsets.UTF_8)', 'incoming').replaceAll('handoffId', 'current')};`);
  const apple = new Function('cleared', 'current', `return ${appleGuard
    .replace('CompanionWire.text(cleared)', '(cleared.length > 0 && cleared.length <= 160)')
    .replace(', ', ' && ').replace('self.handoffId', 'current')};`);
  assert.equal(android('paired', 'paired', 'old-epoch', 'old-epoch'), true);
  assert.equal(android('other-watch', 'paired', 'old-epoch', 'old-epoch'), false);
  assert.equal(apple('old-epoch', 'old-epoch'), true);
  for (const current of ['', 'new-epoch']) {
    // Duplicate tombstoned snapshots can resend this CLEAR. Neither a cleared
    // phone nor a newer explicit opt-in may be revoked by that old message.
    for (let duplicate = 0; duplicate < 2; duplicate++) {
      assert.equal(android('paired', 'paired', 'old-epoch', current), false);
      assert.equal(apple('old-epoch', current), false);
    }
  }
  assert.equal(android('paired', 'paired', '', ''), false);
  assert.equal(apple('', ''), false);
});

test('rejected requests revoke authorization only for the bound watch epoch before replying CLEAR', () => {
  const kotlin = readFileSync(new URL('../modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt', import.meta.url), 'utf8');
  const swift = readFileSync(new URL('../modules/walk-companion/ios/WalkCompanionModule.swift', import.meta.url), 'utf8');
  const android = kotlin.slice(kotlin.indexOf('val current = snapshotJSON'), kotlin.indexOf('if (event.path == CompanionWire.REQUEST) { send('));
  const apple = swift.slice(swift.indexOf('guard UIApplication.shared.applicationState == .active, self.observing,'), swift.indexOf('if message["kind"] as? String == "request" {'));
  assert.match(android, /if \(event\.path == CompanionWire\.REQUEST\) \{\s*if \(event\.sourceNodeId == targetNode && handoffId\.isNotEmpty\(\) &&\s*event\.data\.toString\(Charsets\.UTF_8\) == handoffId\) clearState\(\)/);
  assert.ok(android.indexOf('clearState()') < android.indexOf('send(event.sourceNodeId, CompanionWire.CLEAR'));
  assert.match(apple, /if message\["kind"\] as\? String == "request",\s*CompanionWire\.text\(rejectedHandoff\), rejectedHandoff == self\.handoffId \{ self\.clear\(\) \}/);
  assert.doesNotMatch(apple, /self\.snapshotJSON = nil/);
  assert.ok(apple.indexOf('self.clear()') < apple.indexOf('replyHandler(["kind": "clear"'));
});

test('source-derived rejected REQUEST predicates preserve other peers and newer opt-ins', () => {
  const kotlin = readFileSync(new URL('../modules/walk-companion/android/src/main/java/com/harlemmight/companion/WalkCompanionModule.kt', import.meta.url), 'utf8');
  const swift = readFileSync(new URL('../modules/walk-companion/ios/WalkCompanionModule.swift', import.meta.url), 'utf8');
  const rejected = kotlin.slice(kotlin.indexOf('val current = snapshotJSON'), kotlin.indexOf('if (event.path == CompanionWire.REQUEST) { send('));
  const guard = rejected.match(/if \((event\.sourceNodeId == targetNode && handoffId\.isNotEmpty\(\) &&\s*event\.data\.toString\(Charsets\.UTF_8\) == handoffId)\) clearState\(\)/)?.[1];
  const appleGuard = swift.match(/if (message\["kind"\] as\? String == "request",\s*CompanionWire\.text\(rejectedHandoff\), rejectedHandoff == self\.handoffId) \{ self\.clear\(\) \}/)?.[1];
  assert.ok(guard); assert.ok(appleGuard);
  assert.match(rejected, /event\.sourceNodeId != targetNode \|\| !active\(\) \|\| current == null/);
  assert.match(rejected, /if \(event\.path == CompanionWire\.REQUEST\)/);
  const androidBound = new Function('sourceNode', 'pairedNode', 'incoming', 'current', `return ${guard
    .replaceAll('event.sourceNodeId', 'sourceNode').replaceAll('targetNode', 'pairedNode')
    .replaceAll('handoffId.isNotEmpty()', '(current.length > 0)')
    .replaceAll('event.data.toString(Charsets.UTF_8)', 'incoming').replaceAll('handoffId', 'current')};`);
  const appleBound = new Function('kind', 'incoming', 'current', `return ${appleGuard
    .replace('message["kind"] as? String', 'kind').replace('CompanionWire.text(rejectedHandoff)', '(incoming.length > 0 && incoming.length <= 160)')
    .replaceAll(/,\s*/g, ' && ').replaceAll('rejectedHandoff', 'incoming').replace('self.handoffId', 'current')};`);
  for (const [active, fresh] of [[false, true], [true, false], [false, false]]) {
    const refuses = !active || !fresh;
    assert.equal(refuses && androidBound('paired', 'paired', 'epoch', 'epoch'), true);
    assert.equal(refuses && appleBound('request', 'epoch', 'epoch'), true);
    assert.equal(refuses && androidBound('other', 'paired', 'epoch', 'epoch'), false);
    for (const current of ['', 'new-epoch']) {
      assert.equal(refuses && androidBound('paired', 'paired', 'epoch', current), false);
      assert.equal(refuses && appleBound('request', 'epoch', current), false);
    }
    assert.equal(refuses && appleBound('command', 'epoch', 'epoch'), false);
  }
});

for (const platform of ['Apple', 'Wear'] as const) {
  test(`${platform} stale CLEAR tombstones its epoch without cancelling a nil-snapshot reconnect`, () => {
    const path = platform === 'Apple' ? '../targets/harlem-watch/WalkCompanion.swift'
      : '../../wearos/app/src/main/java/com/harlemmight/watch/WalkCompanion.kt';
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const line = source.split('\n').find(value => value.includes('clear("Share your walk again from the phone.", notifyPhone'));
    assert.ok(line);
    const predicate = platform === 'Apple' ? line.match(/if (.+) \{ clear\(/)?.[1]
      : line.match(/if \((.+)\) clear\(/)?.[1];
    assert.ok(predicate);
    // Predicate-only translation, not execution of the native watch transport.
    const shouldClear = new Function('cleared', 'snapshot', `return ${predicate
      .replaceAll('nil', 'null').replaceAll('?.optString("handoffId")', '?.handoffId')};`);
    assert.equal(shouldClear('old-epoch', null), false);
    const invalidHandoffs = new Set(['old-epoch']);
    let generation = 1;
    const reconnectOperation = generation;
    if (shouldClear('old-epoch', null)) generation++;
    assert.equal(reconnectOperation === generation && !invalidHandoffs.has('new-epoch'), true);
    assert.equal(invalidHandoffs.has('old-epoch'), true);
    assert.equal(shouldClear('old-epoch', { handoffId: 'new-epoch' }), false);
    assert.equal(shouldClear('new-epoch', { handoffId: 'new-epoch' }), true);
    const tombstone = platform === 'Apple' ? 'invalidHandoffs.insert(cleared)' : 'invalidHandoffs.add(cleared)';
    assert.ok(source.indexOf(tombstone) >= 0 && source.indexOf(tombstone) < source.indexOf(line));
  });
}

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
