import { AccessibilityInfo } from 'react-native';

/**
 * Focus targets for Explore, keyed by the opaque ids stored in
 * `useExplore().sheet.returnFocusId`.
 *
 * Rows and markers register their host view here, so the layout can move
 * screen-reader focus into Place Detail when it opens and back to the control
 * that opened it when it closes (a11y.md O5). Host views are refs, not
 * state, so this is a plain map rather than a store.
 */
type FocusNode = Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0];

const targets = new Map<string, FocusNode>();

/** Id for a Discover row. */
export const rowFocusId = (placeId: string) => `row:${placeId}`;
/** Id for a map marker. */
export const markerFocusId = (placeId: string) => `marker:${placeId}`;
/** Id for the Place Detail title. */
export const DETAIL_HEADING_FOCUS_ID = 'detail-heading';

/**
 * A callback ref that registers `node` under `id` and unregisters it on
 * unmount. Pass it as `ref`.
 */
export function focusTargetRef(id: string) {
  return (node: FocusNode | null) => {
    if (node) targets.set(id, node);
    else if (targets.get(id)) targets.delete(id);
  };
}

/**
 * Moves accessibility focus to the target registered under `id`. Returns
 * false when nothing is registered there (the row scrolled out of a recycled
 * list, or the control unmounted), so the caller can decide what to do.
 */
export function moveFocusTo(id: string | null): boolean {
  if (id == null) return false;
  const node = targets.get(id);
  if (!node) return false;
  // react-native-web has no sendAccessibilityEvent; the browser moves focus
  // with the DOM, so there is nothing to do there.
  if (typeof AccessibilityInfo.sendAccessibilityEvent !== 'function') return false;
  AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
  return true;
}
