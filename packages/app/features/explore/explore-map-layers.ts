import { semantic } from '@acme/theme';
import type {
  NativeMapBounds,
  NativeMapEdgeInsets,
  NativeMapLayer,
  NativeMapScreenPoint,
  NativeMapStandardConfig,
} from './native-map-module.ts';

/**
 * Style, sources and layers of Explore's native Mapbox map. Plain data and
 * pure functions, so they are tested under node:test and the component only
 * wires them to the view.
 *
 * Values follow the site's GL JS map (apps/web/components/explore/ExploreMap.tsx,
 * ADR 0003) so phone and web read as one map: Standard with the faded theme
 * in day light, 3D objects on, POI labels off, gold place dots, a gold route
 * over a dark casing. Dark only (DECISIONS S14), so the dark token values.
 */

export const EXPLORE_MAP_STYLE_URI = 'mapbox://styles/mapbox/standard';

export const EXPLORE_MAP_STANDARD_CONFIG: NativeMapStandardConfig = {
  importId: 'basemap',
  theme: 'faded',
  lightPreset: 'day',
  show3dObjects: true,
  showPointOfInterestLabels: false,
};

/** Camera framing, from the web map: catalogue padding and the zoom cap for a fit. */
export const FIT_PADDING = 96;
export const FIT_MAX_ZOOM = 15.5;
/** A selection opens at least this close, as on web. */
export const SELECT_MIN_ZOOM = 16.5;
export const BUILDING_PITCH = 64;
export const BUILDING_BEARING = -18;
export const ROUTE_FIT_PADDING = 64;
export const ROUTE_MAX_ZOOM = 17;
/**
 * Half the side of the box queried around a tap, in points. 22 makes the
 * 44pt target the schematic markers have.
 */
export const TAP_SLOP = 22;
/** No padded axis may eat more than this share of the view, or a fit has nothing left to draw in. */
const MAX_PADDING_SHARE = 0.7;

export const PLACES_SOURCE = 'hm-places';
export const SELECTED_SOURCE = 'hm-selected-place';
export const ROUTE_AHEAD_SOURCE = 'hm-route-ahead';
export const ROUTE_WALKED_SOURCE = 'hm-route-walked';
export const ROUTE_ALTERNATIVES_SOURCE = 'hm-route-alternatives';

export const DOTS_LAYER = 'hm-place-dots';
export const LABELS_LAYER = 'hm-place-labels';
export const SELECTED_DOT_LAYER = 'hm-selected-dot';
export const SELECTED_LABEL_LAYER = 'hm-selected-label';
/** Layers a tap may select a place from. */
export const TAPPABLE_LAYERS = [SELECTED_DOT_LAYER, DOTS_LAYER];

const GOLD = semantic.primary.dark;
const SURFACE = semantic.surface.dark;
const TEXT = semantic.text.dark;
const WALKED = semantic['rule-rail'].dark;
const FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];
const LINE_LAYOUT = { 'line-join': 'round', 'line-cap': 'round' };

/**
 * Route lines, bottom to top. They go under the place layers, so a dot on
 * the route stays tappable and readable.
 */
export const ROUTE_LAYERS: readonly NativeMapLayer[] = [
  { id: 'hm-route-alternatives', type: 'line', sourceId: ROUTE_ALTERNATIVES_SOURCE, layout: LINE_LAYOUT, paint: { 'line-color': WALKED, 'line-width': 4, 'line-opacity': 0.8 } },
  { id: 'hm-route-casing', type: 'line', sourceId: ROUTE_AHEAD_SOURCE, layout: LINE_LAYOUT, paint: { 'line-color': SURFACE, 'line-width': 9 } },
  { id: 'hm-route-walked', type: 'line', sourceId: ROUTE_WALKED_SOURCE, layout: LINE_LAYOUT, paint: { 'line-color': WALKED, 'line-width': 5 } },
  { id: 'hm-route-ahead', type: 'line', sourceId: ROUTE_AHEAD_SOURCE, layout: LINE_LAYOUT, paint: { 'line-color': GOLD, 'line-width': 5 } },
];

/**
 * Place layers, bottom to top. Every place is a gold dot; names appear at
 * street zoom. The selected place grows, gets a ring in the text colour and
 * always shows its name, so selection never rests on colour alone (the same
 * rule as the schematic markers and the web map).
 */
export const PLACE_LAYERS: readonly NativeMapLayer[] = [
  {
    id: DOTS_LAYER,
    type: 'circle',
    sourceId: PLACES_SOURCE,
    paint: {
      'circle-color': GOLD,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 15, 6, 17, 8],
      'circle-stroke-color': SURFACE,
      'circle-stroke-width': 2,
    },
  },
  {
    id: LABELS_LAYER,
    type: 'symbol',
    sourceId: PLACES_SOURCE,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': ['step', ['zoom'], 0, 15, 12],
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
      'text-font': FONT,
    },
    paint: { 'text-color': TEXT, 'text-halo-color': SURFACE, 'text-halo-width': 1.5 },
  },
  {
    id: SELECTED_DOT_LAYER,
    type: 'circle',
    sourceId: SELECTED_SOURCE,
    paint: { 'circle-color': GOLD, 'circle-radius': 10, 'circle-stroke-color': TEXT, 'circle-stroke-width': 3 },
  },
  {
    id: SELECTED_LABEL_LAYER,
    type: 'symbol',
    sourceId: SELECTED_SOURCE,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 13,
      'text-anchor': 'left',
      'text-offset': [1.2, 0],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-font': FONT,
    },
    paint: { 'text-color': TEXT, 'text-halo-color': SURFACE, 'text-halo-width': 2 },
  },
];

export interface MapPlacePoint {
  readonly id: string;
  readonly name: string;
  readonly lngLat: readonly [number, number];
}

const point = (place: MapPlacePoint) => ({
  type: 'Feature' as const,
  id: place.id,
  properties: { id: place.id, name: place.name },
  geometry: { type: 'Point' as const, coordinates: [place.lngLat[0], place.lngLat[1]] },
});

const lineFeature = (coordinates: readonly (readonly [number, number])[]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'LineString' as const, coordinates },
});

/** Every mapped place as GeoJSON text. */
export function placesGeoJson(places: readonly MapPlacePoint[]): string {
  return JSON.stringify({ type: 'FeatureCollection', features: places.map(point) });
}

/** The selected place, or an empty collection. */
export function selectedGeoJson(place: MapPlacePoint | null): string {
  return JSON.stringify({ type: 'FeatureCollection', features: place ? [point(place)] : [] });
}

/** One route line; fewer than two positions draws nothing. */
export function lineGeoJson(coordinates: readonly (readonly [number, number])[]): string {
  if (coordinates.length < 2) return JSON.stringify({ type: 'FeatureCollection', features: [] });
  return JSON.stringify(lineFeature(coordinates));
}

/** Several lines (route alternatives). */
export function linesGeoJson(lines: readonly (readonly (readonly [number, number])[])[]): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: lines.filter((l) => l.length >= 2).map(lineFeature),
  });
}

/** The box holding every [lng, lat] point, or undefined for none. */
export function boundsOf(points: readonly (readonly [number, number])[]): NativeMapBounds | undefined {
  if (points.length === 0) return undefined;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { southwest: { latitude: south, longitude: west }, northeast: { latitude: north, longitude: east } };
}

/**
 * Camera padding: the pane insets (room taken by drawers and panels over
 * the map) plus `margin` on every side. Each axis is scaled down when it
 * would leave less than 30% of the view, so a narrow phone pane still has
 * room to frame something.
 */
export function framePadding(
  insets: NativeMapEdgeInsets,
  size: { width: number; height: number },
  margin: number,
): NativeMapEdgeInsets {
  const pad = {
    top: insets.top + margin,
    bottom: insets.bottom + margin,
    left: insets.left + margin,
    right: insets.right + margin,
  };
  const fit = (a: number, b: number, extent: number): [number, number] => {
    const limit = extent * MAX_PADDING_SHARE;
    const sum = a + b;
    if (extent <= 0 || sum <= limit) return [a, b];
    const k = limit / sum;
    return [a * k, b * k];
  };
  [pad.left, pad.right] = fit(pad.left, pad.right, size.width);
  [pad.top, pad.bottom] = fit(pad.top, pad.bottom, size.height);
  return pad;
}

/**
 * The query box around a tap, kept inside the view: the map rejects a query
 * area that leaves its bounds.
 */
export function tapBox(
  point: NativeMapScreenPoint,
  size: { width: number; height: number },
): { min: NativeMapScreenPoint; max: NativeMapScreenPoint } {
  return {
    min: { x: Math.max(0, point.x - TAP_SLOP), y: Math.max(0, point.y - TAP_SLOP) },
    max: { x: Math.min(size.width, point.x + TAP_SLOP), y: Math.min(size.height, point.y + TAP_SLOP) },
  };
}

/** The place id a rendered feature carries, from its GeoJSON text. */
export function placeIdFromFeature(geoJson: string): string | undefined {
  try {
    const feature = JSON.parse(geoJson) as { properties?: { id?: unknown } };
    const id = feature.properties?.id;
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}
