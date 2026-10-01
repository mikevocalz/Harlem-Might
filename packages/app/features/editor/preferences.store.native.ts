'use client';
import { useStore } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import {
  createPreferencesStore,
  readPreferences,
  type PreferencesState,
} from './preferences.store.shared.ts';

// MMKV, instance id `editor`. Its reads are synchronous, so the very first
// render already knows the arrangement.
const storage = createMMKV({ id: 'editor' });
const store = createPreferencesStore(storage, readPreferences(storage));

export function useEditorPreferences<T>(selector: (state: PreferencesState) => T): T {
  return useStore(store, selector);
}
