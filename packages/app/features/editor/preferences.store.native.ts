'use client';
import { useStore } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import {
  createPreferencesStore,
  readPreferences,
  type PreferencesState,
  type PreferencesStorage,
} from './preferences.store.shared.ts';

// Acquire inside the guarded storage operations, not while importing the
// feature barrel. A failed open is retried by the next read/write.
let storage: ReturnType<typeof createMMKV> | undefined;
const local = () => storage ??= createMMKV({ id: 'editor' });
const lazyStorage: PreferencesStorage = {
  getString: (key) => local().getString(key),
  set: (key, value) => local().set(key, value),
  remove: (key) => local().remove(key),
};
let store: ReturnType<typeof createPreferencesStore> | undefined;
const preferencesStore = () => store ??= createPreferencesStore(lazyStorage, readPreferences(lazyStorage));

export function useEditorPreferences<T>(selector: (state: PreferencesState) => T): T {
  return useStore(preferencesStore(), selector);
}
