import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import type { ContentReaders } from '../../content/readers.ts';
import type { WalkRecord } from '../../content/records.ts';
import { createJourneyController, readLocalJourney, type JourneyStorage } from './controller.ts';
import { synopsisFromRoute } from './model.ts';
import { fixtureRoute } from '../navigation/testing/fixtures.ts';

const NOW = Date.parse('2020-01-01T00:00:00.000Z');
const CACHE_KEY = 'anonymous-walk-v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const walk: WalkRecord = {
  id: 7, slug: 'harlem-history', title: 'Harlem history', summary: 'A sourced walk.',
  distanceMeters: 500, durationMinutes: 10, startDescription: 'Apollo', endDescription: 'Sylvia’s',
  images: [], updatedAt: '2019-12-01T12:00:00.000Z',
  stops: [
    { position: 1, place: { id: 1, slug: 'apollo', name: 'Apollo' }, note: 'First stop' },
    { position: 2, place: { id: 2, slug: 'sylvias', name: 'Sylvia’s' }, note: 'Second stop' },
  ],
  sources: [{ label: 'Archive', url: 'https://example.org/archive', accessedAt: '2019-12-01' }],
};
function storage() {
  const values = new Map<string, string>();
  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => { values.set(key, value); },
    remove: (key: string) => { values.delete(key); },
  } satisfies JourneyStorage;
}
function readers(record = walk): Pick<ContentReaders, 'getWalk' | 'getPlace' | 'listStories'> {
  return {
    getWalk: async () => ({ status: 'ok', data: record }),
    getPlace: async () => ({ status: 'unavailable', reason: 'not-configured' }),
    listStories: async () => ({ status: 'unavailable', reason: 'not-configured' }),
  };
}
async function savedJourney(record = walk) {
  const local = storage();
  const controller = createJourneyController({ readers: readers(record), storage: local });
  await controller.begin(record.slug);
  const session = controller.getSnapshot().session;
  assert.ok(session);
  assert.equal(await controller.dispatch({ schemaVersion: 1, commandId: 'first', sessionId: session.sessionId,
    expectedRevision: session.revision, type: 'confirm-stop', stopId: '1', confirmed: true }), true);
  controller.cacheRoute(synopsisFromRoute(fixtureRoute('apollo-theater--sylvias-restaurant'), '2'));
  const raw = local.getString(CACHE_KEY);
  assert.ok(raw);
  return { local, controller, raw };
}
const malformedDates: { name: string; value: unknown }[] = [
  { name: 'missing', value: undefined },
  { name: 'null', value: null },
  // Date.parse(2020) is a valid date at NOW; new Date(2020) means 1970 instead.
  { name: 'coercible number', value: 2020 },
  { name: 'timestamp number', value: NOW },
  { name: 'boolean', value: true },
  { name: 'empty array', value: [] },
  { name: 'coercible array', value: ['2020-01-01T00:00:00.000Z'] },
  { name: 'object', value: {} },
  { name: 'empty string', value: '' },
  { name: 'invalid string', value: 'not-a-date' },
];

describe('journey cache dates', () => {
  beforeEach(() => { mock.timers.enable({ apis: ['Date'], now: NOW }); });
  afterEach(() => { mock.timers.reset(); });

  for (const { name, value } of malformedDates) {
    for (const field of ['updatedAt', 'savedAt'] as const) {
      it(`rejects ${name} ${field} without restoring a partial journey`, async () => {
        const { raw } = await savedJourney();
        const cache = JSON.parse(raw);
        if (field === 'updatedAt') cache.plan.updatedAt = value;
        else cache.savedAt = value;
        assert.equal(readLocalJourney(JSON.stringify(cache), NOW), undefined);
      });
    }
    it(`drops ${name} synopsis generatedAt while preserving the walk and cursor`, async () => {
      const { raw, controller } = await savedJourney();
      const cache = JSON.parse(raw);
      cache.synopsis.generatedAt = value;
      const restored = readLocalJourney(JSON.stringify(cache), NOW);
      assert.ok(restored);
      assert.deepEqual(restored.plan, controller.getSnapshot().plan);
      assert.deepEqual(restored.session, controller.getSnapshot().session);
      assert.equal(restored.synopsis, null);
    });
  }

  for (const updatedAt of ['2019-12-01', '2019-12-01T08:00:00-04:00', walk.updatedAt]) {
    it(`round-trips the supported plan date ${updatedAt} through real save and hydrate`, async () => {
      const { local, controller, raw } = await savedJourney({ ...walk, updatedAt });
      const expected = controller.getSnapshot();
      assert.deepEqual(readLocalJourney(raw, NOW), { plan: expected.plan, session: expected.session, synopsis: expected.synopsis });
      const requestedStops: string[] = [];
      const content = readers();
      const restored = createJourneyController({ storage: local, readers: {
        ...content, getPlace: async slug => { requestedStops.push(slug); return content.getPlace(slug); },
      } });
      restored.hydrate();
      await restored.refresh();
      assert.deepEqual(restored.getSnapshot().plan, expected.plan);
      assert.deepEqual(restored.getSnapshot().session, expected.session);
      assert.deepEqual(restored.getSnapshot().synopsis, expected.synopsis);
      assert.equal(restored.getSnapshot().mode, 'local');
      assert.equal(restored.getSnapshot().contentStatus, 'offline');
      assert.ok(requestedStops.length > 0);
      assert.ok(requestedStops.every(slug => slug === 'sylvias'));
      // Old publication dates remain restorable; only savedAt governs cache age.
      assert.ok(NOW - Date.parse(updatedAt) > MAX_AGE_MS);
    });
  }

  it('retains parseable string dates in the existing savedAt and synopsis contracts', async () => {
    const { raw } = await savedJourney();
    for (const date of ['2020-01-01', '2019-12-31T19:00:00-05:00']) {
      const cache = JSON.parse(raw);
      cache.savedAt = date;
      cache.synopsis.generatedAt = date;
      const restored = readLocalJourney(JSON.stringify(cache), NOW);
      assert.ok(restored);
      assert.equal(restored.synopsis?.generatedAt, date);
    }
  });

  it('rejects a future plan date, matching the published-plan contract', async () => {
    const { raw } = await savedJourney();
    const cache = JSON.parse(raw);
    cache.plan.updatedAt = new Date(NOW + 1).toISOString();
    assert.equal(readLocalJourney(JSON.stringify(cache), NOW), undefined);
  });

  it('keeps the savedAt TTL inclusive, rejects future saves and leaves old plans alone', async () => {
    const { raw } = await savedJourney();
    assert.ok(readLocalJourney(raw, NOW));
    assert.ok(readLocalJourney(raw, NOW + MAX_AGE_MS));
    assert.equal(readLocalJourney(raw, NOW + MAX_AGE_MS + 1), undefined);
    assert.equal(readLocalJourney(raw, NOW - 1), undefined);
  });

  it('hydrates a valid walk with an invalid optional synopsis and can save a fresh synopsis', async () => {
    const { local, raw, controller } = await savedJourney();
    const cache = JSON.parse(raw);
    cache.synopsis.generatedAt = 2020;
    local.set(CACHE_KEY, JSON.stringify(cache));
    const restored = createJourneyController({ storage: local, readers: readers() });
    restored.hydrate();
    await restored.refresh();
    assert.deepEqual(restored.getSnapshot().session, controller.getSnapshot().session);
    assert.equal(restored.getSnapshot().contentStatus, 'offline');
    assert.equal(restored.getSnapshot().synopsis, null);
    const fresh = synopsisFromRoute(fixtureRoute('apollo-theater--sylvias-restaurant'), '2', NOW + 1);
    restored.cacheRoute(fresh);
    assert.deepEqual(readLocalJourney(local.getString(CACHE_KEY), NOW)?.synopsis, fresh);
  });

  it('falls back to an empty journey after an invalid required date, then allows a fresh start', async () => {
    const { local, raw } = await savedJourney();
    const cache = JSON.parse(raw);
    delete cache.plan.updatedAt;
    local.set(CACHE_KEY, JSON.stringify(cache));
    const restored = createJourneyController({ storage: local, readers: readers() });
    restored.hydrate();
    assert.equal(restored.getSnapshot().plan, null);
    assert.equal(restored.getSnapshot().session, null);
    assert.equal(restored.getSnapshot().synopsis, null);
    assert.equal(restored.getSnapshot().mode, null);
    await restored.begin(walk.slug);
    assert.ok(restored.getSnapshot().session);
    assert.ok(readLocalJourney(local.getString(CACHE_KEY), NOW));
  });
});
