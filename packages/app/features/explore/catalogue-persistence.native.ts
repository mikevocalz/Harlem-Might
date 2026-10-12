import { createMMKV } from 'react-native-mmkv';
import type { PlaceRecord } from '../../content/records.ts';
import type {
  PlaceCataloguePersistence,
  PlaceCatalogueSnapshot,
} from './catalogue-persistence.ts';

const storage = createMMKV({ id: 'explore-catalogue' });
const KEY = 'explore.place-catalogue.v1';

type OkDetails = Record<string, { status: 'ok'; data: PlaceRecord }>;

// Only confirmed records survive a restart: 'unavailable' is transient and a
// persisted 'not-found' could wrongly outlive a place published later.
const okOnly = (details: PlaceCatalogueSnapshot['details']): OkDetails =>
  Object.fromEntries(
    Object.entries(details).filter(
      (entry): entry is [string, { status: 'ok'; data: PlaceRecord }] => entry[1].status === 'ok',
    ),
  );

export const platformCataloguePersistence: PlaceCataloguePersistence = {
  load() {
    try {
      const raw = storage.getString(KEY);
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return undefined;
      const snapshot = parsed as Partial<PlaceCatalogueSnapshot>;
      if (!Array.isArray(snapshot.places)) return undefined;
      return { places: snapshot.places, details: okOnly(snapshot.details ?? {}) };
    } catch {
      return undefined;
    }
  },
  save(snapshot) {
    try {
      storage.set(KEY, JSON.stringify({ places: snapshot.places, details: okOnly(snapshot.details) }));
    } catch {
      // A storage failure must never take a working catalogue down with it.
    }
  },
};
