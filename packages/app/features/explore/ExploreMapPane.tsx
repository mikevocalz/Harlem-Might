'use client';

import { useMemo, type ReactNode } from 'react';
import { MightsButton } from '@acme/ui/mights';
import { Text, View } from '@acme/ui/tw';
import {
  HARLEM_PLACE_PREVIEWS,
  UNMAPPED_PLACES,
  useExplore,
  type HarlemPlacePreview,
} from './explore.store';
import { useExploreType } from './explore-type';
import { focusTargetRef, markerFocusId } from './focus-registry';
import { FocusPressable } from './FocusPressable';
import { markerLabel, projectSchematic, schematicBounds } from './schematic-map';
import { useNavigationStore } from '../navigation/session/navigationStore';
import { RouteSchematicLayer } from '../navigation/ui/RouteSchematicLayer';
import { selectDisplayedRoute, toLngLat } from '../navigation/view/routeLine';

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
const PLACE_LNGLATS = HARLEM_PLACE_PREVIEWS.flatMap((place) => (place.lngLat ? [place.lngLat] : []));

/**
 * The map region (handoff §3), the permanent centre of Explore.
 *
 * A schematic, not a street map (DECISIONS S16: the native street map waits
 * on the D2 style and a Horizon-compatible map SDK), and the caption says so.
 * Markers sit on the dark map canvas at their real OpenStreetMap coordinates,
 * fitted to the box. Each is a 48dp target around a gold diamond, the same
 * mark the site's Mapbox markers draw (ExploreMap.tsx). Selection grows the
 * diamond, rings it in the text colour, shows the name beside it and sets the
 * `selected` state, so it never rests on colour alone. Places with no
 * coordinates get no marker, and a notice counts them.
 */
export function ExploreMapPane({ onSelectPlace, onShowPlaces, insets, children }: ExploreMapPaneProps) {
  const type = useExploreType();
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  const pad = insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const unmapped = UNMAPPED_PLACES.length;
  // The session's route, when there is one. The fit grows to hold it, so a
  // route starting outside the catalogue's corner still lands in the box and
  // the markers move with it.
  const session = useNavigationStore((s) => s.session);
  const displayed = useMemo(() => selectDisplayedRoute({ session }), [session]);
  const routeKey = displayed ? `${displayed.route.id}:${displayed.generation}` : '';
  const { points, bounds } = useMemo(() => {
    const line = displayed ? toLngLat(displayed.route.geometry.coordinates) : [];
    return {
      points: projectSchematic(HARLEM_PLACE_PREVIEWS, line),
      bounds: schematicBounds([...PLACE_LNGLATS, ...line]),
    };
    // routeKey identifies the geometry; the route object is immutable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  return (
    <View
      aria-label="Harlem map"
      className="relative flex-1 overflow-hidden bg-map-canvas"
    >
      {onShowPlaces ? (
        <View className="absolute left-4 top-4 z-10">
          <MightsButton size={type.buttons.control} variant="outline" onPress={onShowPlaces} aria-label="Show the place list">
            Places
          </MightsButton>
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
        {displayed && bounds ? <RouteSchematicLayer route={displayed} bounds={bounds} /> : null}
        {points.map((point) => {
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
                    'rotate-45 border-2 bg-primary ' + (selected ? 'size-4.5 border-text' : 'size-3 border-surface')
                  }
                />
              </View>
              {selected ? (
                <Text
                  numberOfLines={1}
                  className={type.caption + ' -ml-2 border-l-2 border-primary bg-surface-raised px-2 font-sans-semibold text-text'}
                >
                  {markerLabel(place.name)}
                </Text>
              ) : null}
            </FocusPressable>
          );
        })}
      </View>

      <View
        className="absolute flex-row items-end justify-between gap-target-gap px-4"
        style={{ left: pad.left, right: pad.right, bottom: pad.bottom + 8 }}
        pointerEvents="box-none"
      >
        <View className="shrink gap-1">
          <Text className={type.caption + ' self-start bg-surface-raised px-2 py-1 font-sans text-text'}>
            {displayed
              ? 'Schematic map. The route’s shape is real; streets aren’t drawn yet.'
              : 'Schematic map. Street map coming.'}
          </Text>
          {unmapped > 0 ? (
            <Text className={type.caption + ' self-start bg-surface-raised px-2 py-1 font-sans text-text-muted'}>
              {unmapped === 1 ? "1 place isn't" : `${unmapped} places aren't`} on the map yet
            </Text>
          ) : null}
        </View>
        <Text className={type.caption + ' font-sans text-text-muted'}>Locations © OpenStreetMap contributors</Text>
      </View>

      {children}
    </View>
  );
}
