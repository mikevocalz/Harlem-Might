import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPage, listPlaces, type CmsPage, type CmsPlace } from './payload.ts';

const page = { id: 17, title: 'Harlem history', slug: 'harlem-history', published: true, updatedAt: '2026-10-12T00:00:00Z', createdAt: '2026-10-12T00:00:00Z' } satisfies CmsPage;

test('an answered empty page query is the only missing-page result', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ docs: [] }));
  assert.equal(await getPage('missing'), null);
});

test('page reads retain the published filter and safely encode the requested slug', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('where[slug][equals]'), 'name&published=false');
    assert.equal(url.searchParams.get('where[published][equals]'), 'true');
    assert.equal(url.searchParams.get('limit'), '1');
    return Response.json({ docs: [page] });
  });
  assert.deepEqual(await getPage('name&published=false'), page);
});

test('a CMS connection failure reaches the router error boundary instead of becoming a 404', async (t) => {
  const offline = new Error('CMS offline');
  t.mock.method(globalThis, 'fetch', async () => { throw offline; });
  await assert.rejects(getPage('harlem-history'), (error) => error === offline);
});

test('an unsuccessful CMS response is not a missing page', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Unavailable', { status: 503 }));
  await assert.rejects(getPage('harlem-history'), /Payload request failed: 503/);
});

test('malformed CMS responses are not reported as missing content', async (t) => {
  const responses = [new Response('{invalid'), Response.json({ docs: null })];
  t.mock.method(globalThis, 'fetch', async () => responses.shift()!);
  await assert.rejects(getPage('harlem-history'), SyntaxError);
  await assert.rejects(getPage('harlem-history'), TypeError);
});

test('CMS projections preserve numeric document and unpopulated relationship IDs', async (t) => {
  const place = { id: 23, name: 'Apollo', slug: 'apollo', kind: 'culture', lifecycle: 'open', logo: 17, updatedAt: page.updatedAt, createdAt: page.createdAt } satisfies CmsPlace;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ docs: [place] }));
  const result = await listPlaces();
  assert.deepEqual(result.status, { ok: true });
  const id: number | undefined = result.places[0]?.id;
  assert.equal(id, 23);
  assert.equal(result.places[0]?.logo, 17);
});
