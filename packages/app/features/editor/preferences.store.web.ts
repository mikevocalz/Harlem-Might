'use client';
import { useEffect } from 'react';
import { useStore } from 'zustand';
import { DEFAULT_PREFERENCES } from './preferences.ts';
import {
  createPreferencesStore,
  readPreferences,
  type PreferencesState,
  type PreferencesStorage,
} from './preferences.store.shared.ts';

/** localStorage behind MMKV's shape. Absent while Next renders on the server. */
const storage: PreferencesStorage = {
  getString: (key) => globalThis.localStorage?.getItem(key) ?? undefined,
  set: (key, value) => globalThis.localStorage?.setItem(key, value),
  remove: (key) => globalThis.localStorage?.removeItem(key),
};

/**
 * The store opens on the DEFAULTS even in the browser, where the saved value is
 * already readable.
 *
 * The server had no localStorage and rendered the default order into the HTML.
 * A client store that disagreed with that HTML on its first render is a
 * hydration mismatch, so the saved arrangement is adopted one effect later —
 * one frame of default order instead of a React error.
 */
const store = createPreferencesStore(storage, DEFAULT_PREFERENCES);
let adopted = false;

function adoptSaved() {
  if (adopted) return;
  adopted = true;
  const saved = readPreferences(storage);
  if (saved !== DEFAULT_PREFERENCES) store.setState({ preferences: saved });
}

export function useEditorPreferences<T>(selector: (state: PreferencesState) => T): T {
  useEffect(adoptSaved, []);
  return useStore(store, selector);
}
