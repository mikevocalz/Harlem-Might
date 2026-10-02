'use client';

import { BusinessIdentity, SearchBar, Text } from '@acme/ui';
import { Pressable, ScrollView, View } from '@acme/ui/tw';
import {
  HARLEM_CATEGORIES,
  filterHarlemPlacePreviews,
  useExplore,
  type HarlemPlacePreview,
} from './explore.store';

export interface ExploreMasterPaneProps {
  onSelectPlace: (place: HarlemPlacePreview) => void;
  onShowMap?: () => void;
}

export function ExploreMasterPane({
  onSelectPlace,
  onShowMap,
}: ExploreMasterPaneProps) {
  const query = useExplore((state) => state.query);
  const category = useExplore((state) => state.category);
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const setQuery = useExplore((state) => state.setQuery);
  const setCategory = useExplore((state) => state.setCategory);
  const places = filterHarlemPlacePreviews(query, category);

  return (
    <View className="flex-1 bg-surface-raised">
      <View className="gap-3 border-b border-border px-4 py-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-display text-xl font-semibold tracking-[-0.03em] text-text">
              Explore Harlem
            </Text>
            <Text className="text-xs leading-5 text-text-muted">
              Search the catalogue, then see the place in spatial context.
            </Text>
          </View>

          {onShowMap ? (
            <Pressable
              onPress={onShowMap}
              className="rounded-lg border border-border bg-surface px-3 py-2 shadow-card"
              aria-label="Show map"
            >
              <Text className="text-xs font-semibold text-primary">Map</Text>
            </Pressable>
          ) : null}
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          debounceMs={180}
          placeholder="Food, jazz, books, history…"
          aria-label="Search Harlem places"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="flex-row gap-2 pb-1"
        >
          {HARLEM_CATEGORIES.map((item) => {
            const isActive = category === item;
            return (
              <Pressable
                key={item}
                role="tab"
                aria-label={'Filter by ' + item}
                onPress={() => setCategory(item)}
                className={
                  'rounded-full border px-3 py-2 ' +
                  (isActive
                    ? 'border-primary bg-primary'
                    : 'border-border bg-surface hover:bg-surface-sunken')
                }
              >
                <Text
                  className={
                    'text-xs font-semibold ' +
                    (isActive ? 'text-on-primary' : 'text-text-muted')
                  }
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 p-3 pb-24"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between px-1 pb-1">
          <Text className="text-xs font-semibold text-text-muted">
            {places.length} {places.length === 1 ? 'place' : 'places'}
          </Text>
          <Text className="text-[11px] text-text-muted">Master catalogue preview</Text>
        </View>

        {places.map((place) => {
          const selected = selectedPlaceId === place.id;
          return (
            <Pressable
              key={place.id}
              onPress={() => onSelectPlace(place)}
              className={
                'gap-3 rounded-xl border p-3 transition-colors duration-fast motion-reduce:transition-none ' +
                (selected
                  ? 'border-primary bg-sky-50/60'
                  : 'border-border bg-surface hover:bg-surface-sunken')
              }
              aria-label={'Open ' + place.name}
            >
              <BusinessIdentity
                name={place.name}
                detail={place.category + ' · ' + place.area}
                size="sm"
                density="compact"
              />
              <Text className="text-xs leading-5 text-text-muted">
                {place.shortDescription}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {place.tags.slice(0, 3).map((tag) => (
                  <View key={tag} className="rounded-full bg-surface-sunken px-2 py-1">
                    <Text className="text-[10px] font-medium text-text-muted">{tag}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}

        {places.length === 0 ? (
          <View className="items-center gap-2 rounded-xl border border-dashed border-border px-5 py-10">
            <Text className="text-sm font-semibold text-text">No matches yet</Text>
            <Text className="text-center text-xs leading-5 text-text-muted">
              Try another category or a broader Harlem search.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
