import type { HarlemPlacePreview } from './explore.store';

/** A marker position as percentages of the marker area, origin top-left. */
export interface SchematicPoint {
  placeId: string;
  /** 0–100, west to east. */
  xPercent: number;
  /** 0–100, north to south. */
  yPercent: number;
}

/**
 * Places a set of mapped places inside a box by their real coordinates.
 *
 * This is a stand-in until the native Mapbox surface lands (DECISIONS S11):
 * a linear fit of the places' own [lng, lat] bounds into 0–100%, north up.
 * Relative positions are true to the OpenStreetMap points; distances are not
 * to scale because the box's aspect ratio is not the bounds' aspect ratio.
 * Places without `lngLat` are left out, never given an invented spot.
 *
 * A single place, or places sharing one coordinate, sit at the centre.
 */
export function projectSchematic(places: readonly HarlemPlacePreview[]): SchematicPoint[] {
  const mapped = places.flatMap((place) =>
    place.lngLat ? [{ id: place.id, lng: place.lngLat[0], lat: place.lngLat[1] }] : [],
  );
  if (mapped.length === 0) return [];

  const lngs = mapped.map((p) => p.lng);
  const lats = mapped.map((p) => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  return mapped.map((p) => ({
    placeId: p.id,
    xPercent: lngSpan === 0 ? 50 : ((p.lng - minLng) / lngSpan) * 100,
    yPercent: latSpan === 0 ? 50 : ((maxLat - p.lat) / latSpan) * 100,
  }));
}

/** Truncates a marker label to `max` characters plus an ellipsis (copy.md §2). */
export function markerLabel(name: string, max = 18): string {
  return name.length <= max ? name : `${name.slice(0, max).trimEnd()}…`;
}
