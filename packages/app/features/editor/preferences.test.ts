import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADVANCED_IDS, BASIC_IDS, CAPABILITIES, CAPABILITY_BY_ID } from './capabilities.ts';
import type { ToolbarPreferences } from './preferences.ts';
import {
  DEFAULT_PREFERENCES,
  moveVisible,
  reconcilePreferences,
  reorder,
  toggleEnabled,
  visibleToolbarIds,
} from './preferences.ts';

describe('the registry itself', () => {
  it('gives every toolbar entry something to run', () => {
    for (const capability of CAPABILITIES) {
      if (capability.role === 'toolbar') {
        assert.equal(typeof capability.run, 'function', capability.id);
      }
    }
  });

  it('has no duplicate ids, since ids key the preferences', () => {
    const ids = CAPABILITIES.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('names an icon for every toolbar entry', () => {
    for (const capability of CAPABILITIES) {
      if (capability.role === 'toolbar') assert.ok(capability.icon.length > 0, capability.id);
    }
  });

  it('splits basic and advanced without overlap', () => {
    for (const id of BASIC_IDS) assert.ok(!ADVANCED_IDS.includes(id), id);
    assert.equal(BASIC_IDS.length + ADVANCED_IDS.length, CAPABILITIES.length);
  });
});

describe('reconcilePreferences', () => {
  it('returns the defaults for a first run', () => {
    assert.deepEqual(reconcilePreferences(null), DEFAULT_PREFERENCES);
  });

  it('drops ids the registry no longer knows', () => {
    const result = reconcilePreferences({ order: ['bold', 'tableOfContents', 'italic'], enabled: [] });
    assert.ok(!result.order.includes('tableOfContents'));
    assert.ok(result.order.includes('bold'));
  });

  it("keeps the user's arrangement of what survived", () => {
    const result = reconcilePreferences({ order: ['italic', 'bold'], enabled: [] });
    assert.equal(result.order.indexOf('italic') < result.order.indexOf('bold'), true);
  });

  it('appends basics shipped since the save, so a new feature is never invisible', () => {
    // A save from before `undo` existed must still surface it.
    const stale = BASIC_IDS.filter((id) => id !== 'undo' && id !== 'redo');
    const result = reconcilePreferences({ order: stale, enabled: [] });
    assert.ok(result.order.includes('undo'));
    assert.ok(result.order.includes('redo'));
    // ...without disturbing what came before.
    assert.deepEqual(result.order.slice(0, stale.length), stale);
  });

  it('drops enabled entries that are gone, or that are basic', () => {
    const result = reconcilePreferences({ order: BASIC_IDS, enabled: ['bold', 'ghostFeature', 'code'] });
    assert.deepEqual(result.enabled, ['code']);
  });
});

describe('visibleToolbarIds', () => {
  it('shows every basic capability by default', () => {
    const visible = visibleToolbarIds(DEFAULT_PREFERENCES);
    for (const id of BASIC_IDS) {
      if (CAPABILITY_BY_ID[id]?.role === 'toolbar') assert.ok(visible.includes(id), id);
    }
  });

  it('hides advanced capabilities until they are switched on', () => {
    assert.ok(!visibleToolbarIds(DEFAULT_PREFERENCES).includes('code'));
    const on = toggleEnabled(DEFAULT_PREFERENCES, 'code');
    assert.ok(visibleToolbarIds(on).includes('code'));
  });

  it('respects the saved order', () => {
    const visible = visibleToolbarIds({ order: ['italic', 'bold'], enabled: [] });
    assert.equal(visible[0], 'italic');
    assert.equal(visible[1], 'bold');
  });

  it('surfaces an enabled capability that has no slot yet', () => {
    // Switching one on must put it on the toolbar without a second step.
    const visible = visibleToolbarIds({ order: ['bold'], enabled: ['code'] });
    assert.deepEqual(visible, ['bold', 'code']);
  });
});

describe('reorder', () => {
  it('moves an item and keeps everything else in sequence', () => {
    assert.deepEqual(reorder(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
    assert.deepEqual(reorder(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  });

  it('is a no-op for a move that changes nothing or cannot happen', () => {
    const order = ['a', 'b', 'c'];
    assert.deepEqual(reorder(order, 1, 1), order);
    assert.deepEqual(reorder(order, -1, 1), order);
    assert.deepEqual(reorder(order, 0, 9), order);
  });

  it('does not mutate its input', () => {
    const order = ['a', 'b', 'c'];
    reorder(order, 0, 2);
    assert.deepEqual(order, ['a', 'b', 'c']);
  });
});

describe('toggleEnabled', () => {
  it('refuses to switch off a basic capability', () => {
    assert.deepEqual(toggleEnabled(DEFAULT_PREFERENCES, 'bold'), DEFAULT_PREFERENCES);
  });

  it('ignores an unknown id', () => {
    assert.deepEqual(toggleEnabled(DEFAULT_PREFERENCES, 'nope'), DEFAULT_PREFERENCES);
  });

  it('adds a slot when switched on and removes it when switched off', () => {
    const on = toggleEnabled(DEFAULT_PREFERENCES, 'taskList');
    assert.ok(on.enabled.includes('taskList'));
    assert.ok(on.order.includes('taskList'));

    const off = toggleEnabled(on, 'taskList');
    assert.ok(!off.enabled.includes('taskList'));
    assert.ok(!off.order.includes('taskList'));
  });
});

describe('moveVisible — the order the user sees is the order that persists', () => {
  it('moves the row the user dragged, not the one at that raw index', () => {
    // 'code' is advanced, so it sits in `order` but is NOT visible while off.
    // A naive index-based reorder would move it instead of the visible row.
    const preferences = { order: ['bold', 'code', 'italic', 'underline'], enabled: [] };
    const visible = visibleToolbarIds(preferences);
    assert.deepEqual(visible, ['bold', 'italic', 'underline']);

    const moved = moveVisible(preferences, 0, 2);
    assert.deepEqual(visibleToolbarIds(moved), ['italic', 'underline', 'bold']);
    // The hidden capability keeps its place in the stored order.
    assert.ok(moved.order.includes('code'));
  });

  it('round-trips: what is saved is what renders next time', () => {
    let preferences: ToolbarPreferences = { order: [...BASIC_IDS], enabled: [] };
    preferences = moveVisible(preferences, 0, 3);
    const expected = visibleToolbarIds(preferences);

    // Simulate a reload: serialise, reconcile, project again.
    const reloaded = reconcilePreferences(JSON.parse(JSON.stringify(preferences)));
    assert.deepEqual(visibleToolbarIds(reloaded), expected);
  });

  it('is a no-op for an out-of-range or unchanged drag', () => {
    const preferences = { order: [...BASIC_IDS], enabled: [] };
    assert.deepEqual(moveVisible(preferences, 1, 1), preferences);
    assert.deepEqual(moveVisible(preferences, 99, 0), preferences);
    assert.deepEqual(moveVisible(preferences, 0, 99), preferences);
  });

  it('places an enabled-but-unplaced capability when it is dragged', () => {
    const preferences = { order: ['bold', 'italic'], enabled: ['code'] };
    assert.deepEqual(visibleToolbarIds(preferences), ['bold', 'italic', 'code']);
    const moved = moveVisible(preferences, 2, 0);
    assert.deepEqual(visibleToolbarIds(moved), ['code', 'bold', 'italic']);
  });
});
