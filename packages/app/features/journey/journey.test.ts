import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createJourneyController, JourneyConflict, readLocalJourney, type JourneyStorage } from './controller.ts';
import { liveProgress, planFromWalk, storiesForStop, synopsisFromRoute, verifiedDestination } from './model.ts';
import { applyWalkCommand, type WalkCommand } from '@acme/widgets';
import type { PlaceRecord, StoryRecord, WalkRecord } from '../../content/records.ts';
import type { ContentResult, DetailResult } from '../../content/result.ts';
import type { NavigationState, NavigationFixState } from '../navigation/session/navigationStore.ts';
import { fixtureRoute, fixtureDestination } from '../navigation/testing/fixtures.ts';

const date = '2026-10-01T12:00:00.000Z';
const walk: WalkRecord = { id: 7, slug: 'harlem-history', title: 'Harlem history', summary: 'A sourced walk.', distanceMeters: 500, durationMinutes: 10, startDescription: 'Apollo', endDescription: 'Sylvia’s', images: [], updatedAt: date,
  stops: [{ position: 1, place: { id: 1, slug: 'apollo', name: 'Apollo' } }, { position: 2, place: { id: 2, slug: 'sylvias', name: 'Sylvia’s' } }], sources: [{ label: 'Archive', url: 'https://example.org/archive', accessedAt: date }] };
const place: PlaceRecord = { id: 1, slug: 'apollo', name: 'Apollo', kind: 'culture', lifecycle: 'open', locationAccuracy: 'verified', location: [-73.95, 40.8], locationSourceUrl: 'https://example.org/place', locationSourceReadAt: date, featured: true, images: [] };
function storage() { const values = new Map<string, string>(); return { values, getString: (key: string) => values.get(key), set: (key: string, value: string) => { values.set(key, value); }, remove: (key: string) => { values.delete(key); } } satisfies JourneyStorage & { values: Map<string,string> }; }
function readers() { return { getWalk: async () => ({ status: 'ok' as const, data: walk }), getPlace: async () => ({ status: 'ok' as const, data: place }), listStories: async () => ({ status: 'ok' as const, data: [] }) }; }
function request(controller: ReturnType<typeof createJourneyController>, type: 'pause' | 'resume' | 'stop' | 'confirm-stop', id: string = type): WalkCommand {
  const s = controller.getSnapshot().session!;
  const base = { schemaVersion: 1 as const, commandId: id, sessionId: s.sessionId, expectedRevision: s.revision };
  return type === 'confirm-stop' ? { ...base, type, confirmed: true, stopId: s.stopIds[s.completedStopIds.length]! } : type === 'stop' ? { ...base, type, confirmed: true } : { ...base, type };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('anonymous walk journey', () => {
  it('starts only from a current published sourced walk, with no account transport', async () => {
    const local = storage(); const c = createJourneyController({ readers: readers(), storage: local });
    await c.begin(walk.slug); await flush();
    assert.equal(c.getSnapshot().mode, 'local'); assert.equal(c.getSnapshot().session?.revision, 0);
    assert.equal(c.getSnapshot().place?.name, 'Apollo');
    const saved = local.values.get('anonymous-walk-v1')!;
    assert.ok(!saved.includes('longitude')); assert.ok(!saved.includes('location')); assert.ok(!saved.includes('token'));
  });
  it('rejects missing stops and unverified routing endpoints', () => {
    assert.throws(() => planFromWalk({ ...walk, stops: [{ position: 1 }] }));
    assert.throws(() => planFromWalk({ ...walk, sources: [] }));
    assert.ok(verifiedDestination(place));
    assert.equal(verifiedDestination({ ...place, locationAccuracy: 'approx' }), undefined);
    assert.equal(verifiedDestination({ ...place, locationSourceReadAt: '2020-01-01T00:00:00Z' }), undefined);
    assert.equal(verifiedDestination({ ...place, locationSourceReadAt: '2999-01-01' }), undefined);
    assert.equal(verifiedDestination(place)?.entrance, undefined);
  });
  it('deduplicates confirmations and rejects stale revision or wrong next stop', async () => {
    const c = createJourneyController({ readers: readers(), storage: storage() }); await c.begin(walk.slug);
    const confirm = request(c, 'confirm-stop');
    assert.equal(await c.dispatch(confirm), true); assert.equal(await c.dispatch(confirm), true);
    assert.equal(c.getSnapshot().session?.completedStopIds.length, 1);
    assert.equal(await c.dispatch({ ...confirm, commandId: 'stale' }), false);
    assert.equal(await c.dispatch(request(c, 'confirm-stop', 'second')), true);
    assert.equal(c.getSnapshot().session?.status, 'completed');
  });
  for (const outcome of ['success', 'failure'] as const) {
    it(`keeps completed walk content cleared after a delayed final-stop ${outcome}`, async () => {
      const finalPlace: PlaceRecord = { ...place, id: 2, slug: 'sylvias', name: 'Sylvia’s' };
      const finalStory: StoryRecord = { id: 2, slug: 'final-story', title: 'Final story', body: 'Sourced context.', author: 'Author', places: [{ id: 2, slug: 'sylvias', name: 'Sylvia’s' }], images: [], archive: [], sources: walk.sources, publishedAt: date, updatedAt: date };
      let finishPlace!: (result: DetailResult<PlaceRecord>) => void;
      let finishStories!: (result: ContentResult<StoryRecord[]>) => void;
      const pendingPlace = new Promise<DetailResult<PlaceRecord>>(resolve => { finishPlace = resolve; });
      const pendingStories = new Promise<ContentResult<StoryRecord[]>>(resolve => { finishStories = resolve; });
      const content = readers();
      let storyReads = 0;
      const c = createJourneyController({ storage: storage(), readers: {
        ...content,
        getPlace: slug => slug === finalPlace.slug ? pendingPlace : content.getPlace(),
        listStories: () => ++storyReads === 1 ? content.listStories() : pendingStories,
      } });
      await c.begin(walk.slug); await flush();
      assert.equal(c.getSnapshot().contentStatus, 'ready');
      assert.equal(await c.dispatch(request(c, 'confirm-stop', 'first')), true);
      assert.equal(c.getSnapshot().contentStatus, 'loading');
      assert.equal(storyReads, 2);
      assert.equal(await c.dispatch(request(c, 'confirm-stop', 'final')), true);
      const completed = c.getSnapshot();
      assert.equal(completed.session?.status, 'completed');
      assert.deepEqual(completed.session?.completedStopIds, ['1', '2']);
      assert.equal(completed.place, null);
      assert.deepEqual(completed.stories, []);
      assert.equal(completed.contentStatus, 'idle');

      const failure = { status: 'unavailable', reason: 'query-failed', error: new Error('Content unavailable') } as const;
      finishPlace(outcome === 'success' ? { status: 'ok', data: finalPlace } : failure);
      finishStories(outcome === 'success' ? { status: 'ok', data: [finalStory] } : failure);
      await flush();
      assert.equal(c.getSnapshot(), completed, 'late content must not update the completed journey');
    });
  }
  it('pause, resume and stop are explicit; stopped sessions cannot resume', async () => {
    const c = createJourneyController({ readers: readers(), storage: storage() }); await c.begin(walk.slug);
    await c.dispatch(request(c, 'pause')); assert.equal(c.getSnapshot().session?.status, 'paused');
    await c.dispatch(request(c, 'resume')); assert.equal(c.getSnapshot().session?.status, 'active');
    await c.dispatch(request(c, 'stop')); assert.equal(c.getSnapshot().session?.status, 'stopped');
    await c.dispatch(request(c, 'resume', 'late')); assert.equal(c.getSnapshot().session?.status, 'stopped');
  });
  it('restores only bounded local data and rejects expired or corrupt caches', async () => {
    const local = storage(); const c = createJourneyController({ readers: readers(), storage: local }); await c.begin(walk.slug);
    const raw = local.values.get('anonymous-walk-v1')!;
    assert.ok(readLocalJourney(raw)); assert.equal(readLocalJourney(raw, Date.now() + 8*86400000), undefined);
    assert.equal(readLocalJourney('{bad'), undefined);
    const restored = createJourneyController({ readers: readers(), storage: local }); restored.hydrate();
    assert.equal(restored.getSnapshot().session?.sessionId, c.getSnapshot().session?.sessionId);
  });
  it('persists a synopsis without coordinates, arrival or a live ETA', () => {
    const cached = synopsisFromRoute(fixtureRoute('apollo-theater--sylvias-restaurant'), '1');
    assert.ok(cached.instructions.length > 0);
    assert.deepEqual(Object.keys(cached).sort(), ['distanceM', 'durationS', 'generatedAt', 'instructions', 'schemaVersion', 'stopId']);
  });
  it('keeps browsing usable when private storage is unavailable', async () => {
    const c = createJourneyController({ readers: readers(), storage: { getString() { throw new Error(); }, set() { throw new Error(); }, remove() {} } });
    c.hydrate(); await c.begin(walk.slug);
    assert.ok(c.getSnapshot().session); assert.equal(c.getSnapshot().storageAvailable, false);
  });
  it('does not submit a member start after cancellation during auth', async () => {
    let resolve!: (v: 'member') => void; let sends = 0;
    const c = createJourneyController({ readers: readers(), storage: storage(), transport: { identity: () => new Promise(r => { resolve = r; }), send: async () => { sends++; throw new Error(); } } });
    const pending = c.begin(walk.slug); await flush(); c.clear(); resolve('member'); await pending;
    assert.equal(sends, 0); assert.equal(c.getSnapshot().session, null);
  });
  it('refresh during a member save cannot lose the committed result or leave busy stuck', async () => {
    let release!: () => void;
    let server: ReturnType<typeof applyWalkCommand> | null = null;
    const c = createJourneyController({ readers: readers(), storage: storage(), transport: { identity: async () => 'member', send: async command => {
      if (command.type !== 'start') await new Promise<void>(r => { release = r; });
      server = applyWalkCommand(server, command, new Date().toISOString(), { id: '7', slug: walk.slug, title: walk.title, stopIds: ['1','2'], published: true, sourceUrl: 'https://example.org' }); return server;
    } } });
    await c.begin(walk.slug); await flush();
    const pending = c.dispatch(request(c, 'pause')); await flush(); await c.refresh(); release(); await pending;
    assert.equal(c.getSnapshot().busy, false); assert.equal(c.getSnapshot().session?.status, 'paused');
  });
  it('reuses the same start command after an uncertain member response', async () => {
    const commands: WalkCommand[] = []; let server: ReturnType<typeof applyWalkCommand> | null = null;
    const c = createJourneyController({ readers: readers(), storage: storage(), transport: { identity: async () => 'member', send: async command => {
      commands.push(command); server = applyWalkCommand(server, command, new Date().toISOString(), { id: '7', slug: walk.slug, title: walk.title, stopIds: ['1','2'], published: true, sourceUrl: 'https://example.org' });
      if (commands.length === 1) throw new Error('Response lost'); return server;
    } } });
    await c.begin(walk.slug); assert.equal(c.getSnapshot().session, null);
    await c.begin(walk.slug); assert.ok(c.getSnapshot().session);
    assert.deepEqual(commands[1], commands[0]);
  });
  it('uses a new attempt after a definitive published-plan mismatch', async () => {
    const commands: WalkCommand[] = [];
    const c = createJourneyController({ readers: readers(), storage: storage(), transport: { identity: async () => 'member', send: async command => {
      commands.push(command); return applyWalkCommand(null, command, new Date().toISOString(), { id: '7', slug: walk.slug, title: commands.length === 1 ? 'Changed title' : walk.title, stopIds: ['1','2'], published: true, sourceUrl: 'https://example.org' });
    } } });
    await c.begin(walk.slug); assert.match(c.getSnapshot().error!, /published walk changed/);
    await c.begin(walk.slug); assert.ok(c.getSnapshot().session);
    assert.notEqual(commands[1]?.commandId, commands[0]?.commandId);
  });
  it('adopts a conflict but requires fresh user intent rather than replaying', async () => {
    let server: ReturnType<typeof applyWalkCommand> | null = null; let sends = 0;
    const c = createJourneyController({ readers: readers(), storage: storage(), transport: { identity: async () => 'member', send: async command => {
      sends++;
      if (server) throw new JourneyConflict({ ...server, revision: 2, status: 'paused' });
      server = applyWalkCommand(null, command, new Date().toISOString(), { id: '7', slug: walk.slug, title: walk.title, stopIds: ['1','2'], published: true, sourceUrl: 'https://example.org' }); return server;
    } } });
    await c.begin(walk.slug); await c.dispatch(request(c, 'pause'));
    assert.equal(sends, 2); assert.equal(c.getSnapshot().session?.revision, 2); assert.match(c.getSnapshot().error!, /changed/);
  });
});

describe('story publication and sourcing gate', () => {
  const story: StoryRecord = { id: 1, slug: 'story', title: 'Story', body: 'Sourced cultural context.', author: 'Author', places: [{ id: 1, slug: 'apollo', name: 'Apollo' }], images: [], archive: [], sources: walk.sources, publishedAt: date, updatedAt: date };
  it('rejects absent publication, future source read and unrelated places', () => {
    assert.equal(storiesForStop([story], '1').length, 1);
    assert.equal(storiesForStop([{ ...story, publishedAt: undefined }], '1').length, 0);
    assert.equal(storiesForStop([{ ...story, sources: [{ label: 'x', url: 'https://example.org', accessedAt: '2999-01-01' }] }], '1').length, 0);
    assert.equal(storiesForStop([story], '2').length, 0);
  });
  it('does not project unlicensed archive/audio into journey context', () => {
    assert.deepEqual(storiesForStop([{ ...story, archive: [{ url: 'https://example.org/a.jpg', alt: '', credit: '', rights: 'owned' }] }], '1')[0]?.archive, []);
  });
});

describe('truthful live guidance', () => {
  it('suppresses live estimates for stale GPS, wrong way, paused, offline and unmatched input', () => {
    const now = Date.now(); const route = fixtureRoute('apollo-theater--sylvias-restaurant');
    const state = { session: { phase: 'navigating', origin: { kind: 'device-location' }, destination: fixtureDestination('apollo-theater--sylvias-restaurant', false), mode: 'walking', activeRoute: { route, generation: 1, receivedAtMs: now }, deviation: { kind: 'on-route' }, arrival: { kind: 'en-route', distanceM: 100 }, reroute: { kind: 'idle' } }, positioning: { kind: 'tracking', confidence: 'high', sigmaM: 3, isMovingTooFast: false }, progress: { kind: 'tracking', progress: { routeId: route.id, timestampMs: now } }, routeLoading: { kind: 'idle' }, arTracking: { kind: 'off' } } as NavigationState;
    const fixes = { lastFix: { kind: 'accepted', fix: { source: 'device-gps', timestampMs: now } }, match: { kind: 'matched' } } as NavigationFixState;
    assert.equal(liveProgress(state, fixes, now, true, 'other-place', 'granted'), undefined);
    assert.equal(liveProgress(state, fixes, now, true, 'sylvias-restaurant', 'denied'), undefined);
    assert.ok(liveProgress(state, fixes, now, true, state.session.phase === 'navigating' ? state.session.destination.placeId! : '', 'granted'));
    assert.equal(liveProgress(state, fixes, now + 120000, true, 'sylvias-restaurant', 'granted'), undefined);
    assert.equal(liveProgress(state, fixes, now, false, 'sylvias-restaurant', 'granted'), undefined);
    assert.equal(liveProgress({ ...state, session: { ...state.session, phase: 'paused' } } as NavigationState, fixes, now, true, state.session.phase === 'navigating' ? state.session.destination.placeId! : '', 'granted'), undefined);
    assert.equal(liveProgress({ ...state, session: { ...state.session, deviation: { kind: 'wrong-direction' } } } as NavigationState, fixes, now, true, state.session.phase === 'navigating' ? state.session.destination.placeId! : '', 'granted'), undefined);
    assert.equal(liveProgress(state, { ...fixes, match: undefined }, now, true, state.session.phase === 'navigating' ? state.session.destination.placeId! : '', 'granted'), undefined);
  });
});
