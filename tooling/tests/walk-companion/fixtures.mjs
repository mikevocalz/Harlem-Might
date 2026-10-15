// One set of payloads is executed by both compiled production wire validators.
// Dates are relative to the test run, so checked-in samples never expire.
export function createFixtures(now = Date.now()) {
  const date = offset => new Date(now + offset).toISOString();
  const snapshot = {
    schemaVersion: 1, handoffId: 'share-epoch-123', sessionId: 'harlem-jazz-walk', revision: 1,
    status: 'active', walkTitle: 'Harlem Jazz Walk', nextStopId: 'apollo-theater',
    nextStopTitle: 'Apollo Theater', completedCount: 0, totalStops: 3,
    updatedAt: date(-1_000), expiresAt: date(60_000), routeState: 'ready',
    instruction: 'Continue along West 125th Street', hapticsEnabled: false,
  };
  const command = {
    schemaVersion: 1, commandId: 'watch-action-123', handoffId: snapshot.handoffId,
    sessionId: snapshot.sessionId, expectedRevision: snapshot.revision, type: 'pause',
  };
  const snapshots = [], commands = [];
  const without = (value, key) => Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));
  const addSnapshot = (name, accepted, patch = {}) => snapshots.push({ name, accepted, json: JSON.stringify({ ...snapshot, ...patch }) });
  const addCommand = (name, accepted, patch = {}, snapshotPatch = {}) => commands.push({
    name, accepted, json: JSON.stringify({ ...command, ...patch }), snapshotJSON: JSON.stringify({ ...snapshot, ...snapshotPatch }),
  });

  addSnapshot('live active route', true);
  addSnapshot('haptics explicitly enabled', true, { hapticsEnabled: true });
  for (const routeState of ['ready', 'offline', 'unavailable']) {
    addSnapshot(`${routeState} without instructions`, true, { routeState, instruction: null });
    if (routeState !== 'ready') addSnapshot(`${routeState} cannot carry instructions`, false, { routeState });
  }
  addSnapshot('unknown route state', false, { routeState: 'rerouting' });
  addSnapshot('unknown status', false, { status: 'arrived' });
  for (const [status, completedCount, revision, nextStopId, nextStopTitle] of [
    ['active', 0, 0, 'apollo-theater', 'Apollo Theater'],
    ['active', 1, 1, 'apollo-theater', 'Apollo Theater'],
    ['active', 1, 7, 'apollo-theater', 'Apollo Theater'],
    ['paused', 0, 1, 'apollo-theater', 'Apollo Theater'],
    ['paused', 1, 2, 'apollo-theater', 'Apollo Theater'],
    ['stopped', 0, 1, null, null], ['stopped', 1, 2, null, null],
    ['completed', 3, 3, null, null], ['completed', 3, 8, null, null],
  ]) {
    const patch = { status, completedCount, revision, nextStopId, nextStopTitle };
    addSnapshot(`${status} progress ${completedCount} revision ${revision}`, true, patch);
    if (revision === completedCount + (['paused', 'stopped'].includes(status) ? 1 : 0) && revision > 0) {
      addSnapshot(`${status} revision below progress floor ${revision}`, false, { ...patch, revision: revision - 1 });
    }
  }
  for (const status of ['active', 'paused', 'completed', 'stopped']) {
    addSnapshot(`${status} inconsistent completion or next stop`, false, { status, revision: 5, completedCount: 3 });
    if (status === 'active' || status === 'paused') {
      addSnapshot(`${status} requires an outstanding stop`, false, { status, nextStopId: null, nextStopTitle: null });
    }
  }
  addSnapshot('completed cannot retain unfinished stops', false, { status: 'completed', nextStopId: null, nextStopTitle: null });
  addSnapshot('stopped cannot retain next stop', false, { status: 'stopped' });
  addSnapshot('next stop identifier and title must be paired', false, { nextStopTitle: null });
  addSnapshot('next stop title cannot exist alone', false, { nextStopId: null });
  addSnapshot('maximum safe revision', true, { revision: Number.MAX_SAFE_INTEGER });
  addSnapshot('maximum stop count', true, { totalStops: 100 });
  addSnapshot('zero stops', false, { totalStops: 0 });
  addSnapshot('too many stops', false, { totalStops: 101 });
  addSnapshot('progress above total', false, { completedCount: 4 });
  for (const key of ['revision', 'completedCount', 'totalStops']) {
    for (const value of [-1, 1.5, '1', true, null, Number.MAX_SAFE_INTEGER + 1]) {
      addSnapshot(`${key} rejects ${JSON.stringify(value)}`, false, { [key]: value });
    }
  }
  for (const value of [0, 2, 4_294_967_297, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, '1', true, null]) addSnapshot(`schema rejects ${JSON.stringify(value)}`, false, { schemaVersion: value });
  for (const key of ['handoffId', 'sessionId', 'walkTitle', 'nextStopId', 'nextStopTitle', 'instruction']) {
    const max = key === 'instruction' ? 500 : 160;
    addSnapshot(`${key} at text bound`, true, { [key]: 'x'.repeat(max) });
    for (const value of ['', 'x'.repeat(max + 1), 12, false, []]) {
      addSnapshot(`${key} rejects malformed text ${JSON.stringify(value).slice(0, 20)}`, false, { [key]: value });
    }
  }
  for (const value of ['false', 0, 1, null]) addSnapshot(`haptics rejects ${JSON.stringify(value)}`, false, { hapticsEnabled: value });
  for (const key of Object.keys(snapshot)) snapshots.push({ name: `missing snapshot ${key}`, accepted: false, json: JSON.stringify(without(snapshot, key)) });
  for (const key of ['token', 'owner', 'member', 'latitude', 'longitude', 'savedPlaces']) addSnapshot(`unknown private field ${key}`, false, { [key]: 'private' });
  addSnapshot('five-minute maximum lifetime', true, { updatedAt: date(-1_000), expiresAt: date(299_000) });
  addSnapshot('lifetime over five minutes', false, { updatedAt: date(-1_000), expiresAt: date(299_001) });
  addSnapshot('clock skew within thirty seconds', true, { updatedAt: date(29_000) });
  addSnapshot('clock skew beyond thirty seconds', false, { updatedAt: date(60_000), expiresAt: date(120_000) });
  addSnapshot('already expired', false, { updatedAt: date(-60_000), expiresAt: date(-1_000) });
  addSnapshot('expires at current time', false, { expiresAt: date(0) });
  addSnapshot('stale projection', false, { updatedAt: date(-301_000) });
  addSnapshot('expiry equals update', false, { expiresAt: snapshot.updatedAt });
  addSnapshot('expiry precedes update', false, { expiresAt: date(-2_000) });
  for (const key of ['updatedAt', 'expiresAt']) {
    for (const value of ['', 'not-a-date', 42, null]) addSnapshot(`${key} rejects ${JSON.stringify(value)}`, false, { [key]: value });
  }
  // Whitespace keeps fields otherwise valid: this specifically exercises the byte cap.
  snapshots.push({ name: 'snapshot at wire byte cap', accepted: true, json: ' '.repeat(8_192 - Buffer.byteLength(JSON.stringify(snapshot))) + JSON.stringify(snapshot) });
  snapshots.push({ name: 'snapshot exceeds wire byte cap', accepted: false, json: ' '.repeat(8_192) + JSON.stringify(snapshot) });

  for (const type of ['pause', 'resume', 'stop', 'confirm-stop']) {
    const patch = { type, ...(type === 'stop' || type === 'confirm-stop' ? { confirmed: true } : {}),
      ...(type === 'confirm-stop' ? { stopId: snapshot.nextStopId } : {}) };
    addCommand(`accept ${type}`, true, patch);
    addCommand(`${type} rejects false confirmation`, false, { ...patch, confirmed: false });
    if (type === 'stop' || type === 'confirm-stop') addCommand(`${type} requires confirmation`, false, { ...patch, confirmed: undefined });
  }
  addCommand('optional true confirmation', true, { confirmed: true });
  addCommand('zero revision command', true, { expectedRevision: 0 }, { revision: 0 });
  addCommand('maximum safe revision command', true, { expectedRevision: Number.MAX_SAFE_INTEGER }, { revision: Number.MAX_SAFE_INTEGER });
  addCommand('maximum command ID', true, { commandId: 'c'.repeat(160) });
  for (const commandId of ['', 'c'.repeat(161), 12, null, false]) addCommand(`invalid command ID ${JSON.stringify(commandId).slice(0, 20)}`, false, { commandId });
  for (const key of Object.keys(command)) commands.push({ name: `missing command ${key}`, accepted: false, json: JSON.stringify(without(command, key)), snapshotJSON: JSON.stringify(snapshot) });
  for (const key of ['handoffId', 'sessionId']) {
    for (const value of ['another-epoch-or-session', '', null, 1]) addCommand(`${key} mismatch ${JSON.stringify(value)}`, false, { [key]: value });
  }
  for (const value of [0, 2, -1, 1.5, '1', true, null, Number.MAX_SAFE_INTEGER + 1]) addCommand(`revision mismatch or malformed ${JSON.stringify(value)}`, false, { expectedRevision: value });
  for (const value of [0, 2, 4_294_967_297, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, '1', true, null]) addCommand(`command schema rejects ${JSON.stringify(value)}`, false, { schemaVersion: value });
  for (const type of ['start', '', null, 1]) addCommand(`invalid command type ${JSON.stringify(type)}`, false, { type });
  for (const confirmed of [null, 'true', 1]) addCommand(`malformed confirmation ${JSON.stringify(confirmed)}`, false, { confirmed });
  for (const stopId of ['apollo-theater', null, '']) addCommand('non-confirmation cannot carry stop ID ' + JSON.stringify(stopId), false, { stopId });
  for (const stopId of ['different-stop', '', null, 12, undefined]) addCommand('confirmation needs displayed stop ' + JSON.stringify(stopId), false, { type: 'confirm-stop', confirmed: true, stopId });
  addCommand('confirmation cannot target completed walk', false, { type: 'confirm-stop', confirmed: true, stopId: snapshot.nextStopId, expectedRevision: 3 }, { status: 'completed', completedCount: 3, revision: 3, nextStopId: null, nextStopTitle: null });
  addCommand('unknown command field', false, { token: 'private' });
  addCommand('command cannot revive expired snapshot', false, {}, { updatedAt: date(-60_000), expiresAt: date(-1_000) });
  addCommand('command expires with original snapshot', false, {}, { expiresAt: date(0) });
  addCommand('command rejects stale snapshot', false, {}, { updatedAt: date(-301_000) });
  commands.push({ name: 'command at wire byte cap', accepted: true, json: ' '.repeat(8_192 - Buffer.byteLength(JSON.stringify(command))) + JSON.stringify(command), snapshotJSON: JSON.stringify(snapshot) });
  commands.push({ name: 'command exceeds wire byte cap', accepted: false, json: ' '.repeat(8_192) + JSON.stringify(command), snapshotJSON: JSON.stringify(snapshot) });
  for (const json of ['{invalid', '[]', 'null', '"payload"', '42', '{}']) {
    snapshots.push({ name: `invalid snapshot document ${json}`, accepted: false, json });
    commands.push({ name: `invalid command document ${json}`, accepted: false, json, snapshotJSON: JSON.stringify(snapshot) });
  }
  return { snapshots, commands };
}
