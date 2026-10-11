import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { ContentReaders } from '../../content/readers.ts';
import type { PlaceRecord } from '../../content/records.ts';
import type { DetailResult } from '../../content/result.ts';
import { explorePlaceFromRecord } from './catalogue.ts';
import { haversine, type ExplorePlace } from './explore.store.ts';

type Readers = Pick<ContentReaders, 'listExploreCatalogue' | 'getPlace'>;
type LoadState = { status: 'idle' | 'loading' | 'ready' } | { status: 'unavailable'; message: string };

/** The native catalogue shared by Explore, separate windows and AR. */
export interface PlaceCatalogueState {
  places: readonly ExplorePlace[];
  loadState: LoadState;
  details: Readonly<Record<string, DetailResult<PlaceRecord>>>;
  connect: (readers: Readers) => void;
  refresh: () => Promise<void>;
  loadPlace: (slug: string) => Promise<void>;
}

/** Creates an isolated catalogue; failed reads retain the last successful list. */
export function createPlaceCatalogueStore() {
  let readers: Readers | undefined;
  let pending: Promise<void> | undefined;
  const detailRequests = new Map<string, Promise<void>>();
  return createStore<PlaceCatalogueState>((set, get) => ({
    places: [],
    loadState: { status: 'idle' },
    details: {},
    connect: (value) => { readers = value; },
    refresh: () => {
      if (pending) return pending;
      if (!readers) {
        set({ loadState: { status: 'unavailable', message: 'The place catalogue is not configured.' } });
        return Promise.resolve();
      }
      const source = readers;
      set({ loadState: { status: 'loading' } });
      pending = Promise.resolve().then(async () => {
        try {
          const result = await source.listExploreCatalogue();
          if (result.status === 'ok') {
            set({ places: result.data.map(explorePlaceFromRecord), loadState: { status: 'ready' } });
          } else {
            set({ loadState: { status: 'unavailable', message: result.reason === 'not-configured'
              ? 'The place catalogue is not configured.' : 'We couldn’t load the place catalogue. Try again.' } });
          }
        } catch {
          set({ loadState: { status: 'unavailable', message: 'We couldn’t load the place catalogue. Try again.' } });
        }
      }).finally(() => { pending = undefined; });
      return pending;
    },
    loadPlace: (slug) => {
      if (get().details[slug]?.status === 'ok') return Promise.resolve();
      const existing = detailRequests.get(slug);
      if (existing) return existing;
      const source = readers;
      const request = (async () => {
        let result: DetailResult<PlaceRecord>;
        try {
          result = source ? await source.getPlace(slug) : { status: 'unavailable', reason: 'not-configured' };
        } catch (error) {
          result = { status: 'unavailable', reason: 'query-failed', error: error instanceof Error ? error : new Error(String(error)) };
        }
        set((state) => ({
          details: { ...state.details, [slug]: result },
          places: result.status === 'ok' && !state.places.some((p) => p.id === slug)
            ? [...state.places, explorePlaceFromRecord(result.data)] : state.places,
        }));
      })().finally(() => { detailRequests.delete(slug); });
      detailRequests.set(slug, request);
      return request;
    },
  }));
}

/** One catalogue for all native surfaces in the app's JS runtime. */
export const placeCatalogueStore = createPlaceCatalogueStore();

/** Subscribes to a stable slice of the shared native catalogue. */
export function usePlaceCatalogue<T>(selector: (state: PlaceCatalogueState) => T): T {
  return useStore(placeCatalogueStore, selector);
}

/** Finds a catalogue place, including a directly loaded deep-link target. */
export function getCataloguePlace(id?: string | null): ExplorePlace | null {
  if (!id) return null;
  const state = placeCatalogueStore.getState();
  const detail = state.details[id];
  return state.places.find((p) => p.id === id) ?? (detail?.status === 'ok' ? explorePlaceFromRecord(detail.data) : null);
}

/** Nearest mapped catalogue places, with real great-circle distances. */
export function catalogueNearbyPlaces(place: ExplorePlace, places: readonly ExplorePlace[], count = 3) {
  const origin = place.lngLat;
  if (!origin) return [];
  return places.flatMap((other) => other.id !== place.id && other.lngLat
    ? [{ place: other, meters: haversine(origin, other.lngLat) }] : [])
    .sort((a, b) => a.meters - b.meters).slice(0, count);
}
