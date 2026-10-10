import { useEffect, useMemo } from 'react';
import { MapboxVectorClient } from '@mikevocalz/nitro-mapbox-ar/mapbox';
import type { BuildingMesh } from '@mapbox/react-native-mapbox-ar-reactvision/src/buildings.ts';
import { getHarlemPlacePreview } from '@acme/app';
import { useArSession } from './arSession.store';
import { tabletopOrigin } from './arTabletop';
import { mapboxToken } from './mapboxToken';
import { loadBuildingMesh, meshKey, streetMapTiles } from './streetMap';
import { useStreetMap } from './streetMap.store';

/** Meshes stay cached for the whole app session, keyed by origin and tile. */
const meshCache = new Map<string, BuildingMesh>();

/**
 * The map layer's half of the street scene's real map: picks the tiles
 * around the wearer, fetches and extrudes building tiles one at a time
 * (nearest first, so the street you stand on appears first) and publishes
 * them to `useStreetMap`. Imagery tiles are only listed; Viro's image loader
 * fetches them by URL.
 */
export function useStreetMapLoader(active: boolean, placeId: string | undefined) {
  const user = useArSession((s) => s.street.user);
  const place = getHarlemPlacePreview(placeId);
  const origin = useMemo(() => (place?.lngLat ? tabletopOrigin(place) : null), [place]);
  const tiles = useMemo(() => (origin ? streetMapTiles(origin, user) : null), [origin, user]);
  const cell = tiles?.cell;

  useEffect(() => {
    const map = useStreetMap.getState();
    if (!active || !origin || !tiles) {
      map.reset();
      return;
    }
    const token = mapboxToken();
    if (token.kind !== 'public') {
      map.set({ status: token.kind === 'missing' ? 'no-token' : 'not-public', meshes: [], imageryTiles: [] });
      return;
    }
    const controller = new AbortController();
    const client = new MapboxVectorClient({ accessToken: token.token });
    const cached = () =>
      tiles.buildingTiles.flatMap((tile) => {
        const mesh = meshCache.get(meshKey(origin, tile));
        return mesh ? [mesh] : [];
      });
    map.set({ status: 'loading', imageryTiles: tiles.imageryTiles, meshes: cached(), failedTiles: 0 });

    (async () => {
      let failed = 0;
      for (const tile of tiles.buildingTiles) {
        const key = meshKey(origin, tile);
        if (meshCache.has(key)) continue;
        try {
          meshCache.set(key, await loadBuildingMesh({ client, origin, tile, signal: controller.signal }));
        } catch (error) {
          if (controller.signal.aborted) return;
          failed += 1;
          console.warn(`[street map] building tile ${key} failed:`, error);
          continue;
        }
        if (controller.signal.aborted) return;
        useStreetMap.getState().set({ meshes: cached() });
      }
      if (!controller.signal.aborted) {
        useStreetMap.getState().set({ status: failed > 0 ? 'partial' : 'ready', meshes: cached(), failedTiles: failed });
      }
    })();
    return () => controller.abort();
    // `cell` stands in for `tiles`: the tile set only changes when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, origin, cell]);
}
