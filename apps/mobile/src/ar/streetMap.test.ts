import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import { tabletopOrigin } from './arTabletop.ts';
import { BUILDING_ZOOM, IMAGERY_ZOOM, loadBuildingMesh, meshKey, streetMapTiles } from './streetMap.ts';

const apollo = MAPPED_PLACES.find((place) => place.id === 'apollo-theater')!;
const origin = tabletopOrigin(apollo);

describe('streetMapTiles', () => {
  it('keeps the same tile set for small moves inside one grid cell', () => {
    const a = streetMapTiles(origin, { eastM: 0, northM: -4 });
    const b = streetMapTiles(origin, { eastM: 30, northM: 20 });
    assert.equal(a.cell, b.cell);
    assert.deepEqual(a.buildingTiles, b.buildingTiles);
    assert.ok(a.buildingTiles.every((t) => t.z === BUILDING_ZOOM));
    assert.ok(a.imageryTiles.every((t) => t.z === IMAGERY_ZOOM));
    // 300 m around the wearer at z17 (~231 m tiles): at most a 4 x 4 block.
    assert.ok(a.imageryTiles.length >= 4 && a.imageryTiles.length <= 16, `${a.imageryTiles.length}`);
  });

  it('moves the set when the wearer teleports a block away', () => {
    const a = streetMapTiles(origin, { eastM: 0, northM: 0 });
    const b = streetMapTiles(origin, { eastM: 760, northM: 506 });
    assert.notEqual(a.cell, b.cell);
    assert.notDeepEqual(a.imageryTiles, b.imageryTiles);
  });
});

describe('loadBuildingMesh', () => {
  const tile = { z: 16, x: 19305, y: 24616 };

  it('turns a tile Mapbox has no data for into an empty mesh', async () => {
    const mesh = await loadBuildingMesh({
      client: { fetchVectorTile: async () => ({ kind: 'empty' }) },
      origin,
      tile,
    });
    assert.equal(mesh.buildingCount, 0);
    assert.equal(meshKey(origin, tile), 'apollo-theater|16/19305/24616');
  });

  it('rejects when the request fails', async () => {
    await assert.rejects(
      loadBuildingMesh({
        client: {
          fetchVectorTile: async () => {
            throw new Error('HTTP 401');
          },
        },
        origin,
        tile,
      }),
      /HTTP 401/,
    );
  });
});
