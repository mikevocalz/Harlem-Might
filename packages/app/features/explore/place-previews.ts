/** Static preview catalogue. Safe to load in CMS scripts and server-only routes. */
import { filterPlaces, haversine, type HarlemCategoryFilter, type HarlemPlaceCategory } from './place-model.ts';

export interface HarlemPlacePreview {
  id: string;
  name: string;
  category: HarlemPlaceCategory;
  area: string;
  shortDescription: string;
  whyItMatters: string;
  tags: string[];
  previewPoint: {
    x: number;
    y: number;
  };
  /** WGS84 [lng, lat] from OpenStreetMap Nominatim (osm id in `osm`), fetched
   *  2026-10-03. Absent until the catalogue holds a verified point. */
  lngLat?: readonly [number, number];
  osm?: string;
  street?: string;
  menuAvailable?: boolean;
  arCandidate?: boolean;
}

export const HARLEM_PLACE_PREVIEWS: readonly HarlemPlacePreview[] = [
  {
    id: 'apollo-theater',
    lngLat: [-73.9499948, 40.8100895],
    osm: 'way/271798914',
    street: 'West 125th Street',
    name: 'Apollo Theater',
    category: 'Culture',
    area: '125th Street',
    shortDescription: 'A Harlem performing-arts landmark with a global cultural reach.',
    whyItMatters:
      'The Apollo belongs in the experience as both a current destination and a gateway into Harlem music, performance, and neighborhood history.',
    tags: ['performing arts', 'music', 'history'],
    previewPoint: { x: 52, y: 38 },
    arCandidate: true,
  },
  {
    id: 'red-rooster-harlem',
    lngLat: [-73.9449105, 40.8079659],
    osm: 'way/271798850',
    street: 'Malcolm X Boulevard',
    name: 'Red Rooster Harlem',
    category: 'Food',
    area: 'Central Harlem',
    shortDescription: 'A restaurant and bar on Malcolm X Boulevard.',
    whyItMatters:
      'Harlem Might can connect a meal here to nearby culture, nightlife, public art, and a walk along the surrounding blocks.',
    tags: ['restaurant', 'food', 'music'],
    previewPoint: { x: 61, y: 54 },
    menuAvailable: true,
    arCandidate: true,
  },
  {
    id: 'sylvias-restaurant',
    lngLat: [-73.9445189, 40.8086285],
    osm: 'node/4231923696',
    street: 'Malcolm X Boulevard',
    name: "Sylvia's Restaurant",
    category: 'Food',
    area: 'Central Harlem',
    shortDescription: 'A longstanding Harlem restaurant and neighborhood institution.',
    whyItMatters:
      'A place detail can pair the present-day restaurant with its history, menus, nearby landmarks, and the story of the block.',
    tags: ['restaurant', 'soul food', 'history'],
    previewPoint: { x: 68, y: 48 },
    menuAvailable: true,
    arCandidate: true,
  },
  {
    id: 'schomburg-center',
    lngLat: [-73.9409874, 40.8146476],
    osm: 'way/271825823',
    street: 'Malcolm X Boulevard',
    name: 'Schomburg Center',
    category: 'Books',
    area: 'Central Harlem',
    shortDescription: 'A research and cultural institution centered on Black history and culture.',
    whyItMatters:
      'It gives Harlem Might a natural bridge between physical navigation, archival material, exhibitions, books, and deeper research.',
    tags: ['library', 'archives', 'research'],
    previewPoint: { x: 73, y: 31 },
    arCandidate: true,
  },
  {
    id: 'studio-museum-harlem',
    lngLat: [-73.947616, 40.8084179],
    osm: 'node/5420936939',
    street: 'West 125th Street',
    name: 'The Studio Museum in Harlem',
    category: 'Culture',
    area: '125th Street',
    shortDescription: 'A museum focused on artists of African descent and the cultural life of Harlem.',
    whyItMatters:
      'The museum can anchor contemporary art discovery while connecting users to public art, artists, archives, and nearby cultural spaces.',
    tags: ['museum', 'art', 'culture'],
    previewPoint: { x: 46, y: 46 },
    arCandidate: true,
  },
  {
    id: 'national-black-theatre',
    name: 'National Black Theatre',
    category: 'Culture',
    area: 'Central Harlem',
    shortDescription: 'A Harlem arts institution centered on Black theater and cultural expression.',
    whyItMatters:
      'It is a strong example of a place where events, institution history, people, and a current destination should all share one canonical record.',
    tags: ['theater', 'performance', 'culture'],
    previewPoint: { x: 77, y: 58 },
    arCandidate: true,
  },
  {
    id: 'marcus-garvey-park',
    lngLat: [-73.943669, 40.8044856],
    osm: 'way/199925533',
    name: 'Marcus Garvey Park',
    category: 'Outdoors',
    area: 'Mount Morris Park',
    shortDescription: 'A major neighborhood park and gathering place in Central Harlem.',
    whyItMatters:
      'The park makes the map useful beyond businesses: monuments, landscape, recreation, events, and neighborhood history can all appear spatially.',
    tags: ['park', 'outdoors', 'monuments'],
    previewPoint: { x: 71, y: 69 },
    arCandidate: true,
  },
  {
    id: 'strivers-row',
    name: "Strivers' Row",
    category: 'History',
    area: 'Central Harlem',
    shortDescription: 'A distinctive historic residential streetscape in Harlem.',
    whyItMatters:
      'This is where entrance-aware navigation matters less than viewpoint-aware storytelling: the experience should guide people to a respectful public vantage point.',
    tags: ['architecture', 'history', 'streetscape'],
    previewPoint: { x: 36, y: 27 },
    arCandidate: true,
  },
] as const;

export function getHarlemPlacePreview(placeId?: string | null) {
  return HARLEM_PLACE_PREVIEWS.find((place) => place.id === placeId) ?? null;
}

export function filterHarlemPlacePreviews(
  query: string,
  category: HarlemCategoryFilter,
) {
  return filterPlaces(HARLEM_PLACE_PREVIEWS, query, category);
}

/** The n mapped places nearest to `placeId`, excluding it. */
export function placesNear(placeId: string, n = 3) {
  const origin = getHarlemPlacePreview(placeId)?.lngLat;
  const mapped = HARLEM_PLACE_PREVIEWS.filter((p) => p.id !== placeId && p.lngLat);
  if (!origin) return mapped.slice(0, n);
  return [...mapped].sort((a, b) => haversine(origin, a.lngLat!) - haversine(origin, b.lngLat!)).slice(0, n);
}

/** Places with coordinates, for map surfaces. */
export const MAPPED_PLACES = HARLEM_PLACE_PREVIEWS.filter((p) => p.lngLat);

/** Places the catalogue has no verified point for. Lists say "Not on the map yet". */
export const UNMAPPED_PLACES = HARLEM_PLACE_PREVIEWS.filter((p) => !p.lngLat);

/**
 * The `n` mapped places nearest to `placeId` with their distance. Empty when
 * the place itself has no coordinates: a distance from an unverified point
 * would be made up.
 */
export function nearbyPlaces(
  placeId: string,
  n = 3,
): { place: HarlemPlacePreview; meters: number }[] {
  const origin = getHarlemPlacePreview(placeId)?.lngLat;
  if (!origin) return [];
  return placesNear(placeId, n).flatMap((place) =>
    place.lngLat ? [{ place, meters: haversine(origin, place.lngLat) }] : [],
  );
}
