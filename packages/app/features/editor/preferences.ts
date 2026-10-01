import { BASIC_IDS, CAPABILITY_BY_ID, CAPABILITIES } from './capabilities.ts';

export interface ToolbarPreferences {
  /** Toolbar buttons, in the order the user arranged them. */
  readonly order: readonly string[];
  /** Advanced capabilities the user switched on. Basic ones are always on. */
  readonly enabled: readonly string[];
}

export const DEFAULT_PREFERENCES: ToolbarPreferences = {
  order: BASIC_IDS,
  enabled: [],
};

/**
 * Reconcile saved preferences against the registry as it exists NOW.
 *
 * Preferences outlive releases. Without this step two things rot: an id removed
 * from the registry keeps a dead slot in the toolbar, and — worse — a
 * capability SHIPPED since the user last saved never appears, because their
 * stored order predates it. A feature nobody can see is indistinguishable from
 * a feature that was never built.
 *
 * Rules, in order:
 *   1. Drop ids the registry no longer knows.
 *   2. Keep the user's relative order for everything that survived.
 *   3. Append basic capabilities added since the save, in registry order, so
 *      new defaults surface without disturbing the arrangement above them.
 *   4. Drop enabled ids that are gone or are not advanced (basic ones are not
 *      switchable, so an entry for one is stale data).
 */
export function reconcilePreferences(saved: Partial<ToolbarPreferences> | null): ToolbarPreferences {
  const savedOrder = saved?.order ?? DEFAULT_PREFERENCES.order;
  const savedEnabled = saved?.enabled ?? DEFAULT_PREFERENCES.enabled;

  const known = savedOrder.filter((id) => CAPABILITY_BY_ID[id] !== undefined);
  const missingBasics = BASIC_IDS.filter((id) => !known.includes(id));

  const enabled = savedEnabled.filter((id) => {
    const capability = CAPABILITY_BY_ID[id];
    return capability !== undefined && !capability.basic;
  });

  return { order: [...known, ...missingBasics], enabled };
}

/**
 * The buttons the toolbar renders, in order.
 *
 * A capability appears when it is basic or switched on, AND it has a place in
 * the order. Advanced capabilities the user enables but has never arranged are
 * appended, so switching one on in settings puts it on the toolbar immediately
 * rather than requiring a second, invisible step.
 */
export function visibleToolbarIds(preferences: ToolbarPreferences): readonly string[] {
  const isVisible = (id: string) => {
    const capability = CAPABILITY_BY_ID[id];
    if (capability === undefined || capability.role !== 'toolbar') return false;
    return capability.basic || preferences.enabled.includes(id);
  };

  const ordered = preferences.order.filter(isVisible);
  const unplaced = preferences.enabled.filter((id) => isVisible(id) && !ordered.includes(id));
  return [...ordered, ...unplaced];
}

/** Move a capability within the order. Returns a new array; never mutates. */
export function reorder(
  order: readonly string[],
  from: number,
  to: number,
): readonly string[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) {
    return order;
  }
  const next = [...order];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return order;
  next.splice(to, 0, moved);
  return next;
}

/**
 * Move a VISIBLE row, expressed in the indices the user actually sees.
 *
 * The toolbar shows a filtered view of `order` — hidden and disabled ids are
 * skipped — so a drag from visible row 2 to row 0 is NOT a move from index 2 to
 * 0 in `order`. Translating through ids first is what keeps the saved
 * arrangement matching the one on screen; operating on raw indices silently
 * moves a different button whenever anything is switched off.
 */
export function moveVisible(
  preferences: ToolbarPreferences,
  from: number,
  to: number,
): ToolbarPreferences {
  const visible = visibleToolbarIds(preferences);
  const movedId = visible[from];
  const targetId = visible[to];
  if (movedId === undefined || targetId === undefined || movedId === targetId) {
    return preferences;
  }

  const order = preferences.order.includes(movedId)
    ? preferences.order
    : [...preferences.order, movedId];

  const fromIndex = order.indexOf(movedId);
  const toIndex = order.indexOf(targetId);
  if (fromIndex < 0 || toIndex < 0) return preferences;

  return { ...preferences, order: reorder(order, fromIndex, toIndex) };
}

/** Switch an advanced capability on or off. Basic ones are not switchable. */
export function toggleEnabled(
  preferences: ToolbarPreferences,
  id: string,
): ToolbarPreferences {
  const capability = CAPABILITY_BY_ID[id];
  if (capability === undefined || capability.basic) return preferences;

  const enabled = preferences.enabled.includes(id)
    ? preferences.enabled.filter((entry) => entry !== id)
    : [...preferences.enabled, id];

  // Dropping a capability also drops its slot, so switching it back on later
  // appends it fresh rather than restoring a position the user has forgotten.
  const order = enabled.includes(id)
    ? preferences.order.includes(id)
      ? preferences.order
      : [...preferences.order, id]
    : preferences.order.filter((entry) => entry !== id);

  return { order, enabled };
}

/** Every capability the settings screen lists, grouped for display. */
export const SETTINGS_ROWS = CAPABILITIES.filter((capability) => !capability.basic);
