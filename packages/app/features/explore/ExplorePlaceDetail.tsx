'use client';

import { useEffect } from 'react';
import { Button, IconButton, Text } from '@acme/ui';
import { X } from '@acme/ui/icons';
import { Pressable, ScrollView, View } from '@acme/ui/tw';
import {
  formatDistance,
  getHarlemPlacePreview,
  nearbyPlaces,
  placeStreetLine,
  useExplore,
  type HarlemPlacePreview,
} from './explore.store';
import { useExploreType } from './explore-type';
import { DETAIL_HEADING_FOCUS_ID, focusTargetRef, moveFocusTo } from './focus-registry';

export interface ExplorePlaceDetailProps {
  /** The place to show. An unknown id renders the not-found state. */
  placeId: string;
  /** Closes Detail; the caller clears the selection. */
  onClose: () => void;
  /**
   * `close` (an X) where Detail sits beside the map; `back` where it covers
   * the map (compact).
   */
  dismissKind?: 'close' | 'back';
  /** Shows the map. Pass only where Detail covers it (compact). */
  onShowOnMap?: () => void;
  /** A Nearby row was chosen. */
  onSelectNearby: (place: HarlemPlacePreview) => void;
  /** `window` (24dp) in a Horizon window or pane, `pane` (16dp) elsewhere. */
  padding?: 'window' | 'pane';
}

/** OSM's fetch date for the seed coordinates (explore.store.ts). */
const LOCATION_CHECKED = '3 Oct 2026';

/**
 * Place Detail (handoff §5, copy.md §3). One column: gold rail, Close/Save
 * bar, title, street, lead, actions, "Why it matters", Nearby and "Where this
 * comes from". A section with no data doesn't render; nothing promises
 * hours, menus or events the record doesn't hold.
 *
 * On open, screen-reader focus moves to the title. The title is a header, so
 * gaze and TalkBack find it first inside a Horizon window too.
 */
export function ExplorePlaceDetail({
  placeId,
  onClose,
  dismissKind = 'close',
  onShowOnMap,
  onSelectNearby,
  padding = 'pane',
}: ExplorePlaceDetailProps) {
  const type = useExploreType();
  const place = getHarlemPlacePreview(placeId);
  const saved = useExplore((state) => state.savedPreviewIds.includes(placeId));
  const toggleSavedPreview = useExplore((state) => state.toggleSavedPreview);
  const pad = padding === 'window' ? 'px-window' : 'px-4';

  useEffect(() => {
    moveFocusTo(DETAIL_HEADING_FOCUS_ID);
  }, [placeId]);

  const dismiss =
    dismissKind === 'back' ? (
      <Pressable
        onPress={onClose}
        aria-label="Back to map"
        className="min-h-target min-w-target items-center justify-center rounded-card px-3"
      >
        <Text className={type.label + ' font-semibold text-text'}>Back</Text>
      </Pressable>
    ) : (
      <IconButton
        size="lg"
        variant="ghost"
        aria-label="Close details"
        icon={<X size={22} strokeWidth={2.5} className="text-text" />}
        onPress={onClose}
      />
    );

  if (!place) {
    return (
      <View className="flex-1 bg-surface-raised">
        <View className={'min-h-14 flex-row items-center ' + pad}>{dismiss}</View>
        <View className={'flex-1 justify-center gap-3 ' + pad}>
          <Text
            ref={focusTargetRef(DETAIL_HEADING_FOCUS_ID) as never}
            role="heading"
            className={type.title + ' font-semibold text-text'}
          >
            {"We couldn't find that place."}
          </Text>
          <Text className={type.body + ' text-text-muted'}>
            It may have been renamed or removed.
          </Text>
          <Button variant="outline" title="Back to Discover" className="min-h-target" onPress={onClose} />
        </View>
      </View>
    );
  }

  const near = nearbyPlaces(place.id, 3);

  return (
    <View className="flex-1 bg-surface-raised" aria-label={`Details: ${place.name}`}>
      {/* The gold rail says "this shows the selected place" (direction.md, principle 1). */}
      <View className="h-rail bg-primary" />
      <View className={'min-h-14 flex-row items-center justify-between ' + pad}>{dismiss}</View>

      <ScrollView
        className="flex-1"
        contentContainerClassName={'max-w-content-prose gap-6 pb-12 ' + pad}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2">
          <Text
            ref={focusTargetRef(DETAIL_HEADING_FOCUS_ID) as never}
            role="heading"
            className={type.heading + ' font-display font-semibold text-text'}
          >
            {place.name}
          </Text>
          <Text className={type.body + ' text-brownstone'}>
            {placeStreetLine(place)}, {place.category.toLowerCase()}
          </Text>
          <Text className={type.body + ' text-text'}>{place.shortDescription}</Text>
        </View>

        <View className="flex-row flex-wrap gap-target-gap">
          {onShowOnMap ? (
            <Button variant="primary" title="Show on map" className="min-h-target" onPress={onShowOnMap} />
          ) : null}
          <Button
            variant="outline"
            title={saved ? 'Saved' : 'Save'}
            aria-label={saved ? `Saved ${place.name}. Tap to remove.` : `Save ${place.name}`}
            className="min-h-target"
            onPress={() => toggleSavedPreview(place.id)}
          />
        </View>

        <View className="gap-2 border-t border-rule-hairline pt-6">
          <Text role="heading" className={type.title + ' font-semibold text-text'}>
            Why it matters
          </Text>
          <Text className={type.prose + ' text-text'}>{place.whyItMatters}</Text>
        </View>

        {near.length > 0 ? (
          <View className="gap-2 border-t border-rule-hairline pt-6">
            <Text role="heading" className={type.title + ' font-semibold text-text'}>
              Nearby
            </Text>
            {near.map(({ place: other, meters }) => (
              <Pressable
                key={other.id}
                onPress={() => onSelectNearby(other)}
                aria-label={`${other.name}, ${formatDistance(meters)} away`}
                className="min-h-target justify-center"
              >
                <Text className={type.body + ' text-text'}>
                  {other.name} · {formatDistance(meters)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View className="gap-1 border-t border-rule-hairline pt-6">
          <Text role="heading" className={type.title + ' font-semibold text-text'}>
            Where this comes from
          </Text>
          <Text className={type.body + ' text-text-muted'}>
            {place.lngLat && place.osm
              ? `Location from OpenStreetMap (${place.osm}), checked ${LOCATION_CHECKED}`
              : 'Location not verified yet'}
          </Text>
          <Text className={type.body + ' text-text-muted'}>Description written by Harlem Might</Text>
          <Text className={type.caption + ' text-text-muted'}>
            No photos yet. We only show photos the venue or an archive has cleared for use.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
