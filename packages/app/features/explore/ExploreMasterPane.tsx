'use client';

import { MightsButton, MightsEditorialImage, MightsHeading, MightsText } from '@acme/ui/mights';
import { ScrollView, Text, TextInput, View } from '@acme/ui/tw';
import { noResultsCopy, resultsSummary } from './explore-copy';
import {
  HARLEM_CATEGORIES,
  HARLEM_PLACE_PREVIEWS,
  filterHarlemPlacePreviews,
  useExplore,
  type HarlemPlacePreview,
} from './explore.store';
import { useExploreType } from './explore-type';
import { getHarlemArchivalImage } from '../../content';
import { PlaceRow } from './PlaceRow';

const archiveImage = getHarlemArchivalImage('nypl-pushcart-vendors-eighth-avenue-1939');

export interface ExploreMasterPaneProps {
  /** A row was chosen. The caller opens the place. */
  onSelectPlace: (place: HarlemPlacePreview) => void;
  /** Shows the map. Pass only where this pane covers the map (compact). */
  onShowMap?: () => void;
  /**
   * Folds this pane back behind the map's "Places" toggle. Pass only where it
   * was opened from that toggle beside the map (a narrow Horizon window).
   */
  onClose?: () => void;
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
export function ExploreMasterPane({ onSelectPlace, onShowMap, onClose, padding = 'pane' }: ExploreMasterPaneProps) {
  const type = useExploreType();
  const query = useExplore((state) => state.query);
  const category = useExplore((state) => state.category);
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const setQuery = useExplore((state) => state.setQuery);
  const setCategory = useExplore((state) => state.setCategory);
  const places = filterHarlemPlacePreviews(query, category);
  const recentIds = useExplore((state) => state.recentIds);
  const recents = recentIds.flatMap((id) => HARLEM_PLACE_PREVIEWS.filter((p) => p.id === id));
  const mapped = places.filter((place) => place.lngLat).length;
  const summary = resultsSummary(places.length, mapped, query, category, 'All');
  const pad = padding === 'window' ? 'px-window' : 'px-4';

  const clearAll = () => {
    setQuery('');
    setCategory('All');
  };

  return (
    <View className="flex-1 bg-surface">
      <View className={type.stackGap + ' border-b border-rule-hairline py-4 ' + pad}>
        <View className="min-h-target flex-row items-center justify-between gap-target-gap">
          <MightsHeading level={1} size="display-md" className={type.paneTitle}>
            Explore
          </MightsHeading>
          {onShowMap ? (
            <MightsButton size={type.buttons.control} variant="outline" onPress={onShowMap} aria-label="Show the map">
              Map
            </MightsButton>
          ) : null}
          {onClose ? (
            <MightsButton size={type.buttons.primary} variant="ghost" onPress={onClose} aria-label="Close the place list">
              Close
            </MightsButton>
          ) : null}
        </View>

        <View className={type.inlineGap + ' flex-row items-center'}>
          <TextInput
            aria-label="Search places"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            placeholder="Search places, like Apollo"
            className={
              type.label +
              ' ' + type.search + ' min-w-0 flex-1 border border-border-strong bg-surface-raised px-4 font-sans text-text placeholder:text-text-muted'
            }
          />
          {query ? (
            <MightsButton size={type.buttons.control} variant="outline" aria-label="Clear search" onPress={() => setQuery('')}>
              Clear
            </MightsButton>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Filter by category"
          contentContainerClassName={type.inlineGap + ' flex-row py-1'}
        >
          {HARLEM_CATEGORIES.map((item) => {
            const on = item === category;
            return (
              <MightsButton
                key={item}
                size={type.buttons.control}
                pressed={on}
                variant={on ? 'primary' : 'outline'}
                onPress={() => setCategory(item)}
              >
                {item}
              </MightsButton>
            );
          })}
        </ScrollView>

        {/* Recently viewed — the same session strip the site renders under
            its filters (shared `recentIds` in the explore store). */}
        {recents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityLabel="Recently viewed"
            contentContainerClassName={type.inlineGap + ' flex-row items-center py-1'}
          >
            <Text className={type.summary + ' font-sans text-text-muted'}>Recent</Text>
            {recents.map((place) => (
              <MightsButton
                key={place.id}
                size={type.buttons.control}
                variant="ghost"
                pressed={place.id === selectedPlaceId}
                aria-label={`Open ${place.name} again`}
                onPress={() => onSelectPlace(place)}
              >
                {place.name}
              </MightsButton>
            ))}
          </ScrollView>
        ) : null}

        <Text accessibilityLiveRegion="polite" className={type.summary + ' font-sans text-text-muted'}>
          {summary}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-24" showsVerticalScrollIndicator={false}>
        {archiveImage ? (
          <View className={padding === 'window' ? 'px-window py-4' : 'px-4 py-4'}>
            <MightsEditorialImage image={archiveImage} screenId="explore-discover" ratio="wide" />
          </View>
        ) : null}
        {places.length === 0 ? (
          <View className={'items-start py-5 ' + type.stackGap + ' ' + pad}>
            <MightsText tone="default">{noResultsCopy(query, category, 'All')}</MightsText>
            <MightsButton size={type.buttons.control} variant="secondary" onPress={clearAll}>
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
