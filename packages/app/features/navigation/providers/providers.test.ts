import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { RouteRequest } from '../model/route.ts';
import { FIXTURE_NAMES, fixtureText, loadFixture, lngLatToCoordinate } from '../testing/fixtures.ts';
import { buildExternalMapsHandoff } from './externalMaps.ts';
import {
  buildMapboxDirectionsPath,
  buildMapboxDirectionsQuery,
  createMapboxDirectionsProvider,
  parseMapboxDirections,
} from './mapboxDirections.ts';
import { mapboxTokenFromEnv, parseMapboxToken } from './mapboxToken.ts';
import { RouteProviderError } from './routeProvider.ts';

// A syntactically public token used only against the fake fetch below.
const FAKE_TOKEN = 'pk.test-token-not-real';

type FetchCall = { url: string; signal: AbortSignal | undefined };

function fakeFetch(respond: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), signal: init?.signal ?? undefined };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { impl, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function requestFor(name: string, mode: RouteRequest['mode'] = 'walking'): RouteRequest {
  const f = loadFixture(name);
  return {
    origin: lngLatToCoordinate(f.origin.lngLat),
    destination: { name: f.destination.placeId, coordinate: lngLatToCoordinate(f.destination.lngLat) },
    mode,
  };
}

describe('recorded fixtures', () => {
  it('holds at least four real Harlem walking routes', () => {
    assert.ok(FIXTURE_NAMES.length >= 4);
    for (const name of FIXTURE_NAMES) {
      const f = loadFixture(name);
      assert.equal(f.source, 'Mapbox Directions API v5');
      assert.equal(f.request.profile, 'mapbox/walking');
    }
  });

  it('carries no access token and no request uuid', () => {
    for (const name of FIXTURE_NAMES) {
      const text = fixtureText(name);
      assert.ok(!/pk\.[A-Za-z0-9]/.test(text), `${name} contains a token`);
      assert.ok(!text.includes('access_token'), `${name} contains access_token`);
      assert.ok(!text.includes('"uuid"'), `${name} contains a uuid`);
    }
  });
});

describe('Mapbox Directions request', () => {
  it('reproduces the exact path and query of every recorded two-point fixture', () => {
    for (const name of FIXTURE_NAMES) {
      const f = loadFixture(name);
      if (f.request.path.split(';').length !== 2) continue; // the via-point fixture is not a two-point request
      const request = requestFor(name);
      assert.equal(buildMapboxDirectionsPath(request), f.request.path);
      assert.deepEqual(Object.fromEntries(buildMapboxDirectionsQuery(request)), f.request.query);
    }
  });

  it('routes to the entrance when the destination has one', () => {
    const request = requestFor('apollo-theater--sylvias-restaurant');
    const entrance = { latitude: 40.808673, longitude: -73.944623 };
    const path = buildMapboxDirectionsPath({
      ...request,
      destination: { ...request.destination, entrance: { coordinate: entrance, source: 'cms-verified' } },
    });
    assert.ok(path.endsWith(';-73.944623,40.808673'));
  });

  it('maps every routable mode to a Mapbox profile and forces walking for walking', () => {
    const r = requestFor('apollo-theater--sylvias-restaurant');
    assert.ok(buildMapboxDirectionsPath(r).includes('/mapbox/walking/'));
    assert.ok(buildMapboxDirectionsPath({ ...r, mode: 'cycling' }).includes('/mapbox/cycling/'));
    assert.ok(buildMapboxDirectionsPath({ ...r, mode: 'driving' }).includes('/mapbox/driving-traffic/'));
    assert.throws(() => buildMapboxDirectionsPath({ ...r, mode: 'transit' }), RangeError);
  });

  it('sends the origin bearing so a reroute does not begin with a U-turn', () => {
    const q = buildMapboxDirectionsQuery({
      ...requestFor('apollo-theater--sylvias-restaurant'),
      originBearing: { headingDeg: -30.4, toleranceDeg: 45 },
    });
    assert.equal(q.get('bearings'), '330,45;');
  });

  it('refuses invalid coordinates before calling the network', () => {
    const r = requestFor('apollo-theater--sylvias-restaurant');
    assert.throws(() => buildMapboxDirectionsPath({ ...r, origin: { latitude: 100, longitude: 0 } }), RangeError);
  });
});

describe('parseMapboxDirections', () => {
  it('turns a recorded response into domain routes in lat/lng order', () => {
    const f = loadFixture('apollo-theater--sylvias-restaurant');
    const response = parseMapboxDirections(f.response, 'walking', () => 'r1');
    assert.equal(response.kind, 'routes');
    if (response.kind !== 'routes') return;
    const route = response.routes[0];
    assert.equal(route.id, 'r1');
    assert.equal(route.provider, 'mapbox');
    assert.equal(route.geometry.coordinates.length, 16);
    const first = route.geometry.coordinates[0]!;
    assert.ok(first.latitude > 40 && first.latitude < 41 && first.longitude < -73);
    const steps = route.legs[0]!.steps;
    assert.deepEqual(
      steps.map((s) => s.maneuver.type),
      ['depart', 'end-of-road', 'turn', 'turn', 'turn', 'arrive'],
    );
    assert.equal(steps[1]!.maneuver.modifier, 'right');
    assert.equal(steps[1]!.name, 'West 126th Street');
    assert.equal(steps[1]!.maneuver.bearingAfterDeg, 119);
    assert.equal(steps[2]!.name, '');
    assert.deepEqual(steps.map((s) => s.index), [0, 1, 2, 3, 4, 5]);
  });

  it('numbers steps across legs of a multi-leg route', () => {
    const f = loadFixture('studio-museum-harlem--via-sylvias--west-126th');
    const response = parseMapboxDirections(f.response, 'walking');
    assert.ok(response.kind === 'routes');
    const route = response.routes[0];
    assert.equal(route.legs.length, 2);
    const all = route.legs.flatMap((l) => l.steps.map((s) => s.index));
    assert.deepEqual(all, all.map((_, i) => i));
  });

  it('parses every recorded fixture', () => {
    for (const name of FIXTURE_NAMES) {
      const response = parseMapboxDirections(loadFixture(name).response, 'walking');
      assert.equal(response.kind, 'routes', name);
    }
  });

  it('maps unknown maneuver types to other and rejects malformed shapes', () => {
    const f = loadFixture('apollo-theater--sylvias-restaurant');
    const body = structuredClone(f.response) as { routes: { legs: { steps: { maneuver: { type: string } }[] }[]; geometry: unknown }[] };
    body.routes[0]!.legs[0]!.steps[1]!.maneuver.type = 'teleport';
    const r = parseMapboxDirections(body, 'walking');
    assert.ok(r.kind === 'routes' && r.routes[0].legs[0]!.steps[1]!.maneuver.type === 'other');
    body.routes[0]!.geometry = 'encoded-polyline';
    assert.throws(() => parseMapboxDirections(body, 'walking'), (e: unknown) => e instanceof RouteProviderError && e.kind === 'unavailable');
    assert.throws(() => parseMapboxDirections({ code: 'Ok', routes: [] }, 'walking'), (e: unknown) => e instanceof RouteProviderError && e.kind === 'no-route');
  });
});

describe('createMapboxDirectionsProvider', () => {
  const NAME = 'apollo-theater--sylvias-restaurant';

  it('refuses a missing or secret token', () => {
    assert.throws(() => createMapboxDirectionsProvider({ accessToken: '' }), RangeError);
    assert.throws(() => createMapboxDirectionsProvider({ accessToken: 'sk.secret' }), RangeError);
  });

  it('fetches, passes the abort signal, and parses', async () => {
    const { impl, calls } = fakeFetch(() => json(200, loadFixture(NAME).response));
    const provider = createMapboxDirectionsProvider({ accessToken: FAKE_TOKEN, fetchImpl: impl });
    const abort = new AbortController();
    const response = await provider.getRoutes(requestFor(NAME), { signal: abort.signal });
    assert.equal(response.kind, 'routes');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.signal, abort.signal);
    const url = new URL(calls[0]!.url);
    assert.equal(url.pathname, loadFixture(NAME).request.path);
    assert.equal(url.searchParams.get('access_token'), FAKE_TOKEN);
  });

  it('answers transit with an unsupported result and maps links, without calling Mapbox', async () => {
    const { impl, calls } = fakeFetch(() => json(500, {}));
    const provider = createMapboxDirectionsProvider({ accessToken: FAKE_TOKEN, fetchImpl: impl });
    const response = await provider.getRoutes(requestFor(NAME, 'transit'));
    assert.equal(calls.length, 0);
    assert.ok(response.kind === 'unsupported');
    if (response.kind !== 'unsupported') return;
    assert.equal(response.mode, 'transit');
    assert.ok(response.handoff.appleMapsUrl.includes('dirflg=r'));
    assert.ok(response.handoff.googleMapsUrl.includes('travelmode=transit'));
    assert.ok(!provider.supportedModes.includes('transit'));
  });

  const failures: [string, () => Response, string][] = [
    ['401', () => json(401, { message: 'Not Authorized - Invalid Token' }), 'unauthorized'],
    ['429', () => json(429, { message: 'Too Many Requests' }), 'rate-limited'],
    ['500', () => json(500, { message: 'oops' }), 'unavailable'],
    ['NoRoute', () => json(200, { code: 'NoRoute', message: 'No route found' }), 'no-route'],
    ['NoSegment', () => json(422, { code: 'NoSegment', message: 'No segment' }), 'no-route'],
    ['InvalidInput', () => json(422, { code: 'InvalidInput', message: 'bad' }), 'invalid-request'],
    ['non-JSON 502', () => new Response('<html>bad gateway</html>', { status: 502 }), 'unavailable'],
  ];
  for (const [label, respond, kind] of failures) {
    it(`maps ${label} to ${kind} and never echoes the token`, async () => {
      const { impl } = fakeFetch(respond);
      const provider = createMapboxDirectionsProvider({ accessToken: FAKE_TOKEN, fetchImpl: impl });
      await assert.rejects(provider.getRoutes(requestFor(NAME)), (error: unknown) => {
        assert.ok(error instanceof RouteProviderError);
        assert.equal(error.kind, kind);
        assert.ok(!error.message.includes(FAKE_TOKEN));
        return true;
      });
    });
  }

  it('maps a network failure and a cancellation', async () => {
    const offline = createMapboxDirectionsProvider({
      accessToken: FAKE_TOKEN,
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
    });
    await assert.rejects(offline.getRoutes(requestFor(NAME)), (e: unknown) => e instanceof RouteProviderError && e.kind === 'network');

    const abort = new AbortController();
    const slow = createMapboxDirectionsProvider({
      accessToken: FAKE_TOKEN,
      fetchImpl: ((_: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })) as typeof fetch,
    });
    const pending = slow.getRoutes(requestFor(NAME), { signal: abort.signal });
    abort.abort();
    await assert.rejects(pending, (e: unknown) => e instanceof RouteProviderError && e.kind === 'aborted');
    await assert.rejects(slow.getRoutes(requestFor(NAME), { signal: abort.signal }), (e: unknown) => e instanceof RouteProviderError && e.kind === 'aborted');
  });
});

describe('external maps handoff', () => {
  it('opens the trip at the entrance in Apple and Google Maps', () => {
    const r = requestFor('apollo-theater--sylvias-restaurant', 'transit');
    const h = buildExternalMapsHandoff({
      ...r,
      destination: { ...r.destination, entrance: { coordinate: { latitude: 40.8, longitude: -73.9 }, source: 'cms-verified' } },
    });
    assert.ok(h.appleMapsUrl.startsWith('https://maps.apple.com/?'));
    assert.equal(new URL(h.appleMapsUrl).searchParams.get('daddr'), '40.8,-73.9');
    assert.equal(new URL(h.googleMapsUrl).searchParams.get('destination'), '40.8,-73.9');
    assert.equal(new URL(h.googleMapsUrl).searchParams.get('api'), '1');
  });
});

describe('Mapbox token', () => {
  const saved = { expo: process.env.EXPO_PUBLIC_MAPBOX_TOKEN, next: process.env.NEXT_PUBLIC_MAPBOX_TOKEN };
  afterEach(() => {
    if (saved.expo === undefined) delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    else process.env.EXPO_PUBLIC_MAPBOX_TOKEN = saved.expo;
    if (saved.next === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = saved.next;
  });

  it('classifies raw values', () => {
    assert.deepEqual(parseMapboxToken(undefined), { kind: 'missing' });
    assert.deepEqual(parseMapboxToken('  '), { kind: 'missing' });
    assert.deepEqual(parseMapboxToken('sk.abc'), { kind: 'not-public' });
    assert.deepEqual(parseMapboxToken(' pk.abc '), { kind: 'public', token: 'pk.abc' });
  });

  it('reads Expo first, then Next', () => {
    delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.web';
    assert.deepEqual(mapboxTokenFromEnv(), { kind: 'public', token: 'pk.web' });
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN = 'pk.native';
    assert.deepEqual(mapboxTokenFromEnv(), { kind: 'public', token: 'pk.native' });
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN = 'sk.secret';
    assert.deepEqual(mapboxTokenFromEnv(), { kind: 'not-public' });
  });
});
