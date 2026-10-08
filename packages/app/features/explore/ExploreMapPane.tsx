'use client';

import type { ReactNode } from 'react';
import { Text } from '@acme/ui';
import { Pressable, View } from '@acme/ui/tw';
import {
  HARLEM_PLACE_PREVIEWS,
  UNMAPPED_PLACES,
  useExplore,
  type HarlemPlacePreview,
} from './explore.store';
import { useExploreType } from './explore-type';
import { focusTargetRef, markerFocusId } from './focus-registry';
import { FocusPressable } from './FocusPressable';
import { markerLabel, projectSchematic } from './schematic-map';

/** Space in dp the markers keep clear of, so overlays never cover a place. */
export interface MapInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

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

const EDGE = 48;

const byId = new Map(HARLEM_PLACE_PREVIEWS.map((place) => [place.id, place]));
const POINTS = projectSchematic(HARLEM_PLACE_PREVIEWS);

/**
 * The map region (handoff §3), the permanent centre of Explore.
 *
 * Until the native Mapbox surface exists (DECISIONS S11), markers sit on a
 * plain map canvas at their real OpenStreetMap coordinates, fitted to the
 * box. Each marker is a 48dp target with a 20dp dot and its name; the
 * selected one grows to 28dp in gold and announces "Selected". Places with
 * no coordinates get no marker, and a notice counts them.
 */
export function ExploreMapPane({ onSelectPlace, onShowPlaces, insets, children }: ExploreMapPaneProps) {
  const type = useExploreType();
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const pad = insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const unmapped = UNMAPPED_PLACES.length;

  return (
    <View
      aria-label="Harlem map"
      className="relative flex-1 overflow-hidden bg-map-canvas"
    >
      {onShowPlaces ? (
        <View className="absolute left-4 top-4 z-10">
          <Pressable
            onPress={onShowPlaces}
            aria-label="Show the place list"
            className="min-h-target min-w-target items-center justify-center rounded-card border border-border-strong bg-surface-raised px-4"
          >
            <Text className={type.label + ' font-semibold text-text'}>Places</Text>
          </Pressable>
        </View>
      ) : null}

      <View
        className="absolute"
        style={{
          top: pad.top + EDGE,
          right: pad.right + EDGE * 2,
          bottom: pad.bottom + EDGE,
          left: pad.left + EDGE,
        }}
      >
        {POINTS.map((point) => {
          const place = byId.get(point.placeId);
          if (!place) return null;
          const selected = selectedPlaceId === place.id;
          return (
            <FocusPressable
              key={place.id}
              ref={focusTargetRef(markerFocusId(place.id))}
              onPress={() => onSelectPlace(place)}
              accessibilityState={{ selected }}
              aria-selected={selected}
              aria-label={`${place.name}, ${place.category}. ${selected ? 'Selected' : 'Show details'}`}
              className="absolute min-h-target flex-row items-center"
              style={{
                left: `${point.xPercent}%`,
                top: `${point.yPercent}%`,
                transform: [{ translateX: -24 }, { translateY: -24 }],
                zIndex: selected ? 2 : 1,
              }}
            >
              <View className="size-target items-center justify-center">
                <View
                  className={
                    'rounded-full border-2 ' +
                    (selected
                      ? 'size-marker-selected border-on-primary bg-map-marker-selected'
                      : 'size-marker border-rule-rail bg-map-marker')
                  }
                />
              </View>
              <Text
                className={
                  type.label +
                  ' -ml-2 rounded-sm px-1 font-semibold ' +
                  (selected ? 'bg-primary text-on-primary' : 'bg-map-canvas text-text')
                }
              >
                {markerLabel(place.name)}
              </Text>
            </FocusPressable>
          );
        })}
      </View>

      <View
        className="absolute flex-row items-end justify-between gap-target-gap px-4"
        style={{ left: pad.left, right: pad.right, bottom: pad.bottom + 8 }}
        pointerEvents="box-none"
      >
        {unmapped > 0 ? (
          <Text className={type.caption + ' rounded-sm bg-surface-raised px-2 py-1 text-text-muted'}>
            {unmapped === 1 ? "1 place isn't" : `${unmapped} places aren't`} on the map yet
          </Text>
        ) : (
          <View />
        )}
        <Text className={type.caption + ' text-text-muted'}>Locations © OpenStreetMap contributors</Text>
      </View>

      {children}
    </View>
  );
}
