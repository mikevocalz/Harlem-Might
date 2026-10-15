import { create } from 'zustand';

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
  category: string;
  /** Mobile only. Web reads `?place=`. */
  selectedPlaceId: string | null;
  /** Fixture place ids saved this session (not persisted). */
  savedPreviewIds: string[];
  /**
   * Place ids the user opened this session, newest first, capped at 8 —
   * the "recently viewed" strip. Written by the web select path and
   * mobile's `selectPlace`/`openPlace`; the catalogue id space is shared.
   */
  recentIds: string[];
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
  setCategory: (category: string) => void;
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
  /** Pushes a place onto `recentIds` (deduped, newest first, max 8). */
  pushRecent: (placeId: string) => void;
}

/** Adds `id` when absent, removes it when present. Returns a new array. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

const RECENTS_CAP = 8;

/** `id` to the front, deduped, capped at 8. Pure, for the store actions. */
export function pushRecentId(ids: readonly string[], id: string): string[] {
  return [id, ...ids.filter((x) => x !== id)].slice(0, RECENTS_CAP);
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
  recentIds: [],
  sheet: { open: false, detent: DEFAULT_SHEET_DETENT, returnFocusId: null },
  locationPermission: 'unknown',
  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
  selectPlace: (selectedPlaceId) =>
    set((state) => ({
      selectedPlaceId,
      recentIds: selectedPlaceId ? pushRecentId(state.recentIds, selectedPlaceId) : state.recentIds,
    })),
  openPlace: (placeId, returnFocusId = null) =>
    set((state) => ({
      selectedPlaceId: placeId,
      recentIds: pushRecentId(state.recentIds, placeId),
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
  pushRecent: (placeId) => set((state) => ({ recentIds: pushRecentId(state.recentIds, placeId) })),
}));
