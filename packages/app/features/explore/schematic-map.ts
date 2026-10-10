import type { HarlemPlacePreview } from './explore.store';

/** A marker position as percentages of the marker area, origin top-left. */
export interface SchematicPoint {
  placeId: string;
  /** 0–100, west to east. */
  xPercent: number;
  /** 0–100, north to south. */
  yPercent: number;
}

/** The [lng, lat] box a schematic is fitted to. */
export interface SchematicBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/** The smallest box holding every point, or undefined for none. */
export function schematicBounds(points: readonly (readonly [number, number])[]): SchematicBounds | undefined {
  if (points.length === 0) return undefined;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

/** One [lng, lat] point as percentages of a box fitted to `bounds`, north up. */
export function projectToSchematic(
  [lng, lat]: readonly [number, number],
  bounds: SchematicBounds,
): { xPercent: number; yPercent: number } {
  const lngSpan = bounds.maxLng - bounds.minLng;
  const latSpan = bounds.maxLat - bounds.minLat;
  return {
    xPercent: lngSpan === 0 ? 50 : ((lng - bounds.minLng) / lngSpan) * 100,
    yPercent: latSpan === 0 ? 50 : ((bounds.maxLat - lat) / latSpan) * 100,
  };
}

/**
 * Places a set of mapped places inside a box by their real coordinates.
 *
 * Web and the headset build draw this; phones and foldables draw the native
 * Mapbox map (docs/adr/0007). The fit is a linear fit
 * of the places' own [lng, lat] bounds into 0–100%, north up.
 * Relative positions are true to the OpenStreetMap points; distances are not
 * to scale because the box's aspect ratio is not the bounds' aspect ratio.
 * Places without `lngLat` are left out, never given an invented spot.
 *
 * `extend` adds points the box must also hold, such as an active route's
 * line, so the route and the markers share one fit and line up.
 *
 * A single place, or places sharing one coordinate, sit at the centre.
 */
export function projectSchematic(
  places: readonly HarlemPlacePreview[],
  extend: readonly (readonly [number, number])[] = [],
): SchematicPoint[] {
  const mapped = places.flatMap((place) => (place.lngLat ? [{ id: place.id, lngLat: place.lngLat }] : []));
  if (mapped.length === 0) return [];
  const bounds = schematicBounds([...mapped.map((p) => p.lngLat), ...extend])!;
  return mapped.map((p) => ({ placeId: p.id, ...projectToSchematic(p.lngLat, bounds) }));
}

/** Truncates a marker label to `max` characters plus an ellipsis (copy.md §2). */
export function markerLabel(name: string, max = 18): string {
  return name.length <= max ? name : `${name.slice(0, max).trimEnd()}…`;
}
