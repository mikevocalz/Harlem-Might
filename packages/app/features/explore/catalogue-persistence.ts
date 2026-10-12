import type { DetailResult } from '../../content/result.ts';
import type { PlaceRecord } from '../../content/records.ts';
import type { ExplorePlace } from './explore.store.ts';

/** What the catalogue durably keeps between launches: rows plus resolved details. */
export interface PlaceCatalogueSnapshot {
  places: readonly ExplorePlace[];
  details: Readonly<Record<string, DetailResult<PlaceRecord>>>;
}

/** A durable home for the catalogue — MMKV on native, nothing elsewhere. */
export interface PlaceCataloguePersistence {
  load(): PlaceCatalogueSnapshot | undefined;
  save(snapshot: PlaceCatalogueSnapshot): void;
}

/**
 * Default target (web/tests): no durable store. The native build resolves
 * `catalogue-persistence.native.ts` instead, which backs this with MMKV.
 */
export const platformCataloguePersistence: PlaceCataloguePersistence | undefined = undefined;
