'use client';
import { useEffect } from 'react';
import { Keyboard } from 'react-native';
import { useDebouncedCallback } from '@tanstack/react-pacer';
import { SearchBar } from '@acme/ui';
import { Text, View } from '@acme/ui/tw';
import type { SearchablePane } from './pane-search.ts';
import { usePaneSearch, usePaneSearchStore } from './pane-search.store.ts';

export interface PaneSearchBarProps {
  pane: SearchablePane;
  placeholder?: string;
  /** Announced with the query so results are not a silent change. */
  resultCount?: number;
  className?: string;
}

/**
 * Search field for a pane.
 *
 * COMPOSED, NOT A `searchable` FLAG — deliberately. A boolean on the pane would
 * make the pane own the placeholder, the result count and the field's position
 * in its own header, none of which the split view can know. Composition also
 * gives the brief's "no layout space when absent" for free: a pane that does
 * not render this has nothing to reserve, so it is byte-identical to a pane
 * that never had the option, rather than relying on a conditional collapsing to
 * exactly zero height.
 *
 * DEBOUNCE IS OWNED HERE, not delegated to the kit's SearchBar. That component
 * debounces `onChangeText` and keeps the instant text in its own internal
 * store, which would hand this callback the DELAYED value — so the store's
 * draft would lag the field and Back could not clear a query typed within the
 * debounce window. Driving the field from the store (`value={draft}`) keeps the
 * echo instant, since the store updates on every keystroke, and the debounce
 * applies only to `query`, which is what consumers filter on.
 */
const DEBOUNCE_MS = 200;

export function PaneSearchBar({ pane, placeholder, resultCount, className }: PaneSearchBarProps) {
  const { draft, query, focused } = usePaneSearch(pane);
  const setDraft = usePaneSearchStore((state) => state.setDraft);
  const setQuery = usePaneSearchStore((state) => state.setQuery);
  const setFocused = usePaneSearchStore((state) => state.setFocused);

  const commitQuery = useDebouncedCallback(
    (next: string) => setQuery(pane, next),
    { wait: DEBOUNCE_MS },
  );

  // Back's blur outcome only flips the store flag; the keyboard is native and
  // has to be told separately, or the field loses focus while the keyboard
  // stays up covering half the pane.
  useEffect(() => {
    if (!focused) Keyboard.dismiss();
  }, [focused]);

  return (
    <View className={`gap-1 ${className ?? ''}`}>
      <SearchBar
        value={draft}
        onChangeText={(text) => {
          // Immediate: what the field shows and what Back clears.
          setDraft(pane, text);
          // Delayed: what the list filters on.
          commitQuery(text);
        }}
        onFocus={() => setFocused(pane, true)}
        onBlur={() => setFocused(pane, false)}
        placeholder={placeholder ?? 'Search'}
        aria-label={placeholder ?? 'Search'}
      />

      {/* Announced, not just drawn: a filtered list that changes silently gives
          a screen-reader user no feedback that typing did anything. */}
      {query.length > 0 && resultCount !== undefined ? (
        <Text
          role="status"
          aria-live="polite"
          className="text-xs text-text-muted md:text-sm"
        >
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </Text>
      ) : null}
    </View>
  );
}
