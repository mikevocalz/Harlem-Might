import assert from 'node:assert/strict';
import { it } from 'node:test';
import { fixPlaceCoords } from './fix-place-coords-runner.ts';

const place = (id: number) => ({ id, slug: `place-${id}`, name: `Monument${id}` });
const now = () => new Date('2026-10-12T12:00:00Z');
const geosearch = 'https://geosearch.example/v2';
const queryUrl = (query: string) => `${geosearch}/search?text=${encodeURIComponent(query)}&size=1`;
const nameQuery = (id: number) => `${place(id).name}, Harlem, New York, NY`;
const point: [number, number] = [-73.95, 40.8];
const feature = (name: string, coordinates = point, borough = 'Manhattan') => ({ geometry: { coordinates }, properties: { name, borough } });
const logger = () => {
  const info: string[] = [];
  const errors: unknown[][] = [];
  return { info, errors, log: { info: (message: string) => { info.push(message); }, error: (...args: unknown[]) => { errors.push(args); } } };
};
const cannotWrite = async () => assert.fail('Preview/no-hit runs cannot write');
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const unreadable = () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('Body read failed')); } }));

it('reports successful empty results as genuine no-hits and exits successfully', async () => {
  const { info, errors, log } = logger();
  const result = await fixPlaceCoords({ find: async () => ({ docs: [place(1)], hasNextPage: false }), update: cannotWrite }, false, {
    log, geosearch, fetcher: async () => json({ features: [] }),
  });
  assert.deepEqual(result, { resolved: 0, updated: 0, misses: ['place-1 (Monument1)'], failedRequests: 0, failedPlaces: 0, unresolvedFailures: [], writeFailures: 0, exitCode: 0 });
  assert.match(info.join('\n'), /No geocode hit \(1\): place-1 \(Monument1\)/);
  assert.deepEqual(errors, []);
});

for (const [kind, response] of [
  ['HTTP', async () => new Response('Unavailable', { status: 503 })],
  ['network', async () => { throw new TypeError('Connection refused'); }],
  ['timeout', async () => { throw new DOMException('Timed out', 'TimeoutError'); }],
  ['body', async () => unreadable()],
  ['JSON parse', async () => new Response('{"features":[')],
] as const) {
  it(`reports ${kind} failure instead of a false no-hit, without retrying`, async () => {
    const { info, errors, log } = logger();
    let requests = 0;
    const result = await fixPlaceCoords({ find: async () => ({ docs: [place(1)], hasNextPage: false }), update: cannotWrite }, true, {
      log, geosearch,
      fetcher: async (url, options) => {
        requests++;
        assert.equal(url, queryUrl(nameQuery(1)));
        assert.ok(options?.signal instanceof AbortSignal);
        assert.ok(new Headers(options?.headers).get('User-Agent'));
        return response();
      },
    });
    assert.equal(requests, 1);
    assert.deepEqual(result, { resolved: 0, updated: 0, misses: [], failedRequests: 1, failedPlaces: 1, unresolvedFailures: ['place-1 (Monument1)'], writeFailures: 0, exitCode: 1 });
    assert.doesNotMatch(info.join('\n'), /No geocode hit/);
    assert.match(String(errors[0]?.[0]), /Coordinate lookup failed for place-1/);
    if (kind === 'HTTP') assert.match(String(errors[0]?.[1]), /HTTP 503/);
    assert.match(String(errors[1]?.[0]), /Unresolved after request failures \(1\)/);
  });
}

for (const apply of [false, true]) {
  it(`keeps partial successes with unchanged coordinate updates in ${apply ? 'apply' : 'preview'} mode`, async () => {
    const { info, log } = logger();
    const writes: unknown[] = [];
    const requests: string[] = [];
    const result = await fixPlaceCoords({
      find: async () => ({ docs: [place(1), place(2), place(3)], hasNextPage: false }),
      update: async (args) => { writes.push(args); },
    }, apply, {
      log, now, geosearch,
      fetcher: async (url) => {
        requests.push(String(url));
        if (url === queryUrl(nameQuery(1))) throw new Error('Offline');
        return json({ features: url === queryUrl(nameQuery(2)) ? [] : [feature('Monument3')] });
      },
    });
    assert.deepEqual(requests, [1, 2, 3].map((id) => queryUrl(nameQuery(id))));
    assert.deepEqual(result, { resolved: 1, updated: apply ? 1 : 0, misses: ['place-2 (Monument2)'], failedRequests: 1, failedPlaces: 1, unresolvedFailures: ['place-1 (Monument1)'], writeFailures: 0, exitCode: 1 });
    assert.deepEqual(writes, apply ? [{
      collection: 'places', id: 3, overrideAccess: true,
      data: { location: point, locationAccuracy: 'approx', locationSource: { url: queryUrl(nameQuery(3)), verifiedAt: now().toISOString() } },
    }] : []);
    assert.match(info.join('\n'), apply ? /Updated 1 of 3/ : /Would update 1 of 3/);
    assert.match(info.join('\n'), /No geocode hit \(1\): place-2 \(Monument2\)/);
  });
}

it('tries the remaining address/name candidates after failures and reports a recovered partial failure', async () => {
  const { info, log } = logger();
  const requests: string[] = [];
  const result = await fixPlaceCoords({
    find: async () => ({ docs: [{ ...place(1), address: { formatted: 'Monument Garden, 125th Street and Lenox Avenue, New York, NY; room detail' } }], hasNextPage: false }),
    update: cannotWrite,
  }, false, {
    log, geosearch,
    fetcher: async (url) => {
      requests.push(String(url));
      if (requests.length === 1) return new Response('Unavailable', { status: 503 });
      if (requests.length === 2) return new Response('{');
      return json({ features: requests.length === 4 ? [feature('Monument1')] : [] });
    },
  });
  assert.deepEqual(requests, [
    '125th Street and Lenox Avenue, New York, NY',
    '125th Street & Lenox Avenue, New York, NY',
    'Monument Garden, New York, NY',
    nameQuery(1),
  ].map(queryUrl));
  assert.equal(result.resolved, 1);
  assert.equal(result.failedRequests, 2);
  assert.equal(result.failedPlaces, 1);
  assert.deepEqual(result.misses, []);
  assert.deepEqual(result.unresolvedFailures, []);
  assert.equal(result.exitCode, 1);
  assert.match(info.join('\n'), /2 coordinate requests failed across 1 places \(1 resolved via another source\)/);
});

const monumentUrl = 'https://data.cityofnewyork.us/resource/6rrm-vxj9.json?number=123';
const monumentRequest = `${monumentUrl}&$select=parknumber`;
const parkRequest = 'https://data.cityofnewyork.us/resource/enfh-gkve.json?gispropnum=M014&$select=signname,multipolygon';

it('preserves the monument provenance join and largest-ring centroid without geocoding', async () => {
  const { log } = logger();
  const requests: string[] = [];
  const writes: unknown[] = [];
  const ring = [[-73.96, 40.78], [-73.94, 40.78], [-73.94, 40.82], [-73.96, 40.82]];
  const centroid = ring.reduce<[number, number]>((sum, p) => [sum[0] + p[0]!, sum[1] + p[1]!], [0, 0]).map((n) => n / ring.length);
  const result = await fixPlaceCoords({
    find: async () => ({ docs: [{ ...place(1), locationSource: { url: monumentUrl } }], hasNextPage: false }),
    update: async (args) => { writes.push(args); },
  }, true, {
    log, geosearch, now,
    fetcher: async (url) => {
      requests.push(String(url));
      if (url === monumentRequest) return json([{ parknumber: 'M014' }]);
      assert.equal(url, parkRequest);
      return json([{ signname: 'Official Park', multipolygon: { coordinates: [[[[0, 0], [1, 1]]], [ring]] } }]);
    },
  });
  assert.deepEqual(requests, [monumentRequest, parkRequest]);
  assert.equal(result.resolved, 1);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(writes, [{
    collection: 'places', id: 1, overrideAccess: true,
    data: { location: centroid, locationAccuracy: 'approx', locationSource: { url: parkRequest, verifiedAt: now().toISOString() } },
  }]);
});

for (const stage of ['monument', 'park'] as const) {
  it(`reports a failed ${stage} source even when a later geocode resolves it`, async () => {
    const { log } = logger();
    const requests: string[] = [];
    const result = await fixPlaceCoords({
      find: async () => ({ docs: [{ ...place(1), locationSource: { url: monumentUrl } }], hasNextPage: false }),
      update: cannotWrite,
    }, false, {
      log, geosearch,
      fetcher: async (url) => {
        requests.push(String(url));
        if (url === monumentRequest && stage !== 'monument') return json([{ parknumber: 'M014' }]);
        if (url !== queryUrl(nameQuery(1))) return new Response('Unavailable', { status: 503 });
        return json({ features: [feature('Monument1')] });
      },
    });
    assert.deepEqual(requests, stage === 'monument' ? [monumentRequest, queryUrl(nameQuery(1))] : [monumentRequest, parkRequest, queryUrl(nameQuery(1))]);
    assert.equal(result.resolved, 1);
    assert.equal(result.failedRequests, 1);
    assert.equal(result.failedPlaces, 1);
    assert.equal(result.exitCode, 1);
  });
}

it('successful empty monument and geocoder responses remain genuine misses', async () => {
  const { log } = logger();
  const requests: string[] = [];
  const result = await fixPlaceCoords({
    find: async () => ({ docs: [{ ...place(1), locationSource: { url: monumentUrl } }], hasNextPage: false }), update: cannotWrite,
  }, false, { log, geosearch, fetcher: async (url) => { requests.push(String(url)); return json(url === monumentRequest ? [] : { features: [] }); } });
  assert.deepEqual(requests, [monumentRequest, queryUrl(nameQuery(1))]);
  assert.equal(result.failedRequests, 0);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.misses, ['place-1 (Monument1)']);
});

for (const [label, candidate] of [
  ['wrong borough', feature('Monument1', point, 'Queens')],
  ['outside bounds', feature('Monument1', [-73.8, 40.8])],
  ['unrelated label', feature('Columbus Circle')],
  ['generic token overlap', feature('Harlem Park New York')],
] as const) {
  it(`preserves ${label} rejection as a successful no-hit`, async () => {
    const { log } = logger();
    const result = await fixPlaceCoords({ find: async () => ({ docs: [place(1)], hasNextPage: false }), update: cannotWrite }, true, {
      log, geosearch, fetcher: async () => json({ features: [candidate] }),
    });
    assert.equal(result.resolved, 0);
    assert.equal(result.failedRequests, 0);
    assert.equal(result.exitCode, 0);
    assert.deepEqual(result.misses, ['place-1 (Monument1)']);
  });
}

it('preserves Bronx matching and selection of only records without existing coordinates across all pages', async () => {
  const { log } = logger();
  let pages = 0;
  const requests: string[] = [];
  const result = await fixPlaceCoords({
    find: async (args) => {
      pages++;
      assert.deepEqual(args, { collection: 'places', limit: 500, page: pages, depth: 0, overrideAccess: true });
      return { docs: pages === 1 ? [{ ...place(1), location: point }] : [place(2)], hasNextPage: pages === 1 };
    },
    update: cannotWrite,
  }, false, {
    log, geosearch,
    fetcher: async (url) => {
      assert.equal(pages, 2);
      requests.push(String(url));
      return json({ features: [feature('Monument2', point, 'Bronx')] });
    },
  });
  assert.deepEqual(requests, [queryUrl(nameQuery(2))]);
  assert.equal(result.resolved, 1);
  assert.equal(result.exitCode, 0);
});

it('continues after a rejected coordinate update and reports only completed writes', async () => {
  const { info, errors, log } = logger();
  const writes: number[] = [];
  const result = await fixPlaceCoords({
    find: async () => ({ docs: [place(1), place(2)], hasNextPage: false }),
    update: async ({ id }) => { writes.push(id); if (id === 1) throw new Error('Invalid record'); },
  }, true, {
    log, now, geosearch,
    fetcher: async (url) => json({ features: [feature(url === queryUrl(nameQuery(1)) ? 'Monument1' : 'Monument2')] }),
  });
  assert.deepEqual(writes, [1, 2]);
  assert.equal(result.resolved, 2);
  assert.equal(result.updated, 1);
  assert.equal(result.writeFailures, 1);
  assert.equal(result.failedRequests, 0);
  assert.equal(result.exitCode, 1);
  assert.match(info.join('\n'), /Updated 1 of 2; 1 writes failed/);
  assert.match(String(errors[0]?.[0]), /Could not update coordinates for place-1/);
});

it('does not request or write when a later database selection page fails', async () => {
  await assert.rejects(fixPlaceCoords({
    find: async ({ page }) => { if (page === 2) throw new Error('Read failed'); return { docs: [place(1)], hasNextPage: true }; },
    update: cannotWrite,
  }, true, { fetcher: async () => assert.fail('Selection must finish first') }), /Read failed/);
});

it('an empty selection succeeds without requests or writes', async () => {
  const { log } = logger();
  const result = await fixPlaceCoords({ find: async () => ({ docs: [], hasNextPage: false }), update: cannotWrite }, false, {
    log, fetcher: async () => assert.fail('Nothing to fetch'),
  });
  assert.deepEqual(result, { resolved: 0, updated: 0, misses: [], failedRequests: 0, failedPlaces: 0, unresolvedFailures: [], writeFailures: 0, exitCode: 0 });
});
