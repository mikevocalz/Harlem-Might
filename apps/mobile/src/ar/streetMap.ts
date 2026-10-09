import type { MapboxVectorClient } from '@mapbox/react-native-mapbox-ar/mapbox';
import { extrudeBuildings, type BuildingMesh } from '@mapbox/react-native-mapbox-ar-reactvision/src/buildings.ts';
import { tilesAroundEnuPoint } from '@mapbox/react-native-mapbox-ar-reactvision/src/ground.ts';
import { tileKey, type XyzTile } from '@mapbox/react-native-mapbox-ar-reactvision/src/tile.ts';
import type { EnuOrigin } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';
import type { EnuGround } from './streetScene.ts';

/**
 * Which real-map tiles the street scene loads around the wearer (decision
 * S19, slice 2). Buildings come from Mapbox Streets v8 at z16, the deepest
 * zoom with source data; the ground is Mapbox Satellite at z17 (about 0.45 m
 * per pixel at 512 px in Harlem).
 */
export const BUILDING_ZOOM = 16;
export const IMAGERY_ZOOM = 17;
/** Buildings load within this distance of the wearer. */
export const BUILDING_RADIUS_M = 450;
/** Satellite ground loads within this distance: 16 tiles at most, about 16 MB of RGBA texture. */
export const IMAGERY_RADIUS_M = 300;
/** The wearer's position is snapped to this grid, so small teleports keep the same tile set. */
export const TILE_CELL_M = 100;

export interface StreetMapTiles {
  /** Grid cell the sets were computed for, `east:north` in cells. */
  readonly cell: string;
  readonly buildingTiles: readonly XyzTile[];
  readonly imageryTiles: readonly XyzTile[];
}

/** The tile sets for a wearer position, nearest first. */
export function streetMapTiles(origin: EnuOrigin, user: EnuGround): StreetMapTiles {
  const ce = Math.round(user.eastM / TILE_CELL_M);
  const cn = Math.round(user.northM / TILE_CELL_M);
  const center = { eastM: ce * TILE_CELL_M, northM: cn * TILE_CELL_M };
  return {
    cell: `${ce}:${cn}`,
    buildingTiles: tilesAroundEnuPoint(origin, center, BUILDING_RADIUS_M, BUILDING_ZOOM),
    imageryTiles: tilesAroundEnuPoint(origin, center, IMAGERY_RADIUS_M, IMAGERY_ZOOM),
  };
}

/** Cache key for one tile's mesh in one origin's frame. */
export function meshKey(origin: EnuOrigin, tile: XyzTile): string {
  const frame = origin.frame.kind === 'place' ? origin.frame.placeId : origin.frame.routeId;
  return `${frame}|${tileKey(tile)}`;
}

/**
 * Fetches and extrudes one tile's buildings. A tile Mapbox has no data for
 * gives an empty mesh. Network and decoding errors reject.
 */
export async function loadBuildingMesh(input: {
  readonly client: Pick<MapboxVectorClient, 'fetchVectorTile'>;
  readonly origin: EnuOrigin;
  readonly tile: XyzTile;
  readonly signal?: AbortSignal;
}): Promise<BuildingMesh> {
  const result = await input.client.fetchVectorTile(input.tile, { signal: input.signal });
  const bytes = result.kind === 'tile' ? result.bytes : new ArrayBuffer(0);
  return extrudeBuildings(bytes, input.tile, input.origin);
}
