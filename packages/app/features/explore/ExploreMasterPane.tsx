'use client';

import { Button, Chip, EmptyState, SearchBar, Text } from '@acme/ui';
import { Pressable, ScrollView, View } from '@acme/ui/tw';
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
  /** Shows the map. Pass only where Discover covers the map (compact). */
  onShowMap?: () => void;
  /**
   * Content padding: `window` (24dp) inside a Horizon window or pane, `pane`
   * (16dp) on phones and tablets.
   */
  padding?: 'window' | 'pane';
}

function countLabel(n: number) {
  return `${n} ${n === 1 ? 'place' : 'places'}`;
}

/**
 * Discover (design handoff §2, copy.md §1): search, category chips, a live
 * result count and the place list.
 */
export function ExploreMasterPane({ onSelectPlace, onShowMap, padding = 'pane' }: ExploreMasterPaneProps) {
  const type = useExploreType();
  const query = useExplore((state) => state.query);
  const category = useExplore((state) => state.category);
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const setQuery = useExplore((state) => state.setQuery);
  const setCategory = useExplore((state) => state.setCategory);
  const places = filterHarlemPlacePreviews(query, category);
  const pad = padding === 'window' ? 'px-window' : 'px-4';

  const clearAll = () => {
    setQuery('');
    setCategory('All');
  };

  let empty: { title: string; description?: string } | null = null;
  if (places.length === 0) {
    empty = query.trim()
      ? { title: `No places match "${query.trim()}".` }
      : { title: `No ${category} places yet.`, description: "We're still adding to the catalogue." };
  }

  return (
    <View className="flex-1 bg-surface-raised">
      <View className={'gap-3 border-b border-border-strong py-4 ' + pad}>
        <View className="min-h-14 flex-row items-center justify-between gap-target-gap">
          <Text role="heading" className={type.heading + ' font-display font-semibold text-text'}>
            Discover
          </Text>
          {onShowMap ? (
            <Pressable
              onPress={onShowMap}
              aria-label="Show the map"
              className="min-h-target min-w-target items-center justify-center rounded-card border border-border-strong bg-surface px-4"
            >
              <Text className={type.label + ' font-semibold text-text'}>Map</Text>
            </Pressable>
          ) : null}
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          debounceMs={180}
          placeholder="Search places, streets, history"
          aria-label="Search Harlem places"
          className="min-h-target"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Filter by category"
          contentContainerClassName="flex-row gap-target-gap pb-1"
        >
          {HARLEM_CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={category === item}
              onPress={() => setCategory(item)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName={'gap-target-gap pt-3 pb-24 ' + pad}
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityLiveRegion="polite" className={type.caption + ' text-text-muted'}>
          {countLabel(places.length)}
        </Text>

        {places.map((place) => (
          <PlaceRow
            key={place.id}
            place={place}
            selected={selectedPlaceId === place.id}
            onPress={() => onSelectPlace(place)}
          />
        ))}

        {empty ? (
          <EmptyState
            icon={<Text className={type.title + ' text-text-muted'}>0</Text>}
            title={empty.title}
            description={empty.description}
            action={
              <Button
                variant="outline"
                title="Clear search and filters"
                className="min-h-target"
                onPress={clearAll}
              />
            }
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
