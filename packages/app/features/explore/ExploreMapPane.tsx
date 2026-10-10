'use client';

import type { ReactNode } from 'react';
import { MightsButton } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import { UNMAPPED_PLACES, type HarlemPlacePreview } from './explore.store';
import { useExploreType } from './explore-type';
import { ExploreMap } from './ExploreMap';
import type { MapInsets } from './ExploreMap.types.ts';
import { useNativeMap, useNativeMapLive } from './native-map.store.ts';
import { useNavigationStore } from '../navigation/session/navigationStore';

export type { MapInsets } from './ExploreMap.types.ts';

export interface ExploreMapPaneProps {
  /** A marker was chosen. The caller opens the place. */
  onSelectPlace: (place: HarlemPlacePreview) => void;
  /** Shows the place list. Pass only where Discover is hidden (compact, medium). */
  onShowPlaces?: () => void;
  /**
   * Room taken by panes or panels drawn over the map. The markers lay out
   * inside what remains (the camera-padding contract, handoff §3).
   */
  insets?: MapInsets;
  /** Drawn over the map: the assistant bar and panel. */
  children?: ReactNode;
}

/** Room the Mapbox logo and attribution button take at the map's bottom edge. */
const MAPBOX_ORNAMENT_CLEARANCE = 40;

/**
 * The map region (handoff §3), the permanent centre of Explore.
 *
 * Phones and foldables get the native Mapbox street map; web and the headset
 * build get the schematic (docs/adr/0007-native-mapbox-map-mobile.md,
 * resolving DECISIONS S16 for phone and foldable). `ExploreMap` picks one;
 * this pane is the frame around it: the Places toggle, the insets, the
 * caption and the attribution. Places with no coordinates get no marker, and
 * a notice counts them.
 */
export function ExploreMapPane({ onSelectPlace, onShowPlaces, insets, children }: ExploreMapPaneProps) {
  const type = useExploreType();
  const pad = insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const unmapped = UNMAPPED_PLACES.length;
  const hasRoute = useNavigationStore((s) => s.session.phase === 'routeReady' || 'activeRoute' in s.session);
  const nativeLive = useNativeMapLive();
  const nativeError = useNativeMap((s) => (s.status === 'failed' ? s.error : null));
  const nativeLoading = useNativeMap((s) => s.status === 'loading');

  return (
    <View
      aria-label="Harlem map"
      className="relative flex-1 overflow-hidden bg-map-canvas"
    >
      {/* First, so the controls and captions below draw over the map. */}
      <ExploreMap onSelectPlace={onSelectPlace} insets={pad} />

      {onShowPlaces ? (
        <View className="absolute left-4 top-4 z-10">
          <MightsButton size={type.buttons.control} variant="outline" onPress={onShowPlaces} aria-label="Show the place list">
            Places
          </MightsButton>
        </View>
      ) : null}

      <View
        className="absolute flex-row items-end justify-between gap-target-gap px-4"
        style={{
          left: pad.left,
          right: pad.right,
          // Never over the Mapbox logo or attribution button, which the map must show.
          bottom: pad.bottom + 8 + (nativeLive ? MAPBOX_ORNAMENT_CLEARANCE : 0),
        }}
        pointerEvents="box-none"
      >
        <View className="shrink gap-1">
          {nativeError != null ? (
            <View className="self-start gap-1 bg-surface-raised px-2 py-1">
              <Text className={type.caption + ' font-sans text-text'}>
                The street map didn’t load, so this is the schematic. {nativeError}
              </Text>
              <View className="self-start">
                <MightsButton size={type.buttons.control} variant="outline" onPress={() => useNativeMap.getState().setStatus('off')}>
                  Load street map
                </MightsButton>
              </View>
            </View>
          ) : nativeLoading ? (
            <Text className={type.caption + ' self-start bg-surface-raised px-2 py-1 font-sans text-text'}>
              Loading the street map…
            </Text>
          ) : nativeLive ? null : (
            <Text className={type.caption + ' self-start bg-surface-raised px-2 py-1 font-sans text-text'}>
              {hasRoute
                ? 'Schematic map. The route’s shape is real; streets aren’t drawn yet.'
                : 'Schematic map. Street map coming.'}
            </Text>
          )}
          {unmapped > 0 ? (
            <Text className={type.caption + ' self-start bg-surface-raised px-2 py-1 font-sans text-text-muted'}>
              {unmapped === 1 ? "1 place isn't" : `${unmapped} places aren't`} on the map yet
            </Text>
          ) : null}
        </View>
        <Text className={type.caption + ' font-sans text-text-muted'}>
          {nativeLive ? '© Mapbox © OpenStreetMap contributors' : 'Locations © OpenStreetMap contributors'}
        </Text>
      </View>

      {children}
    </View>
  );
}
