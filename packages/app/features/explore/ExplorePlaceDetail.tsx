'use client';

import { useEffect } from 'react';
import { MightsButton, MightsHeading, MightsLocationStamp, MightsText } from '@acme/ui/mights';
import { Pressable, ScrollView, Text, View } from '@acme/ui/tw';
import { directionsUrl } from './explore-copy';
import { formatDistance, getHarlemPlacePreview, nearbyPlaces, placeStreetLine, type HarlemPlacePreview } from './explore.store';
import { useExploreType } from './explore-type';
import { DETAIL_HEADING_FOCUS_ID, focusTargetRef, moveFocusTo } from './focus-registry';

export interface ExplorePlaceDetailProps {
  /** The place to show. An unknown id renders the not-found state. */
  placeId: string;
  /** Closes Detail; the caller clears the selection. */
  onClose: () => void;
  /**
   * `close` where Detail sits beside the map (a leading gold rail); `back`
   * where it covers the map on a phone (a top gold rail, "Back" label).
   */
  dismissKind?: 'close' | 'back';
  /** Shows the map. Pass only where Detail covers it (compact). */
  onShowOnMap?: () => void;
  /** A Nearby row was chosen. */
  onSelectNearby: (place: HarlemPlacePreview) => void;
  /**
   * Absolute URL of the place's page on the site. Omit when the build has no
   * site address; the "Open place page" action is then left out rather than
   * shown dead.
   */
  placePageUrl?: string;
  /** `window` (24dp) in a Horizon window or pane, `pane` (16dp) elsewhere. */
  padding?: 'window' | 'pane';
}

/** OSM's fetch date for the seed coordinates (explore.store.ts). */
const LOCATION_CHECKED = '3 Oct 2026';

/**
 * Place Detail, drawn like the site's inspector
 * (apps/web/components/explore/ExploreWorkspace.tsx): a gold rail frame, the
 * place name with a text Close, the location stamp (category, street), the
 * short description and the site's two actions, "Get directions" and "Open
 * place page". Below them, Nearby and "Where this comes from", which the
 * native pane has room for.
 *
 * Shows `shortDescription`, never `whyItMatters`: the fixture's whyItMatters is
 * planning copy about the product, not a fact about the place. No Save until
 * saved places sync to an account (D8), matching the site.
 *
 * On open, screen-reader focus moves to the title, so gaze and TalkBack find
 * it first inside a Horizon window too.
 */
export function ExplorePlaceDetail({
  placeId,
  onClose,
  dismissKind = 'close',
  onShowOnMap,
  onSelectNearby,
  placePageUrl,
  padding = 'pane',
}: ExplorePlaceDetailProps) {
  const type = useExploreType();
  const place = getHarlemPlacePreview(placeId);
  const pad = padding === 'window' ? 'px-window' : 'px-4';
  // The rail sits on the edge that meets the map: leading beside it, top over it.
  const frame = dismissKind === 'back' ? 'pt-rail' : 'pl-rail';
  const dismissLabel = dismissKind === 'back' ? 'Back' : 'Close';

  useEffect(() => {
    moveFocusTo(DETAIL_HEADING_FOCUS_ID);
  }, [placeId]);

  // The focus registry needs the heading's host view, and MightsHeading takes
  // no ref, so a grouped wrapper carries the heading role and the ref.
  const title = (text: string) => (
    <View
      ref={focusTargetRef(DETAIL_HEADING_FOCUS_ID) as never}
      {...({ accessible: true, accessibilityRole: 'header', accessibilityLabel: text } as object)}
      className="min-w-0 flex-1"
    >
      <MightsHeading level={2} size="title" className={type.heading}>
        {text}
      </MightsHeading>
    </View>
  );

  if (!place) {
    return (
      <View className={'flex-1 bg-primary ' + frame}>
        <View className={'flex-1 gap-4 bg-surface-raised py-5 ' + pad}>
          <View className="flex-row items-start justify-between gap-4">
            {title('We couldn’t find that place.')}
            <MightsButton size="sm" variant="ghost" onPress={onClose} aria-label={`${dismissLabel} details`}>
              {dismissLabel}
            </MightsButton>
          </View>
          <MightsText>It may have been renamed or removed.</MightsText>
          <MightsButton size="sm" variant="secondary" onPress={onClose}>
            Back to Explore
          </MightsButton>
        </View>
      </View>
    );
  }

  const near = nearbyPlaces(place.id, 3);

  return (
    <View className={'flex-1 bg-primary ' + frame} aria-label={`Details: ${place.name}`}>
      <View className="flex-1 bg-surface-raised">
        <View className={'border-b border-rule-hairline py-4 ' + pad}>
          <View className="flex-row items-start justify-between gap-4">
            {title(place.name)}
            <MightsButton
              size="sm"
              variant="ghost"
              onPress={onClose}
              aria-label={dismissKind === 'back' ? `Back to the map from ${place.name}` : `Close ${place.name}`}
            >
              {dismissLabel}
            </MightsButton>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName={'max-w-content-prose gap-5 py-5 pb-12 ' + pad}
          showsVerticalScrollIndicator={false}
        >
          <MightsLocationStamp name={place.category} street={placeStreetLine(place)} />
          <MightsText tone="default" className={type.body}>
            {place.shortDescription}
          </MightsText>
          {place.lngLat ? null : (
            <MightsText size="small" className={type.caption}>
              Location pending verification.
            </MightsText>
          )}

          <View className="flex-row flex-wrap gap-3">
            {onShowOnMap ? (
              <MightsButton size="sm" variant="outline" onPress={onShowOnMap}>
                Show on map
              </MightsButton>
            ) : null}
            {place.lngLat ? (
              <MightsButton size="sm" href={directionsUrl(place.lngLat)} external>
                Get directions
              </MightsButton>
            ) : null}
            {placePageUrl ? (
              <MightsButton size="sm" variant="secondary" href={placePageUrl} external>
                Open place page
              </MightsButton>
            ) : null}
          </View>

          {near.length > 0 ? (
            <View className="gap-1 border-t border-rule-hairline pt-5">
              <MightsHeading level={3} size="card" className={type.title}>
                Nearby
              </MightsHeading>
              {near.map(({ place: other, meters }) => (
                <Pressable
                  key={other.id}
                  onPress={() => onSelectNearby(other)}
                  aria-label={`${other.name}, ${formatDistance(meters)} away`}
                  className="min-h-target flex-row items-center gap-3 active:bg-surface-sunken"
                >
                  <View className="size-2 rotate-45 bg-rule-rail" />
                  <Text className={type.body + ' flex-1 font-sans text-text'}>{other.name}</Text>
                  <Text className={type.caption + ' font-sans text-text-muted'}>{formatDistance(meters)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View className="gap-1 border-t border-rule-hairline pt-5">
            <MightsHeading level={3} size="card" className={type.title}>
              Where this comes from
            </MightsHeading>
            <MightsText size="small" className={type.caption}>
              {place.lngLat && place.osm
                ? `Location from OpenStreetMap (${place.osm}), checked ${LOCATION_CHECKED}.`
                : 'Location not verified yet.'}
            </MightsText>
            <MightsText size="small" className={type.caption}>
              Description written by Harlem Might.
            </MightsText>
            <MightsText size="small" className={type.caption}>
              No photos yet. We only show photos the venue or an archive has cleared for use.
            </MightsText>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
