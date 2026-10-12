import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { ContentReaders } from '../../content/readers.ts';
import type { PlaceRecord } from '../../content/records.ts';
import type { DetailResult } from '../../content/result.ts';
import {
  platformCataloguePersistence,
  type PlaceCataloguePersistence,
} from './catalogue-persistence.ts';
import { explorePlaceFromRecord } from './catalogue.ts';
import { haversine, type ExplorePlace } from './place-model.ts';

type Readers = Pick<ContentReaders, 'listExploreCatalogue' | 'getPlace'>;
type LoadState = { status: 'idle' | 'loading' | 'ready' } | { status: 'unavailable'; message: string };

// Stable record projections keep catalogue subscribers and native geometry on
// the same detail data without allocating a new place on every store lookup.
const projections = new WeakMap<PlaceRecord, ExplorePlace>();
function projectPlace(record: PlaceRecord): ExplorePlace {
  let place = projections.get(record);
  if (!place) {
    place = explorePlaceFromRecord(record);
    projections.set(record, place);
  }
  return place;
}

/** The native catalogue shared by Explore, separate windows and AR. */
export interface PlaceCatalogueState {
  places: readonly ExplorePlace[];
  loadState: LoadState;
  details: Readonly<Record<string, DetailResult<PlaceRecord>>>;
  connect: (readers: Readers) => void;
  refresh: () => Promise<void>;
  loadPlace: (slug: string) => Promise<void>;
}

export interface PlaceCatalogueStoreOptions {
  /** Durable home for the last good catalogue — MMKV on native, none elsewhere. */
  persistence?: PlaceCataloguePersistence;
  /**
   * Backoff delays (ms) for self-healing retries after a failed refresh.
   * Empty (the default for isolated stores) means callers drive retries.
   */
  retryDelaysMs?: readonly number[];
}

/** Creates an isolated catalogue; failed reads retain the last successful list. */
export function createPlaceCatalogueStore(options: PlaceCatalogueStoreOptions = {}) {
  const restored = options.persistence?.load();
  const restoredDetails = Object.fromEntries(Object.entries(restored?.details ?? {}).map(([slug, detail]) => [
    slug,
    detail.status === 'ok' && detail.data.locationAccuracy === 'pending'
      ? { ...detail, data: { ...detail.data, location: undefined } }
      : detail,
  ]));
  // Cached detail remains useful offline. Request order decides whether a
  // revalidated detail or a successful catalogue is the fresher authority.
  const detailGenerations = new Map<string, number>();
  let requestGeneration = 0;
  let catalogueGeneration = 0;
  const restoredPlaces = restored?.places.map((place) => {
    const detail = restoredDetails[place.id];
    if (detail?.status === 'ok') return projectPlace(detail.data);
    // Legacy rows did not retain accuracy and could contain pending points.
    // Keep their display facts, but require a new read before mapping them.
    return restored.schemaVersion === 2 ? place : { ...place, lngLat: undefined };
  }) ?? [];
  const retryDelays = options.retryDelaysMs ?? [];
  let readers: Readers | undefined;
  let pending: Promise<void> | undefined;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const detailRequests = new Map<string, { promise: Promise<void>; generation: number }>();
  return createStore<PlaceCatalogueState>((set, get) => {
    const persistSnapshot = () => {
      try {
        options.persistence?.save({ schemaVersion: 2, places: get().places, details: get().details });
      } catch {
        // Durable caching must never take a working catalogue down with it.
      }
    };
    const scheduleRetry = () => {
      const delay = retryDelays[retryAttempt];
      if (delay === undefined || retryTimer !== undefined) return;
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void get().refresh();
      }, delay);
      (retryTimer as { unref?: () => void }).unref?.();
    };
    const markUnavailable = (message: string) => {
      set({ loadState: { status: 'unavailable', message } });
      scheduleRetry();
    };
    return {
      places: restoredPlaces,
      loadState: { status: 'idle' },
      details: restoredDetails,
      connect: (value) => { readers = value; },
      refresh: () => {
        if (pending) return pending;
        if (!readers) {
          markUnavailable('The place catalogue is not configured.');
          return Promise.resolve();
        }
        const source = readers;
        const generation = ++requestGeneration;
        set({ loadState: { status: 'loading' } });
        pending = Promise.resolve().then(async () => {
          try {
            const result = await source.listExploreCatalogue();
            if (result.status === 'ok') {
              retryAttempt = 0;
              if (retryTimer !== undefined) { clearTimeout(retryTimer); retryTimer = undefined; }
              catalogueGeneration = generation;
              for (const [slug, request] of detailRequests) {
                if (request.generation < generation) detailRequests.delete(slug);
              }
              set((state) => {
                // A successful list invalidates older detail, including cached
                // records and full records read directly by the detail CTA.
                const details = Object.fromEntries(Object.entries(state.details).filter(
                  ([slug]) => (detailGenerations.get(slug) ?? 0) > generation,
                ));
                const places = result.data.flatMap((record) => {
                  const detail = details[record.slug];
                  // Live detail may have settled while this older list was
                  // in flight. Keep both corrections and confirmed removals.
                  if (detail?.status === 'not-found') return [];
                  return [projectPlace(detail?.status === 'ok' ? detail.data : record)];
                });
                const listedSlugs = new Set(result.data.map((record) => record.slug));
                for (const [slug, detail] of Object.entries(details)) {
                  // A newer deep-link detail may not exist in the older list.
                  if (detail.status === 'ok' && !listedSlugs.has(slug)) places.push(projectPlace(detail.data));
                }
                return { details, places, loadState: { status: 'ready' } };
              });
              for (const [slug, detailGeneration] of detailGenerations) {
                if (detailGeneration < generation) detailGenerations.delete(slug);
              }
              persistSnapshot();
            } else {
              markUnavailable(result.reason === 'not-configured'
                ? 'The place catalogue is not configured.' : 'We couldn’t load the place catalogue. Try again.');
            }
          } catch {
            markUnavailable('We couldn’t load the place catalogue. Try again.');
          }
        }).finally(() => { pending = undefined; });
        return pending;
      },
      loadPlace: (slug) => {
        if (get().details[slug]?.status === 'ok' && (detailGenerations.get(slug) ?? 0) > catalogueGeneration) return Promise.resolve();
        const existing = detailRequests.get(slug);
        if (existing) return existing.promise;
        const source = readers;
        const generation = ++requestGeneration;
        const request = (async () => {
          let result: DetailResult<PlaceRecord>;
          try {
            result = source ? await source.getPlace(slug) : { status: 'unavailable', reason: 'not-configured' };
          } catch (error) {
            result = { status: 'unavailable', reason: 'query-failed', error: error instanceof Error ? error : new Error(String(error)) };
          }
          // A newer successful catalogue supersedes this request even when
          // the transport cannot cancel it. It must not republish stale detail.
          if (generation < catalogueGeneration) return;
          const keepOfflineCache = result.status === 'unavailable'
            && !detailGenerations.has(slug) && get().details[slug]?.status === 'ok';
          if (!keepOfflineCache) detailGenerations.set(slug, generation);
          set((state) => ({
            // A failed offline revalidation keeps the last good cached detail
            // visible, but does not promote it to live authority or stop retry.
            details: keepOfflineCache ? state.details : { ...state.details, [slug]: result },
            places: result.status === 'ok'
              ? state.places.some((p) => p.id === slug)
                ? state.places.map((p) => p.id === slug ? projectPlace(result.data) : p)
                : [...state.places, projectPlace(result.data)]
              : result.status === 'not-found' ? state.places.filter((p) => p.id !== slug) : state.places,
          }));
          if (result.status !== 'unavailable') persistSnapshot();
        })().finally(() => {
          // A newer catalogue may have released this slot for a replacement.
          if (detailRequests.get(slug)?.promise === request) detailRequests.delete(slug);
        });
        detailRequests.set(slug, { promise: request, generation });
        return request;
      },
    };
  });
}

/** One catalogue for all native surfaces in the app's JS runtime. */
export const placeCatalogueStore = createPlaceCatalogueStore({
  persistence: platformCataloguePersistence,
  // A dead read self-heals across foregrounds; the last attempt waits long
  // enough for flaky radios without polling forever in the background.
  retryDelaysMs: [1500, 5000, 15_000],
});

/** Subscribes to a stable slice of the shared native catalogue. */
export function usePlaceCatalogue<T>(selector: (state: PlaceCatalogueState) => T): T {
  return useStore(placeCatalogueStore, selector);
}

/** Finds the detail-authoritative place, including a directly loaded deep link. */
export function getCataloguePlace(id?: string | null): ExplorePlace | null {
  if (!id) return null;
  const state = placeCatalogueStore.getState();
  const detail = state.details[id];
  return detail?.status === 'ok' ? projectPlace(detail.data) : state.places.find((p) => p.id === id) ?? null;
}

/** Nearest mapped catalogue places, with real great-circle distances. */
export function catalogueNearbyPlaces(place: ExplorePlace, places: readonly ExplorePlace[], count = 3) {
  const origin = place.lngLat;
  if (!origin) return [];
  return places.flatMap((other) => other.id !== place.id && other.lngLat
    ? [{ place: other, meters: haversine(origin, other.lngLat) }] : [])
    .sort((a, b) => a.meters - b.meters).slice(0, count);
}
