import { create } from 'zustand';

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
 * How far the place sheet (mobile) or inspector (desktop) is raised.
 * `peek` shows the title row, `half` the summary and actions, `full` everything.
 */
export type SheetDetent = 'peek' | 'half' | 'full';

/** The detent {@linkcode ExploreState.openSheet} uses when the caller names none. */
export const DEFAULT_SHEET_DETENT: SheetDetent = 'half';

/**
 * Visibility of the place sheet or inspector. `detent` survives a close so the
 * surface can reopen where the user left it when they ask for that explicitly.
 */
export interface ExploreSheet {
  open: boolean;
  detent: SheetDetent;
  /**
   * The control that opened the sheet (a list row or a map marker), so focus
   * can go back to it on close. An opaque id owned by the caller; `null` when
   * the sheet opened from a reload or shared link.
   */
  returnFocusId: string | null;
}

/**
 * What the app knows about device location access.
 * `unknown` means the user has not been asked (or the platform will prompt),
 * `unavailable` means the platform has no geolocation at all.
 */
export type LocationPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';

/**
 * Explore state shared by web and mobile.
 *
 * Ownership, per platform:
 * - Web (`apps/web` ExploreWorkspace): the URL owns `view`, `q`, `category`
 *   and `place`. This store holds only what the URL must not: the search draft
 *   (typed ahead of the debounced replaceState), sheet/inspector detent,
 *   location permission and saved ids. Web never reads `category` or
 *   `selectedPlaceId` from here.
 * - Mobile (`apps/mobile` explore layout, `ExploreMasterPane`,
 *   `ExploreMapPane`, `ExplorePlaceDetail`, `MightsAssistant`): expo-router has no
 *   query-string workspace, so `category` and `selectedPlaceId` live here.
 *   They stay for that reason; removing them breaks five mobile consumers.
 *
 * The map camera is never stored here. It stays an imperative ref on the map
 * instance so pan/zoom frames never re-render React.
 *
 * `savedPreviewIds` is in-memory only. Durable saves belong to the member's
 * Payload `saved-places` rows (docs/AUTH_PROFILE.md), keyed by CMS place id,
 * not by these fixture slugs.
 */
export interface ExploreState {
  /** Search text as typed. On web it leads the URL `q` by one debounce. */
  query: string;
  /** Mobile only. Web reads `?category=`. */
  category: HarlemCategoryFilter;
  /** Mobile only. Web reads `?place=`. */
  selectedPlaceId: string | null;
  /** Fixture place ids saved this session (not persisted). */
  savedPreviewIds: string[];
  /** Place sheet (mobile) / inspector (desktop) visibility and detent. */
  sheet: ExploreSheet;
  /** Last known location permission. Written by whoever asks the platform. */
  locationPermission: LocationPermission;
  /**
   * Web only: the place ids the master's current filters pass. The map
   * region reads this to dim non-matching dots once the catalogue resolves,
   * so it never has to wait on the catalogue promise itself. `null` means
   * "no filter applied yet — show everything".
   */
  visibleIds: readonly string[] | null;
  /**
   * Web only: true once this session pushed a selection onto history, so
   * Close can step Back instead of leaving a duplicate entry. Lives here —
   * not in a component ref — because the region that selects (list, map,
   * HUD) is never the region that closes (the sheet).
   */
  selectionPushed: boolean;
  setQuery: (query: string) => void;
  setCategory: (category: HarlemCategoryFilter) => void;
  selectPlace: (placeId: string | null) => void;
  /**
   * Selects a place and records the control that opened it (a row or a map
   * marker id from `focus-registry.ts`), so closing can return focus there.
   * One write per intent: layouts derive which pane or window shows it.
   */
  openPlace: (placeId: string, returnFocusId?: string | null) => void;
  /** Clears the selection and keeps `sheet.returnFocusId` for focus restore. */
  closePlace: () => void;
  toggleSavedPreview: (placeId: string) => void;
  /**
   * Opens the sheet at `detent`, or {@linkcode DEFAULT_SHEET_DETENT}, and
   * records which control opened it.
   */
  openSheet: (detent?: SheetDetent, returnFocusId?: string | null) => void;
  /** Moves an open sheet; on a closed sheet, sets where it will reopen. */
  setSheetDetent: (detent: SheetDetent) => void;
  /** Closes the sheet and keeps its detent and `returnFocusId`, which the
   *  caller reads after close to restore focus. */
  closeSheet: () => void;
  setLocationPermission: (permission: LocationPermission) => void;
  setVisibleIds: (ids: readonly string[] | null) => void;
  setSelectionPushed: (pushed: boolean) => void;
}

/** Adds `id` when absent, removes it when present. Returns a new array. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/**
 * Maps a browser Permissions API state (`navigator.permissions.query({ name:
 * 'geolocation' })`) to {@linkcode LocationPermission}. Pass `undefined` when
 * the browser has no geolocation, and `'prompt'` when it will ask.
 */
export function locationPermissionFromBrowser(
  state: 'granted' | 'denied' | 'prompt' | undefined,
): LocationPermission {
  if (state === undefined) return 'unavailable';
  if (state === 'prompt') return 'unknown';
  return state;
}

export const useExplore = create<ExploreState>((set) => ({
  query: '',
  category: 'All',
  selectedPlaceId: null,
  savedPreviewIds: [],
  sheet: { open: false, detent: DEFAULT_SHEET_DETENT, returnFocusId: null },
  locationPermission: 'unknown',
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
  selectPlace: (selectedPlaceId) => set({ selectedPlaceId }),
  openPlace: (placeId, returnFocusId = null) =>
    set((state) => ({
      selectedPlaceId: placeId,
      sheet: { ...state.sheet, open: true, returnFocusId },
    })),
  closePlace: () =>
    set((state) => ({ selectedPlaceId: null, sheet: { ...state.sheet, open: false } })),
  toggleSavedPreview: (placeId) =>
    set((state) => ({ savedPreviewIds: toggleId(state.savedPreviewIds, placeId) })),
  openSheet: (detent = DEFAULT_SHEET_DETENT, returnFocusId = null) =>
    set({ sheet: { open: true, detent, returnFocusId } }),
  setSheetDetent: (detent) => set((state) => ({ sheet: { ...state.sheet, detent } })),
  closeSheet: () => set((state) => ({ sheet: { ...state.sheet, open: false } })),
  setLocationPermission: (locationPermission) => set({ locationPermission }),
  visibleIds: null,
  selectionPushed: false,
  setVisibleIds: (visibleIds) => set({ visibleIds }),
  setSelectionPushed: (selectionPushed) => set({ selectionPushed }),
}));

export function getHarlemPlacePreview(placeId?: string | null) {
  return HARLEM_PLACE_PREVIEWS.find((place) => place.id === placeId) ?? null;
}

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

export function filterHarlemPlacePreviews(
  query: string,
  category: HarlemCategoryFilter,
) {
  return filterPlaces(HARLEM_PLACE_PREVIEWS, query, category);
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres between two [lng, lat] points. */
export function haversine(a: readonly [number, number], b: readonly [number, number]) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
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

/** The street when the record has one, else the neighbourhood. */
export function placeStreetLine(place: HarlemPlacePreview): string {
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
