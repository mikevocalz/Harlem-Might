import assert from 'node:assert/strict';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, it, mock } from 'node:test';
import { seedStoryLeadImages } from './seed-story-lead-images-runner.ts';

beforeEach(() => {
  mock.method(globalThis, 'fetch', () => { throw new Error('Live network access is forbidden in runner tests'); });
});
afterEach(() => { mock.restoreAll(); });

type Payload = Parameters<typeof seedStoryLeadImages>[0];
type Dependencies = NonNullable<Parameters<typeof seedStoryLeadImages>[2]>;
type Story = { id: number; slug: string; images?: (number | { id: number })[] | null; sources?: { url?: string | null }[] | null };
const story = (id: number, changes: Partial<Story> = {}): Story => ({
  id, slug: `story-${id}`, sources: [{ url: `https://en.wikipedia.org/wiki/Story_${id}` }], ...changes,
});
const file = (id: number) => `Portrait_${id}.jpg`;
const sourceUrl = (id: number) => `https://commons.wikimedia.org/wiki/File:${file(id)}`;
const imageUrl = (id: number) => `https://images.example/${file(id)}`;
const imageInfo = (id: number) => ({
  url: `https://images.example/original-${id}.jpg`, thumburl: imageUrl(id), mime: 'image/jpeg', descriptionurl: sourceUrl(id),
  extmetadata: {
    LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    ImageDescription: { value: `<b>Portrait ${id}</b> &amp; surroundings` }, Artist: { value: '<a>Artist</a>' },
    Credit: { value: '<i>Archive</i>' }, Attribution: { value: 'Archive &quot;Portrait&quot;' }, DateTimeOriginal: { value: '1920' },
  },
});

function fixture(stories: Story[]) {
  const info: string[] = [];
  const warnings: unknown[][] = [];
  const downloads: string[] = [];
  const metadataRequests: string[] = [];
  const waits: number[] = [];
  const removed: unknown[] = [];
  const written: { filePath: string; data: Uint8Array }[] = [];
  const created: Parameters<Payload['create']>[0][] = [];
  const updated: Parameters<Payload['update']>[0][] = [];
  const existing = new Map<string, number>();
  const articleFiles = new Map<number, string | undefined>();
  const commons = new Map<string, unknown>();
  const directory = '/controlled/story-leads';
  let selected = 0;
  let temporaryDirectories = 0;
  const payload: Payload = {
    find: async (args) => {
      if (args.collection === 'stories') {
        selected++;
        assert.deepEqual(args, { collection: 'stories', limit: 200, depth: 0, pagination: false, overrideAccess: true });
        return { docs: stories };
      }
      assert.equal(args.limit, 1);
      assert.equal(args.depth, 0);
      assert.equal(args.overrideAccess, true);
      const id = existing.get(args.where.sourceUrl.equals!);
      return { docs: id === undefined ? [] : [story(id)] };
    },
    create: async (args) => { created.push(args); return { id: 100 + created.length }; },
    update: async (args) => { updated.push(args); },
  };
  const dependencies: Dependencies = {
    wait: async (ms) => { waits.push(ms); },
    log: { info: (message) => { info.push(message); }, warn: (...args) => { warnings.push(args); } },
    json: async <T>(input: string, headers: Record<string, string>): Promise<T> => {
      metadataRequests.push(input);
      assert.ok(headers['User-Agent']);
      const url = new URL(input);
      assert.equal(url.searchParams.get('action'), 'query');
      assert.equal(url.searchParams.get('format'), 'json');
      const title = url.searchParams.get('titles')!;
      if (url.hostname === 'en.wikipedia.org') {
        const id = Number(title.replace('Story_', ''));
        assert.equal(url.searchParams.get('prop'), 'pageimages');
        return { query: { pages: { '1': { pageimage: articleFiles.has(id) ? articleFiles.get(id) : file(id) } } } } as T;
      }
      assert.equal(url.hostname, 'commons.wikimedia.org');
      assert.equal(url.searchParams.get('iiurlwidth'), '1600');
      const filename = title.replace('File:', '');
      const id = Number(filename.replace('Portrait_', '').replace('.jpg', ''));
      const record = commons.has(filename) ? commons.get(filename) : imageInfo(id);
      return { query: { pages: { '1': { imageinfo: record ? [record] : undefined } } } } as T;
    },
    fetcher: async (input, options) => {
      downloads.push(String(input));
      assert.ok(new Headers(options?.headers).get('User-Agent'));
      assert.ok(options?.signal instanceof AbortSignal);
      return new Response('image bytes');
    },
    files: {
      mkdtemp: async (prefix) => { temporaryDirectories++; assert.match(prefix, /harlem-story-leads-$/); return directory; },
      writeFile: async (filePath, data) => { written.push({ filePath, data }); },
      rm: async (...args) => { removed.push(args); },
    },
  };
  return {
    payload, dependencies, info, warnings, downloads, metadataRequests, waits, removed, written, created, updated,
    existing, articleFiles, commons, directory,
    get selected() { return selected; }, get temporaryDirectories() { return temporaryDirectories; },
  };
}


it('imports the production runner without loading Payload, config or executing a command', async (t) => {
  t.mock.method(process, 'exit', () => assert.fail('Importing the runner cannot exit'));
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      assert.notEqual(specifier, 'payload', 'Runner must not initialize Payload');
      assert.ok(!specifier.includes('payload.config'), 'Runner must not load live configuration');
      return nextResolve(specifier, context);
    },
  });
  try {
    const module = await import(new URL('./seed-story-lead-images-runner.ts?import-safe', import.meta.url).href);
    assert.equal(typeof module.seedStoryLeadImages, 'function');
  } finally {
    hook.deregister();
  }
});

it('reports the original failed-HTTP download as nonzero instead of successful completion', async () => {
  const state = fixture([story(1)]);
  state.dependencies.fetcher = async () => new Response('Unavailable', { status: 503 });
  const result = await seedStoryLeadImages(state.payload, true, state.dependencies);
  assert.deepEqual(result, { downloadFailures: 1, exitCode: 1 });
  assert.equal(state.written.length, 0);
  assert.equal(state.created.length, 0);
  assert.equal(state.updated.length, 0);
  assert.match(state.warnings.flat().join(' '), /story-1.*503/);
  assert.match(state.info.join('\n'), /1 downloads failed/);
  assert.deepEqual(state.removed, [[state.directory, { recursive: true, force: true }]]);
});

it('retains successful and reused images after independent HTTP failures in one batch', async () => {
  const state = fixture([story(1), story(2), story(3), story(4, { images: [{ id: 7 }, 88, 8, 88] })]);
  state.existing.set(sourceUrl(4), 88);
  const successfulFetch = state.dependencies.fetcher!;
  state.dependencies.fetcher = async (input, options) => {
    if (input === imageUrl(1)) return new Response('Unavailable', { status: 503 });
    if (input === imageUrl(3)) return new Response('Missing', { status: 404 });
    return successfulFetch(input, options);
  };
  assert.deepEqual(await seedStoryLeadImages(state.payload, true, state.dependencies), { downloadFailures: 2, exitCode: 1 });
  assert.equal(state.selected, 1);
  assert.deepEqual(state.waits, [1_500, 1_500, 1_500, 1_500]);
  assert.deepEqual(state.downloads, [imageUrl(2)]);
  assert.equal(state.created.length, 1);
  assert.deepEqual(state.updated.map(({ id, data }) => ({ id, images: data.images })), [
    { id: 2, images: [101] }, { id: 4, images: [88, 7, 8] },
  ]);
  assert.equal(state.warnings.length, 2);
  assert.match(state.warnings.flat().join(' '), /story-1.*503.*story-3.*404/);
  assert.match(state.info.join('\n'), /2 downloads failed/);
  assert.deepEqual(state.removed, [[state.directory, { recursive: true, force: true }]]);
});

it('succeeds for all downloads with the original image bytes, attribution and attachment order', async (t) => {
  const deadlines: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (ms: number) => { deadlines.push(ms); return new AbortController().signal; });
  const state = fixture([story(1, { images: [8, { id: 9 }] }), story(2)]);
  assert.deepEqual(await seedStoryLeadImages(state.payload, true, state.dependencies), { downloadFailures: 0, exitCode: 0 });
  assert.deepEqual(state.downloads, [imageUrl(1), imageUrl(2)]);
  assert.deepEqual(deadlines, [120_000, 120_000]);
  assert.deepEqual(state.updated, [
    { collection: 'stories', id: 1, overrideAccess: true, data: { images: [101, 8, 9] } },
    { collection: 'stories', id: 2, overrideAccess: true, data: { images: [102] } },
  ]);
  for (const [index, created] of state.created.entries()) {
    const id = index + 1;
    const expectedFilePath = path.join(state.directory, `story-lead-${file(id)}`);
    assert.equal(created.filePath, expectedFilePath);
    assert.equal(created.collection, 'media');
    assert.equal(created.overrideAccess, true);
    assert.deepEqual(created.data, {
      alt: `Portrait ${id} & surroundings`, source: 'wikimedia_commons', sourceUrl: sourceUrl(id),
      license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      creator: 'Artist', credit: 'Archive', attributionText: 'Archive "Portrait"', capturedAt: '1920',
      shareAlike: true, noDerivatives: false, role: 'hero', ingestedAt: created.data.ingestedAt,
    });
    assert.ok(Number.isFinite(Date.parse(created.data.ingestedAt)));
    assert.deepEqual(state.written[index], { filePath: expectedFilePath, data: Buffer.from('image bytes') });
  }
  assert.equal(state.warnings.length, 0);
  assert.equal(state.temporaryDirectories, 1);
  assert.deepEqual(state.removed, [[state.directory, { recursive: true, force: true }]]);
});

it('keeps preview read-only even for images whose download would fail', async () => {
  const state = fixture([story(1), story(2, { images: [8, 88] }), story(3)]);
  state.existing.set(sourceUrl(2), 88);
  state.dependencies.fetcher = async () => assert.fail('Preview cannot download');
  state.dependencies.files!.writeFile = async () => assert.fail('Preview cannot write files');
  state.payload.create = async () => assert.fail('Preview cannot create media');
  state.payload.update = async () => assert.fail('Preview cannot update stories');
  assert.deepEqual(await seedStoryLeadImages(state.payload, false, state.dependencies), { downloadFailures: 0, exitCode: 0 });
  assert.equal(state.metadataRequests.length, 6);
  assert.equal(state.info.filter((line) => line.startsWith('plan')).length, 3);
  assert.match(state.info.join('\n'), /Preview only; pass --apply/);
  assert.equal(state.warnings.length, 0);
  assert.deepEqual(state.removed, [[state.directory, { recursive: true, force: true }]]);
});

for (const apply of [false, true]) {
  it(`does not count deliberate skips as failures in ${apply ? 'apply' : 'preview'} mode`, async () => {
    const state = fixture([
      story(1, { sources: null }), story(2), story(3), story(4), story(5), story(6), story(7), story(8),
      story(9, { images: [{ id: 99 }, 8] }),
    ]);
    state.articleFiles.set(2, undefined);
    state.articleFiles.set(3, 'Building_logo.png');
    state.articleFiles.set(4, 'Building.svg');
    state.commons.set(file(5), undefined);
    const copyright = imageInfo(6);
    copyright.extmetadata.LicenseShortName.value = 'All rights reserved';
    state.commons.set(file(6), copyright);
    state.commons.set(file(7), { ...imageInfo(7), mime: 'image/gif' });
    const logo = imageInfo(8);
    logo.extmetadata.ImageDescription.value = '<b>Official seal</b>';
    state.commons.set(file(8), logo);
    state.existing.set(sourceUrl(9), 99);
    state.dependencies.fetcher = async () => assert.fail('Skipped stories cannot download');
    assert.deepEqual(await seedStoryLeadImages(state.payload, apply, state.dependencies), { downloadFailures: 0, exitCode: 0 });
    assert.equal(state.created.length, 0);
    assert.equal(state.updated.length, 0);
    assert.equal(state.written.length, 0);
    assert.equal(state.info.filter((line) => line.startsWith('skip')).length, 8);
    assert.match(state.info.join('\n'), /ok   story-9: already leads with/);
    assert.equal(state.warnings.length, 0);
    assert.equal(state.waits.length, 8);
    assert.deepEqual(state.removed, [[state.directory, { recursive: true, force: true }]]);
  });
}

it('preserves public-domain attribution fallbacks and original-image selection', async () => {
  const state = fixture([story(1)]);
  state.commons.set(file(1), {
    url: imageUrl(1), mime: 'image/jpeg', descriptionurl: sourceUrl(1),
    extmetadata: { LicenseShortName: { value: 'Public domain' } },
  });
  assert.deepEqual(await seedStoryLeadImages(state.payload, true, state.dependencies), { downloadFailures: 0, exitCode: 0 });
  assert.deepEqual(state.downloads, [imageUrl(1)]);
  assert.deepEqual(state.created[0]!.data, {
    alt: 'Portrait 1', source: 'wikimedia_commons', sourceUrl: sourceUrl(1), license: 'Public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', creator: undefined,
    credit: 'Wikimedia Commons', attributionText: 'Portrait 1, Public domain, via Wikimedia Commons', capturedAt: undefined,
    shareAlike: false, noDerivatives: false, role: 'hero', ingestedAt: state.created[0]!.data.ingestedAt,
  });
});

for (const [name, failingDownload] of [
  ['transport', async () => { throw new TypeError('Network failed'); }],
  ['timeout', async () => { throw new DOMException('Timed out', 'TimeoutError'); }],
  ['response-body', async () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('Body failed')); } }))],
] as const) {
  it(`counts a ${name} download failure and continues with the next story`, async () => {
    const state = fixture([story(1), story(2)]);
    const successfulFetch = state.dependencies.fetcher!;
    state.dependencies.fetcher = async (input, options) => input === imageUrl(1) ? failingDownload() : successfulFetch(input, options);
    assert.deepEqual(await seedStoryLeadImages(state.payload, true, state.dependencies), { downloadFailures: 1, exitCode: 1 });
    assert.deepEqual(state.updated.map(({ id }) => id), [2]);
    assert.equal(state.created.length, 1);
    assert.equal(state.written.length, 1);
    assert.match(state.warnings.flat().join(' '), /story-1/);
    assert.deepEqual(state.removed, [[state.directory, { recursive: true, force: true }]]);
  });
}

for (const stage of ['metadata', 'media lookup', 'file write', 'media create', 'story update'] as const) {
  it(`propagates a fatal ${stage} error and still cleans up the temporary directory`, async () => {
    const state = fixture([story(1), story(2)]);
    const failure = new Error(`${stage} failed`);
    if (stage === 'metadata') state.dependencies.json = async () => { throw failure; };
    if (stage === 'media lookup') {
      const find = state.payload.find;
      state.payload.find = async (args) => {
        if (args.collection === 'media') throw failure;
        return find(args);
      };
    }
    if (stage === 'file write') state.dependencies.files!.writeFile = async () => { throw failure; };
    if (stage === 'media create') state.payload.create = async () => { throw failure; };
    if (stage === 'story update') state.payload.update = async () => { throw failure; };
    await assert.rejects(seedStoryLeadImages(state.payload, true, state.dependencies), (error) => error === failure);
    assert.deepEqual(state.removed, [[state.directory, { recursive: true, force: true }]]);
    assert.equal(state.warnings.length, 0, 'Fatal errors must not be reported as download failures');
    assert.equal(state.info.filter((line) => line.includes('downloads failed')).length, 0, 'No successful completion summary on rejection');
    assert.ok(!state.downloads.includes(imageUrl(2)));
  });
}

it('propagates a cleanup error instead of returning a successful outcome', async () => {
  const state = fixture([story(1)]);
  const failure = new Error('Cleanup failed');
  state.dependencies.files!.rm = async () => { throw failure; };
  await assert.rejects(seedStoryLeadImages(state.payload, true, state.dependencies), (error) => error === failure);
  assert.deepEqual(state.updated.map(({ id }) => id), [1]);
  assert.equal(state.info.filter((line) => line.includes('downloads failed')).length, 0);
});

it('does not create a temporary directory or perform network I/O when story selection fails', async () => {
  const state = fixture([story(1)]);
  state.payload.find = async () => { throw new Error('Selection failed'); };
  await assert.rejects(seedStoryLeadImages(state.payload, true, state.dependencies), /Selection failed/);
  assert.equal(state.temporaryDirectories, 0);
  assert.deepEqual(state.removed, []);
  assert.deepEqual(state.metadataRequests, []);
  assert.deepEqual(state.downloads, []);
});

it('does not perform network I/O or attempt cleanup when temporary-directory creation fails', async () => {
  const state = fixture([story(1)]);
  state.dependencies.files!.mkdtemp = async () => { throw new Error('Directory failed'); };
  await assert.rejects(seedStoryLeadImages(state.payload, true, state.dependencies), /Directory failed/);
  assert.deepEqual(state.removed, []);
  assert.deepEqual(state.metadataRequests, []);
  assert.deepEqual(state.downloads, []);
});

it('succeeds for an empty selection without requests, files or Payload writes', async () => {
  const state = fixture([]);
  assert.deepEqual(await seedStoryLeadImages(state.payload, true, state.dependencies), { downloadFailures: 0, exitCode: 0 });
  assert.deepEqual(state.metadataRequests, []);
  assert.deepEqual(state.downloads, []);
  assert.deepEqual(state.written, []);
  assert.deepEqual(state.created, []);
  assert.deepEqual(state.updated, []);
  assert.deepEqual(state.removed, [[state.directory, { recursive: true, force: true }]]);
});
