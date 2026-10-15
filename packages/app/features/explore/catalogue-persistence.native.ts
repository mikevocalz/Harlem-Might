import { createMMKV } from 'react-native-mmkv';
import type { PlaceRecord } from '../../content/records.ts';
import type {
  PlaceCataloguePersistence,
  PlaceCatalogueSnapshot,
} from './catalogue-persistence.ts';
import { decodePlaceCatalogueSnapshot } from './catalogue-snapshot.ts';

let storage: ReturnType<typeof createMMKV> | undefined;
// Native construction can fail too. Keep it inside the same load/save guards
// as I/O, and cache only a successful instance so a later operation can retry.
const getStorage = () => storage ??= createMMKV({ id: 'explore-catalogue' });
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
      const raw = getStorage().getString(KEY);
      if (!raw) return undefined;
      const parsed: unknown = JSON.parse(raw);
      return decodePlaceCatalogueSnapshot(parsed);
    } catch {
      return undefined;
    }
  },
  save(snapshot) {
    try {
      getStorage().set(KEY, JSON.stringify({ schemaVersion: snapshot.schemaVersion, places: snapshot.places, details: okOnly(snapshot.details) }));
    } catch {
      // A storage failure must never take a working catalogue down with it.
    }
  },
};
