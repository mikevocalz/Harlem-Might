/** Pure catalogue types and helpers shared by UI, native navigation and CMS consumers. */

export type HarlemPlaceCategory =
  | 'Food'
  | 'Music'
  | 'Culture'
  | 'Books'
  | 'History'
  | 'Outdoors';

/**
 * A catalogue place as the web Explore workspace, the place detail route and
 * the map consume it. `HarlemPlacePreview` satisfies this shape, and the
 * Payload readers map `places` rows to it (`explorePlaceFromRecord` in
 * catalogue.ts), so surfaces don't depend on the fixture. `category` is the
 * record's free-form `primaryCategory` — not every imported row uses the
 * fixture's chip set — so it is a plain string here.
 */
export interface ExplorePlace {
  id: string;
  name: string;
  category: string;
  area: string;
  street?: string;
  shortDescription?: string;
  tags: string[];
  lngLat?: readonly [number, number];
  /** OSM object id ("node/123") behind lngLat, for source lines and links. */
  osm?: string;
  /** ISO instant the point's source was last read. */
  sourceReadAt?: string;
  website?: string;
  phone?: string;
  /** Hours as published by the source — rendered verbatim, never reformatted. */
  hoursText?: string;
  /** Live menu links from the record (label + url). */
  menus?: { label: string; url: string }[];
  /** Curated landmark; keeps a labelled map marker at any zoom. */
  featured?: boolean;
}

export const HARLEM_CATEGORIES = [
  'All',
  'Food',
  'Music',
  'Culture',
  'Books',
  'History',
  'Outdoors',
] as const;

export type HarlemCategoryFilter = (typeof HARLEM_CATEGORIES)[number];

/**
 * Search and category-filter over any place list — the Payload catalogue on
 * the web workspace, the fixture in the native panes. `category` is the chip
 * label; `all` is the chip that means "no filter" ('All' today).
 */
export function filterPlaces<T extends ExplorePlace>(
  places: readonly T[],
  query: string,
  category: string,
  all = 'All',
): T[] {
  const normalized = query.trim().toLowerCase();

  return places.filter((place) => {
    const matchesCategory = category === all || place.category === category;
    if (!matchesCategory) return false;
    if (!normalized) return true;

    return [
      place.name,
      place.area,
      place.street ?? '',
      place.category,
      place.shortDescription ?? '',
      ...place.tags,
    ].some((value) => value.toLowerCase().includes(normalized));
  });
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres between two [lng, lat] points. */
export function haversine(a: readonly [number, number], b: readonly [number, number]) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** The street when the record has one, else the neighbourhood. */
export function placeStreetLine(place: ExplorePlace): string {
  return place.street ?? place.area;
}

/**
 * A walking distance for display: metres under 1 km (rounded to 10 m),
 * kilometres with one decimal above. Uses `Intl.NumberFormat` units, falling
 * back to a plain "m"/"km" suffix where the engine lacks unit formatting.
 */
export function formatDistance(meters: number, locale?: string): string {
  const km = meters >= 1000;
  const value = km ? Math.round(meters / 100) / 10 : Math.round(meters / 10) * 10;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: km ? 'kilometer' : 'meter',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${value} ${km ? 'km' : 'm'}`;
  }
}
