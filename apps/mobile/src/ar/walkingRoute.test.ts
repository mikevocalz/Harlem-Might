import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import { fetchWalkingRoute } from './walkingRoute.ts';

const place = (id: string) => MAPPED_PLACES.find((p) => p.id === id)!;
const apollo = place('apollo-theater');
const studio = place('studio-museum-harlem');
const sylvias = place('sylvias-restaurant');

const WALKING_RESPONSE = {
  code: 'Ok',
  routes: [
    {
      distance: 612.4,
      duration: 441.2,
      legs: [],
      geometry: {
        type: 'LineString',
        coordinates: [
          [-73.9499948, 40.8100895],
          [-73.9488, 40.8093],
          [-73.947616, 40.8084179],
          [-73.9445189, 40.8086285],
        ],
      },
    },
  ],
};

describe('fetchWalkingRoute', () => {
  it('requests a walking route through the places in order', async () => {
    let requested = '';
    const route = await fetchWalkingRoute({
      from: apollo,
      to: [studio, sylvias],
      accessToken: 'pk.test',
      fetchImpl: (async (input: RequestInfo | URL) => {
        requested = String(input);
        return new Response(JSON.stringify(WALKING_RESPONSE), { status: 200 });
      }) as typeof fetch,
    });

    const url = new URL(requested);
    assert.match(url.pathname, /\/directions\/v5\/mapbox\/walking\//);
    assert.equal(
      decodeURIComponent(url.pathname.split('/walking/')[1]!),
      '-73.9499948,40.8100895;-73.947616,40.8084179;-73.9445189,40.8086285',
    );
    assert.equal(url.searchParams.get('geometries'), 'geojson');
    assert.equal(url.searchParams.get('alternatives'), 'false');

    assert.equal(route.kind, 'walking');
    assert.equal(route.routeId, 'walk:apollo-theater:studio-museum-harlem,sylvias-restaurant');
    assert.equal(route.coordinates.length, 4);
    assert.deepEqual(route.coordinates[1], { latitude: 40.8093, longitude: -73.9488 });
    if (route.kind === 'walking') {
      assert.equal(route.distanceM, 612.4);
      assert.equal(route.durationS, 441.2);
    }
  });

  it('draws straight segments without a token and never calls the network', async () => {
    let called = false;
    const route = await fetchWalkingRoute({
      from: apollo,
      to: [studio, sylvias],
      accessToken: undefined,
      fetchImpl: (async () => {
        called = true;
        return new Response('{}');
      }) as typeof fetch,
    });
    assert.equal(called, false);
    assert.equal(route.kind, 'straight');
    if (route.kind === 'straight') assert.equal(route.reason, 'no-token');
    assert.deepEqual(route.coordinates, [
      { latitude: 40.8100895, longitude: -73.9499948 },
      { latitude: 40.8084179, longitude: -73.947616 },
      { latitude: 40.8086285, longitude: -73.9445189 },
    ]);
  });

  it('falls back to straight segments when the request fails, keeping the error', async () => {
    const route = await fetchWalkingRoute({
      from: apollo,
      to: [studio],
      accessToken: 'pk.test',
      fetchImpl: (async () => {
        throw new TypeError('Network request failed');
      }) as typeof fetch,
    });
    assert.equal(route.kind, 'straight');
    if (route.kind === 'straight') {
      assert.equal(route.reason, 'request-failed');
      assert.match(route.error ?? '', /Network request failed/);
    }
  });

  it('falls back when Directions finds no route', async () => {
    const route = await fetchWalkingRoute({
      from: apollo,
      to: [studio],
      accessToken: 'pk.test',
      fetchImpl: (async () =>
        new Response(JSON.stringify({ code: 'NoRoute', routes: [] }), { status: 200 })) as typeof fetch,
    });
    assert.equal(route.kind, 'straight');
  });

  it('rejects an empty destination list', async () => {
    await assert.rejects(
      fetchWalkingRoute({ from: apollo, to: [], accessToken: 'pk.test' }),
      RangeError,
    );
  });
});
