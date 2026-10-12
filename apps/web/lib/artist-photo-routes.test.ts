import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { after, afterEach, beforeEach, mock, test, type Mock } from 'node:test';
import type { ContentResult } from '@acme/app/content';
import { ARTIST_PHOTO_VERSION } from '@acme/app/features/music/artist-photo-policy.ts';
import { resolveReviewedArtistPhoto } from '@acme/app/features/music/reviewed-artist-photo.ts';
import { PhotoFetchError, type fetchPublicPhotoResource } from '@acme/payload/artist-photo-fetch';

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server') as typeof import('next/server');
const routeUrl = new URL('../app/api/music/artist-photo/route.ts', import.meta.url).href;
const imageRouteUrl = new URL('../app/api/music/artist-photo/image/route.ts', import.meta.url).href;
const catalogueBoundaryUrl = 'artist-photo-route-test:catalogue';
const fetchBoundaryUrl = 'artist-photo-route-test:fetch';
const fetchModuleUrl = new URL('../../../packages/payload/src/artist-photo-fetch.ts', import.meta.url).href;

// Execute the actual handlers, resolver, catalogue guard and Next response
// implementation. Only database reads and the network boundary are controlled.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === catalogueBoundaryUrl || specifier === fetchBoundaryUrl) {
      return { url: specifier, shortCircuit: true };
    }
    if (context.parentURL === routeUrl || context.parentURL === imageRouteUrl) {
      if (specifier === '@acme/payload/server') return { url: catalogueBoundaryUrl, shortCircuit: true };
      if (specifier === '@acme/payload/artist-photo-fetch') return { url: fetchBoundaryUrl, shortCircuit: true };
      if (specifier === '@/lib/artist-photo-catalogue') return next(new URL('./artist-photo-catalogue.ts', import.meta.url).href, context);
      if (specifier === 'next/server') return next('next/server.js', context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === catalogueBoundaryUrl) return {
      format: 'module', shortCircuit: true,
      source: "import { mock } from 'node:test'; export const listMusicArtists = mock.fn();",
    };
    if (url === fetchBoundaryUrl) return {
      format: 'module', shortCircuit: true,
      source: `import { mock } from 'node:test'; export { PhotoFetchError } from '${fetchModuleUrl}'; export const fetchPublicPhotoResource = mock.fn();`,
    };
    return next(url, context);
  },
});
after(() => hooks.deregister());

type Catalogue = ContentResult<readonly { name: string }[]>;
type Handler = (request: InstanceType<typeof NextRequest>) => Promise<Response>;
const { listMusicArtists } = await import(catalogueBoundaryUrl) as {
  listMusicArtists: Mock<() => Promise<Catalogue>>;
};
const { fetchPublicPhotoResource: fetchPhoto } = await import(fetchBoundaryUrl) as {
  fetchPublicPhotoResource: Mock<typeof fetchPublicPhotoResource>;
};
const { GET: getPhotos } = await import(routeUrl) as { GET: Handler };
const { GET: getImage } = await import(imageRouteUrl) as { GET: Handler };
const cacheControl = 'public, s-maxage=604800, stale-while-revalidate=86400';
const publishedNames = ['Cameo', 'Big L', 'A$AP Ant', 'Ella Fitzgerald'];
let unexpectedFetch: Mock<typeof fetch>;

beforeEach(() => {
  listMusicArtists.mock.resetCalls();
  listMusicArtists.mock.mockImplementation(async () => ({ status: 'ok', data: publishedNames.map((name) => ({ name })) }));
  fetchPhoto.mock.resetCalls();
  fetchPhoto.mock.mockImplementation(async () => { throw new Error('Unexpected upstream request'); });
  unexpectedFetch = mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected live fetch'); });
});
afterEach(() => {
  try {
    assert.equal(unexpectedFetch.mock.callCount(), 0, 'handlers must not bypass the bounded photo fetcher');
  } finally {
    unexpectedFetch.mock.restore();
  }
});

function request(path: string, params: Record<string, string> = {}, origin = 'https://preview.example.test:8443') {
  const url = new URL(`/api/music/artist-photo${path}`, origin);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return new NextRequest(url, { headers: { 'x-forwarded-host': 'untrusted.example.test' } });
}

function assertErrorHeaders(response: Response, contentType: string) {
  assert.ok(response instanceof NextResponse);
  assert.equal(response.headers.get('content-type'), contentType);
  assert.equal(response.headers.get('cache-control'), null, 'errors must not inherit the public photo cache');
  assert.equal(response.headers.get('content-disposition'), null);
  assert.equal(response.headers.get('x-content-type-options'), null);
}

test('metadata GET trims, deduplicates and sorts exact published names before returning reviewed photos', async () => {
  const response = await getPhotos(request('', {
    names: ' Cameo | |Big L|Cameo| A$AP Ant \t|Unknown Artist|Vado|big l|Ella Fitzgerald ',
  }));
  assert.ok(response instanceof NextResponse);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(response.headers.get('cache-control'), cacheControl);
  const { photos } = await response.json();
  assert.deepEqual(Object.keys(photos), ['A$AP Ant', 'Big L', 'Cameo', 'Ella Fitzgerald']);
  assert.equal(photos['Big L'].name, 'Big L');
  assert.equal(photos['A$AP Ant'].name, 'A$AP Ant');
  assert.equal(listMusicArtists.mock.callCount(), 1);
  assert.equal(fetchPhoto.mock.callCount(), 0);
});

test('metadata GET proxies curated web photos at the request origin and preserves reviewed attribution and Commons URLs', async () => {
  const origin = 'https://harlem-preview.example.test:9443';
  const response = await getPhotos(request('', { names: 'A$AP Ant|Cameo|Ella Fitzgerald' }, origin));
  assert.equal(response.status, 200);
  const { photos } = await response.json();
  for (const name of ['A$AP Ant', 'Cameo']) {
    const reviewed = resolveReviewedArtistPhoto(name)!;
    assert.equal(reviewed.provider, 'curated_web');
    assert.deepEqual(photos[name], {
      ...reviewed,
      url: `${origin}/api/music/artist-photo/image?name=${encodeURIComponent(name)}&v=${ARTIST_PHOTO_VERSION}`,
    });
    const proxy = new URL(photos[name].url);
    assert.equal(proxy.origin, origin);
    assert.equal(proxy.searchParams.get('name'), name);
  }
  assert.deepEqual(photos['Ella Fitzgerald'], resolveReviewedArtistPhoto('Ella Fitzgerald'));
  assert.equal(fetchPhoto.mock.callCount(), 0);
});

for (const names of [undefined, '', ' | \t| ', 'Unknown Artist', 'Vado', 'big l', 'Cameo (band)']) {
  test(`metadata GET returns 400 without upstream work for rejected names ${JSON.stringify(names)}`, async () => {
    const response = await getPhotos(request('', names === undefined ? {} : { names }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { photos: {} });
    assertErrorHeaders(response, 'application/json');
    assert.equal(fetchPhoto.mock.callCount(), 0);
  });
}

test('metadata GET returns 400 when an answered catalogue is empty', async () => {
  listMusicArtists.mock.mockImplementation(async () => ({ status: 'ok', data: [] }));
  const response = await getPhotos(request('', { names: 'Cameo' }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { photos: {} });
  assertErrorHeaders(response, 'application/json');
  assert.equal(fetchPhoto.mock.callCount(), 0);
});

test('metadata GET returns null rather than discovering a photo for a published but unreviewed artist', async () => {
  listMusicArtists.mock.mockImplementation(async () => ({ status: 'ok', data: [{ name: 'New Published Artist' }] }));
  const response = await getPhotos(request('', { names: 'New Published Artist' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { photos: { 'New Published Artist': null } });
  assert.equal(fetchPhoto.mock.callCount(), 0);
});

for (const catalogue of [
  { status: 'unavailable', reason: 'not-configured' },
  { status: 'unavailable', reason: 'query-failed', error: new Error('private database detail') },
] satisfies Catalogue[]) {
  test(`both GET handlers fail closed with 503 when the catalogue is ${catalogue.reason}`, async () => {
    listMusicArtists.mock.mockImplementation(async () => catalogue);
    const metadata = await getPhotos(request('', { names: 'Cameo' }));
    assert.equal(metadata.status, 503);
    assert.deepEqual(await metadata.json(), { photos: {}, error: 'catalogue-unavailable' });
    assertErrorHeaders(metadata, 'application/json');

    const image = await getImage(request('/image', { name: 'Cameo' }));
    assert.equal(image.status, 503);
    assert.equal(await image.text(), 'Image unavailable');
    assertErrorHeaders(image, 'text/plain;charset=UTF-8');
    assert.equal(listMusicArtists.mock.callCount(), 2);
    assert.equal(fetchPhoto.mock.callCount(), 0);
  });
}

for (const name of [undefined, '', ' \t ', 'Unknown Artist', 'Ella Fitzgerald', 'Cameo (band)', 'https://attacker.example.test/photo.jpg']) {
  test(`image GET returns 404 before catalogue or upstream work for invalid/non-proxy names ${JSON.stringify(name)}`, async () => {
    const response = await getImage(request('/image', name === undefined ? {} : { name }));
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Not found');
    assertErrorHeaders(response, 'text/plain;charset=UTF-8');
    assert.equal(listMusicArtists.mock.callCount(), 0);
    assert.equal(fetchPhoto.mock.callCount(), 0);
  });
}

for (const name of ['Vado', 'cameo', 'A$AP  Ant']) {
  test(`image GET requires the exact published name even for a reviewed photo: ${name}`, async () => {
    assert.equal(resolveReviewedArtistPhoto(name)?.provider, 'curated_web');
    const response = await getImage(request('/image', { name }));
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Not found');
    assertErrorHeaders(response, 'text/plain;charset=UTF-8');
    assert.equal(listMusicArtists.mock.callCount(), 1);
    assert.equal(fetchPhoto.mock.callCount(), 0);
  });
}

test('image GET returns 404 without fetching when the answered catalogue is empty', async () => {
  listMusicArtists.mock.mockImplementation(async () => ({ status: 'ok', data: [] }));
  const response = await getImage(request('/image', { name: 'Cameo' }));
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not found');
  assertErrorHeaders(response, 'text/plain;charset=UTF-8');
  assert.equal(fetchPhoto.mock.callCount(), 0);
});

test('image GET trims the name and fetches only the reviewed URL with bounded-image options and safe response headers', async () => {
  const photo = resolveReviewedArtistPhoto('A$AP Ant')!;
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
  fetchPhoto.mock.mockImplementation(async () => ({
    ok: true, url: photo.url, bytes, contentType: 'image/png',
    json: async () => ({}), text: async () => '',
  }));
  const response = await getImage(request('/image', {
    name: ' \tA$AP Ant  ',
    url: 'https://attacker.example.test/override.jpg',
    sourceUrl: 'https://attacker.example.test/override',
  }));
  assert.ok(response instanceof NextResponse);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cache-control'), cacheControl);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('content-disposition'), 'inline');
  assert.equal(listMusicArtists.mock.callCount(), 1);
  assert.equal(fetchPhoto.mock.callCount(), 1);
  assert.deepEqual(fetchPhoto.mock.calls[0]!.arguments, [photo.url, {
    kind: 'image',
    headers: {
      accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif',
      referer: photo.sourceUrl,
    },
  }]);
});

for (const [label, error, status] of [
  ['oversized image', new PhotoFetchError('too-large'), 413],
  ['unsupported content', new PhotoFetchError('unsupported'), 415],
  ['blocked network destination', new PhotoFetchError('blocked'), 502],
  ['unavailable upstream', new PhotoFetchError('unavailable'), 502],
  ['unexpected exception', new Error('private upstream detail'), 502],
  ['untrusted error-shaped value', { reason: 'too-large' }, 502],
] as const) {
  test(`image GET maps ${label} to ${status} without caching or exposing upstream details`, async () => {
    fetchPhoto.mock.mockImplementation(async () => { throw error; });
    const response = await getImage(request('/image', { name: 'Cameo' }));
    assert.equal(response.status, status);
    assert.equal(await response.text(), 'Image unavailable');
    assertErrorHeaders(response, 'text/plain;charset=UTF-8');
    assert.equal(listMusicArtists.mock.callCount(), 1);
    assert.equal(fetchPhoto.mock.callCount(), 1);
  });
}
