import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_PREFERENCES, moveVisible, toggleEnabled } from './preferences.ts';
import { createPreferencesStore, readPreferences, STORAGE_KEY, type PreferencesStorage } from './preferences.store.shared.ts';

const fail = () => { throw new Error('Storage unavailable'); };
const storage = (overrides: Partial<PreferencesStorage> = {}): PreferencesStorage => ({
  getString: () => undefined,
  set: () => {},
  remove: () => {},
  ...overrides,
});

describe('toolbar preference storage recovery', () => {
  it('uses defaults when reading storage fails without trying destructive cleanup', () => {
    let removed = false;
    const result = readPreferences(storage({ getString: fail, remove: () => { removed = true; } }));
    assert.equal(result, DEFAULT_PREFERENCES);
    assert.equal(removed, false);
  });

  it('uses defaults when malformed preference cleanup also fails', () => {
    assert.equal(readPreferences(storage({ getString: () => '{bad', remove: fail })), DEFAULT_PREFERENCES);
  });

  it('cleans up malformed preferences when storage is available', () => {
    const removed: string[] = [];
    assert.equal(readPreferences(storage({ getString: () => '{bad', remove: (key) => removed.push(key) })), DEFAULT_PREFERENCES);
    assert.deepEqual(removed, [STORAGE_KEY]);
  });

  it('drops non-string, inherited and duplicate IDs while preserving valid saved choices', () => {
    const result = readPreferences(storage({ getString: () => JSON.stringify({
      order: [['bold'], 'italic', 'italic', 'constructor', '__proto__', null, {}, 'bold'],
      enabled: [['code'], 'code', 'code', 'toString', 'bold', null],
    }) }));
    assert.deepEqual(result.order.slice(0, 2), ['italic', 'bold']);
    assert.equal(new Set(result.order).size, result.order.length);
    assert.ok(result.order.every((id) => typeof id === 'string'));
    assert.ok(!result.order.includes('constructor') && !result.order.includes('__proto__'));
    assert.deepEqual(result.enabled, ['code']);
    const store = createPreferencesStore(storage(), result);
    store.getState().toggle('constructor');
    store.getState().toggle('__proto__');
    assert.equal(store.getState().preferences, result);
  });

  it('cleans up malformed array containers rather than trusting JSON casts', () => {
    for (const value of [{ order: 'bold' }, { enabled: {} }, [], 42]) {
      const removed: string[] = [];
      assert.equal(readPreferences(storage({ getString: () => JSON.stringify(value),
        remove: (key) => removed.push(key) })), DEFAULT_PREFERENCES);
      assert.deepEqual(removed, [STORAGE_KEY]);
    }
  });

  it('retains in-memory move, toggle and reset changes when writes fail', () => {
    const store = createPreferencesStore(storage({ set: fail }), DEFAULT_PREFERENCES);
    store.getState().move(0, 1);
    const moved = moveVisible(DEFAULT_PREFERENCES, 0, 1);
    assert.deepEqual(store.getState().preferences, moved);
    store.getState().toggle('code');
    assert.deepEqual(store.getState().preferences, toggleEnabled(moved, 'code'));
    store.getState().reset();
    assert.deepEqual(store.getState().preferences, DEFAULT_PREFERENCES);
  });

  it('persists the latest in-memory arrangement when storage recovers', () => {
    let unavailable = true;
    let saved: string | undefined;
    const disk = storage({ set: (key, value) => {
      assert.equal(key, STORAGE_KEY);
      if (unavailable) fail();
      saved = value;
    } });
    const store = createPreferencesStore(disk, DEFAULT_PREFERENCES);
    store.getState().toggle('code');
    unavailable = false;
    store.getState().move(0, 1);
    assert.deepEqual(JSON.parse(saved!), store.getState().preferences);
    assert.ok(store.getState().preferences.enabled.includes('code'));
  });
});
