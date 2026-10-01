import { createStore } from 'zustand';
import {
  DEFAULT_PREFERENCES,
  reconcilePreferences,
  moveVisible,
  toggleEnabled,
  type ToolbarPreferences,
} from './preferences.ts';

/**
 * WHERE TOOLBAR PREFERENCES LIVE: one key, `toolbar-preferences`, as JSON, in
 * whatever synchronous key-value store the platform fork hands over.
 *
 * Synchronous is the requirement, not an incidental choice — an async read
 * means the toolbar paints a default order and then rearranges itself.
 */
export const STORAGE_KEY = 'toolbar-preferences';

/** The three operations preferences need. MMKV already has exactly this shape. */
export interface PreferencesStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  remove: (key: string) => void;
}

export interface PreferencesState {
  preferences: ToolbarPreferences;
  move: (from: number, to: number) => void;
  toggle: (id: string) => void;
  reset: () => void;
}

export function readPreferences(storage: PreferencesStorage): ToolbarPreferences {
  const raw = storage.getString(STORAGE_KEY);
  if (raw === undefined) return DEFAULT_PREFERENCES;
  try {
    // Reconciled on the way IN, never trusted as-is: the registry may have
    // changed since this was written.
    return reconcilePreferences(JSON.parse(raw) as Partial<ToolbarPreferences>);
  } catch {
    storage.remove(STORAGE_KEY);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * `initial` is a parameter rather than always `readPreferences(storage)`
 * because the two platforms disagree on when the saved value may first be
 * observed — see preferences.store.web.ts.
 */
export function createPreferencesStore(
  storage: PreferencesStorage,
  initial: ToolbarPreferences,
) {
  return createStore<PreferencesState>((set, get) => {
    const persist = (preferences: ToolbarPreferences) => {
      storage.set(STORAGE_KEY, JSON.stringify(preferences));
      set({ preferences });
    };

    return {
      preferences: initial,
      // `from`/`to` are indices into the VISIBLE toolbar, which is what the
      // settings list renders — see moveVisible for why that distinction matters.
      move: (from, to) => persist(moveVisible(get().preferences, from, to)),
      toggle: (id) => persist(toggleEnabled(get().preferences, id)),
      reset: () => persist(DEFAULT_PREFERENCES),
    };
  });
}
