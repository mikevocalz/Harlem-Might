import { createPlaceCatalogueStore, type PlaceCatalogueStoreOptions } from '../place-catalogue.store.ts';

/** Existing cache/authority fixtures start after the explicit native hydration boundary. */
export function createHydratedCatalogueStore(options?: PlaceCatalogueStoreOptions) {
  const store = createPlaceCatalogueStore(options);
  store.getState().hydrate();
  return store;
}
