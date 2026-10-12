import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { DEFAULT_PREFERENCES, toggleEnabled } from './preferences.ts';
import type { PreferencesState } from './preferences.store.shared.ts';

const nativeUrl = new URL('./preferences.store.native.ts', import.meta.url).href;
const harnessKey = '__harlemEditorStorageTest';
type Harness = { opens: number; unavailable: boolean; saved?: string };
const mmkv = `export function createMMKV({ id }) {
  const state = globalThis.${harnessKey};
  state.opens++;
  if (id !== 'editor') throw new Error('Unexpected store');
  if (state.unavailable) throw new Error('Storage unavailable');
  return { getString: () => state.saved, set: (_, value) => { state.saved = value; }, remove: () => { state.saved = undefined; } };
}`;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(nativeUrl)) {
      if (specifier === 'react-native-mmkv') return { url: 'editor-storage-test:mmkv', shortCircuit: true };
      if (specifier === 'zustand') return { url: 'editor-storage-test:hook', shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'editor-storage-test:mmkv') return { format: 'module', source: mmkv, shortCircuit: true };
    if (url === 'editor-storage-test:hook') return { format: 'module', source: 'export const useStore = (store, select) => select(store.getState());', shortCircuit: true };
    return next(url, context);
  },
});
async function loadNative(name: string, harness: Harness) {
  Object.assign(globalThis, { [harnessKey]: harness });
  return await import(`${nativeUrl}?${name}`) as { useEditorPreferences: <T>(select: (state: PreferencesState) => T) => T };
}

test('native editor import does not open optional storage', async () => {
  const state = { opens: 0, unavailable: true };
  await loadNative('import', state);
  assert.equal(state.opens, 0);
});

test('first hook use survives storage construction failure and later writes retry', async () => {
  const state: Harness = { opens: 0, unavailable: true };
  // The harness replaces only the React binding; the real Zustand store runs.
  const { useEditorPreferences: selectPreferences } = await loadNative('recovery', state);
  const current = () => selectPreferences(value => value);
  assert.equal(current().preferences, DEFAULT_PREFERENCES);
  assert.equal(state.opens, 1);
  current().toggle('code');
  assert.deepEqual(current().preferences, toggleEnabled(DEFAULT_PREFERENCES, 'code'));
  assert.equal(state.opens, 2);
  state.unavailable = false;
  current().move(0, 1);
  assert.deepEqual(JSON.parse(state.saved!), current().preferences);
  assert.equal(state.opens, 3);
  current().reset();
  assert.equal(state.opens, 3, 'successful storage acquisition is reused');
});

test('first native render uses stored preferences synchronously when available', async () => {
  const saved = toggleEnabled(DEFAULT_PREFERENCES, 'code');
  const state: Harness = { opens: 0, unavailable: false, saved: JSON.stringify(saved) };
  const { useEditorPreferences } = await loadNative('saved', state);
  assert.equal(state.opens, 0);
  assert.deepEqual(useEditorPreferences(value => value.preferences), saved);
  assert.equal(state.opens, 1);
});
