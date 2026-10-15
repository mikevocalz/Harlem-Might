import assert from 'node:assert/strict';
import { it } from 'node:test';
import { enrichPlacesMenus } from './enrich-places-menus-runner.ts';

const row = (id: number) => ({ id, slug: `place-${id}`, name: `Place ${id}`, website: `https://venue${id}.example/` });
const now = () => new Date('2026-10-12T12:00:00Z');
const logger = () => {
  const info: string[] = [];
  const errors: unknown[][] = [];
  return { info, errors, log: { info: (message: string) => { info.push(message); }, error: (...args: unknown[]) => { errors.push(args); } } };
};
const html = (body: string, finalUrl = 'https://redirected.example/restaurant/') => {
  const response = new Response(body, { headers: { 'content-type': 'text/html' } });
  Object.defineProperty(response, 'url', { value: finalUrl });
  return response;
};
const unreadable = () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('Body read failed')); } }), {
  headers: { 'content-type': 'text/html' },
});
const cannotWrite = async () => assert.fail('Preview/no-result runs cannot write');

it('treats a successful empty homepage as checked, with a successful exit and no writes', async () => {
  const { info, log } = logger();
  const result = await enrichPlacesMenus({ find: async () => ({ docs: [row(1)], hasNextPage: false }), update: cannotWrite }, false, {
    log, fetcher: async () => html(''),
  });
  assert.deepEqual(result, { found: 0, checked: 1, skipped: 0, requestFailures: 0, updated: 0, writeFailures: 0, exitCode: 0 });
  assert.match(info.join('\n'), /0 places of 1 homepages checked/);
  assert.match(info.join('\n'), /Preview only/);
});

it('distinguishes successful non-HTML skips from failed requests', async () => {
  const { log } = logger();
  const result = await enrichPlacesMenus({ find: async () => ({ docs: [row(1)], hasNextPage: false }), update: cannotWrite }, true, {
    log, fetcher: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }),
  });
  assert.deepEqual(result, { found: 0, checked: 0, skipped: 1, requestFailures: 0, updated: 0, writeFailures: 0, exitCode: 0 });
});

for (const [kind, response] of [
  ['HTTP', async () => new Response('Unavailable', { status: 503 })],
  ['network', async () => { throw new TypeError('Connection refused'); }],
  ['timeout', async () => { throw new DOMException('Timed out', 'TimeoutError'); }],
  ['body', async () => unreadable()],
] as const) {
  it(`reports ${kind} failures without counting the homepage as checked`, async () => {
    const { info, errors, log } = logger();
    let requests = 0;
    const result = await enrichPlacesMenus({ find: async () => ({ docs: [row(1)], hasNextPage: false }), update: cannotWrite }, false, {
      log,
      fetcher: async (url, options) => {
        requests++;
        assert.equal(url, row(1).website);
        assert.equal(options?.redirect, 'follow');
        assert.equal(new Headers(options?.headers).get('Accept'), 'text/html');
        assert.ok(new Headers(options?.headers).get('User-Agent'));
        assert.ok(options?.signal instanceof AbortSignal);
        return response();
      },
    });
    assert.equal(requests, 1);
    assert.deepEqual(result, { found: 0, checked: 0, skipped: 0, requestFailures: 1, updated: 0, writeFailures: 0, exitCode: 1 });
    assert.match(String(errors[0]?.[0]), /place-1/);
    if (kind === 'HTTP') assert.match(String(errors[0]?.[1]), /HTTP 503/);
    assert.match(info.join('\n'), /0 homepages checked; 0 non-HTML responses skipped; 1 requests failed/);
  });
}

for (const apply of [false, true]) {
  it(`keeps partial discoveries and exact menu provenance in ${apply ? 'apply' : 'preview'} mode`, async () => {
    const { info, log } = logger();
    const writes: unknown[] = [];
    const result = await enrichPlacesMenus({
      find: async () => ({ docs: [row(1), row(2), row(3), row(4)], hasNextPage: false }),
      update: async (args) => { writes.push(args); },
    }, apply, {
      log, now,
      fetcher: async (url) => {
        if (url === row(2).website) return html('<a href="/contact">Contact</a>');
        if (url === row(3).website) throw new Error('Offline');
        if (url === row(4).website) return new Response('PDF', { headers: { 'content-type': 'application/pdf' } });
        return html([
          '<a href="javascript:menu()">Menu</a>',
          '<a href="https://instagram.com/menu">Menu</a>',
          '<a href="./menu#lunch"><strong>Menu</strong></a>',
          '<a href="./menu#dinner">Menu</a>',
          '<a href="/dining">Eat here</a>',
          '<a href="https://order.example/menu">Menu</a>',
          '<a href="/fourth-menu">Menu</a>',
        ].join(''));
      },
    });
    assert.deepEqual(result, { found: 1, checked: 2, skipped: 1, requestFailures: 1, updated: apply ? 1 : 0, writeFailures: 0, exitCode: 1 });
    assert.deepEqual(writes, apply ? [{
      collection: 'places', id: 1, overrideAccess: true,
      data: { menus: ['https://redirected.example/restaurant/menu', 'https://redirected.example/dining', 'https://order.example/menu'].map((url, index) => ({
        label: index ? `Menu (${index + 1})` : 'Menu', format: 'web', url, sourceUrl: row(1).website,
        lastVerifiedAt: now().toISOString(), active: true,
      })) },
    }] : []);
    assert.match(info.join('\n'), apply ? /Wrote menus for 1 places; 0 writes failed/ : /Preview only/);
  });
}

it('continues after a rejected menu update and reports only completed writes', async () => {
  const { info, errors, log } = logger();
  const writes: number[] = [];
  const result = await enrichPlacesMenus({
    find: async () => ({ docs: [row(1), row(2)], hasNextPage: false }),
    update: async ({ id }) => { writes.push(id); if (id === 1) throw new Error('Invalid record'); },
  }, true, { log, now, fetcher: async () => html('<a href="/menu">Menu</a>') });
  assert.deepEqual(writes, [1, 2]);
  assert.equal(result.found, 2);
  assert.equal(result.updated, 1);
  assert.equal(result.writeFailures, 1);
  assert.equal(result.requestFailures, 0);
  assert.equal(result.exitCode, 1);
  assert.match(info.join('\n'), /Wrote menus for 1 places; 1 writes failed/);
  assert.match(String(errors[0]?.[0]), /Could not write menus for place-1/);
});

it('preserves paginated selection, food priority, the 400-site cap, and eight-worker bound', async () => {
  const { log } = logger();
  const docs = Array.from({ length: 405 }, (_, index) => ({ ...row(index + 1), primaryCategory: index === 404 ? 'Food' : 'Other' }));
  const visited: string[] = [];
  let active = 0;
  let peak = 0;
  let reads = 0;
  const result = await enrichPlacesMenus({
    find: async (args) => {
      reads++;
      assert.deepEqual(args, {
        collection: 'places', where: { website: { exists: true } }, limit: 100, page: reads, depth: 0, overrideAccess: true,
        select: { slug: true, name: true, website: true, primaryCategory: true, featured: true, menus: true },
      });
      return { docs: reads === 1 ? [{ ...row(999), menus: [{ label: 'Existing' }] }, ...docs.slice(0, 100)] : docs.slice(100), hasNextPage: reads === 1 };
    },
    update: cannotWrite,
  }, false, {
    log,
    fetcher: async (url) => {
      assert.equal(reads, 2, 'Complete selection before requesting homepages');
      visited.push(String(url));
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active--;
      return html('');
    },
  });
  assert.equal(result.checked, 400);
  assert.equal(result.exitCode, 0);
  assert.equal(visited.length, 400);
  assert.equal(visited[0], row(405).website);
  assert.ok(!visited.includes(row(999).website));
  assert.ok(!visited.includes(row(404).website));
  assert.equal(peak, 8);
});

it('does not fetch or write when a later database selection page fails', async () => {
  await assert.rejects(enrichPlacesMenus({
    find: async ({ page }) => { if (page === 2) throw new Error('Read failed'); return { docs: [row(1)], hasNextPage: true }; },
    update: cannotWrite,
  }, true, { fetcher: async () => assert.fail('Selection must finish first') }), /Read failed/);
});

it('an empty selection succeeds without requests or writes', async () => {
  const { log } = logger();
  const result = await enrichPlacesMenus({ find: async () => ({ docs: [], hasNextPage: false }), update: cannotWrite }, false, {
    log, fetcher: async () => assert.fail('Nothing to fetch'),
  });
  assert.deepEqual(result, { found: 0, checked: 0, skipped: 0, requestFailures: 0, updated: 0, writeFailures: 0, exitCode: 0 });
});
