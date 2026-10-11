'use client';

import { useMemo } from 'react';
import { Text, View } from '@acme/ui/tw';
import { useExplore } from './explore.store';
import { usePlaceCatalogue } from './place-catalogue.store.ts';
import { useExploreType } from './explore-type';
import type { ExploreMapProps } from './ExploreMap.types.ts';
import { focusTargetRef, markerFocusId } from './focus-registry';
import { FocusPressable } from './FocusPressable';
import { markerLabel, projectSchematic, schematicBounds } from './schematic-map';
import { useNavigationStore } from '../navigation/session/navigationStore';
import { RouteSchematicLayer } from '../navigation/ui/RouteSchematicLayer';
import { selectDisplayedRoute, toLngLat } from '../navigation/view/routeLine';

const EDGE = 48;

/**
 * The schematic map: markers on the dark map canvas at their real
 * OpenStreetMap coordinates, fitted to the box, with no streets drawn. Each is
 * a 48dp target around a gold diamond, the same mark the site's Mapbox markers
 * draw. Selection grows the diamond, rings it in the text colour, shows the
 * name beside it and sets the `selected` state, so it never rests on colour
 * alone. Places with no coordinates get no marker.
 *
 * The web fallback draws this. Native builds, including Quest, draw the
 * Mapbox map instead and fall back to this only when that view is not linked
 * or fails to load (docs/adr/0007-native-mapbox-map-mobile.md).
 */
export function ExploreSchematicMap({ onSelectPlace, insets }: ExploreMapProps) {
  const type = useExploreType();
  const catalogue = usePlaceCatalogue((s) => s.places);
  const byId = useMemo(() => new Map(catalogue.map((p) => [p.id, p])), [catalogue]);
  const lngLats = useMemo(() => catalogue.flatMap((p) => p.lngLat ? [p.lngLat] : []), [catalogue]);
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);
  // The session's route, when there is one. The fit grows to hold it, so a
  // route starting outside the catalogue's corner still lands in the box and
  // the markers move with it.
  const session = useNavigationStore((s) => s.session);
  const displayed = useMemo(() => selectDisplayedRoute({ session }), [session]);
  const routeKey = displayed ? `${displayed.route.id}:${displayed.generation}` : '';
  const { points, bounds } = useMemo(() => {
    const line = displayed ? toLngLat(displayed.route.geometry.coordinates) : [];
    return {
      points: projectSchematic(catalogue, line),
      bounds: schematicBounds([...lngLats, ...line]),
    };
    // routeKey identifies the geometry; the route object is immutable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, catalogue, lngLats]);

  return (
    <View
      className="absolute"
      style={{
        top: insets.top + EDGE,
        right: insets.right + EDGE * 2,
        bottom: insets.bottom + EDGE,
        left: insets.left + EDGE,
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
  );
}
