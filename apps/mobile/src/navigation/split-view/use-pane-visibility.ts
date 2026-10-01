'use client';
import { useWindowDimensions } from 'react-native';
import { windowSizeClassForWidth, type PaneVisibility } from './constants.ts';
import { resolvePaneVisibility } from './pane-overrides.ts';
import { usePaneOverrideStore } from './pane-overrides.store.ts';

/**
 * The resolved visibility a pane's CONTENT can read.
 *
 * The layout already resolves this internally to decide what to render; this
 * exposes the same answer to the panes themselves, so the sidebar can tell it
 * is in rail mode and drop its labels. Both go through
 * `resolvePaneVisibility`, so there is one precedence rule, not two.
 */
export function usePaneVisibility(columnCount: 1 | 2 = 2): PaneVisibility {
  const { width } = useWindowDimensions();
  const overrides = usePaneOverrideStore((state) => state.overrides);
  return resolvePaneVisibility(windowSizeClassForWidth(width), columnCount, overrides);
}
