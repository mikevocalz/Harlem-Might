'use client';

import { MightsButton, MightsHeading, MightsText } from '@acme/ui/mights';
import { ScrollView, Text, TextInput, View } from '@acme/ui/tw';
import { noResultsCopy, resultsSummary } from './explore-copy';
import {
  HARLEM_CATEGORIES,
  filterHarlemPlacePreviews,
  useExplore,
  type HarlemPlacePreview,
} from './explore.store';
import { useExploreType } from './explore-type';
import { PlaceRow } from './PlaceRow';

export interface ExploreMasterPaneProps {
  /** A row was chosen. The caller opens the place. */
  onSelectPlace: (place: HarlemPlacePreview) => void;
  /** Shows the map. Pass only where this pane covers the map (compact). */
  onShowMap?: () => void;
  /**
   * Content padding: `window` (24dp) inside a Horizon window or pane, `pane`
   * (16dp) on phones and tablets.
   */
  padding?: 'window' | 'pane';
}

/**
 * The Explore list pane, drawn like the site's master column
 * (apps/web/components/explore/ExploreWorkspace.tsx): the "Explore" title, a
 * square search field with Clear, category toggles as cut-corner buttons, the
 * shared result summary, then flat result rows. Copy comes from
 * `explore-copy.ts`, the same module the site reads, so the two never drift.
 *
 * Search filters on every keystroke: the catalogue is a fixed in-memory list,
 * so there is nothing to debounce.
 */
export function ExploreMasterPane({ onSelectPlace, onShowMap, padding = 'pane' }: ExploreMasterPaneProps) {
  const type = useExploreType();
  const query = useExplore((state) => state.query);
  const category = useExplore((state) => state.category);
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const setQuery = useExplore((state) => state.setQuery);
  const setCategory = useExplore((state) => state.setCategory);
  const places = filterHarlemPlacePreviews(query, category);
  const mapped = places.filter((place) => place.lngLat).length;
  const summary = resultsSummary(places.length, mapped, query, category, 'All');
  const pad = padding === 'window' ? 'px-window' : 'px-4';

  const clearAll = () => {
    setQuery('');
    setCategory('All');
  };

  return (
    <View className="flex-1 bg-surface">
      <View className={'gap-3 border-b border-rule-hairline py-4 ' + pad}>
        <View className="min-h-target flex-row items-center justify-between gap-target-gap">
          <MightsHeading level={1} size="display-md" className={type.paneTitle}>
            Explore
          </MightsHeading>
          {onShowMap ? (
            <MightsButton size="sm" variant="outline" onPress={onShowMap} aria-label="Show the map">
              Map
            </MightsButton>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <TextInput
            aria-label="Search places"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            placeholder="Search places, like Apollo"
            className={
              type.label +
              ' h-12 min-w-0 flex-1 border border-border-strong bg-surface-raised px-4 font-sans text-text placeholder:text-text-muted'
            }
          />
          {query ? (
            <MightsButton size="sm" variant="outline" aria-label="Clear search" onPress={() => setQuery('')}>
              Clear
            </MightsButton>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Filter by category"
          contentContainerClassName="flex-row gap-2 py-1"
        >
          {HARLEM_CATEGORIES.map((item) => {
            const on = item === category;
            return (
              <MightsButton
                key={item}
                size="sm"
                pressed={on}
                variant={on ? 'primary' : 'outline'}
                onPress={() => setCategory(item)}
              >
                {item}
              </MightsButton>
            );
          })}
        </ScrollView>

        <Text accessibilityLiveRegion="polite" className={type.summary + ' font-sans text-text-muted'}>
          {summary}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-24" showsVerticalScrollIndicator={false}>
        {places.length === 0 ? (
          <View className={'items-start gap-3 py-5 ' + pad}>
            <MightsText tone="default">{noResultsCopy(query, category, 'All')}</MightsText>
            <MightsButton size="sm" variant="secondary" onPress={clearAll}>
              Clear search and filters
            </MightsButton>
          </View>
        ) : (
          places.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              padding={padding}
              selected={selectedPlaceId === place.id}
              onPress={() => onSelectPlace(place)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
