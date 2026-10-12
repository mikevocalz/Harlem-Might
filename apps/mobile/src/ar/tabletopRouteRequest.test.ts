import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { useArSession } from './arSession.store.ts';
import { startTabletopRouteRequest } from './tabletopRouteRequest.ts';
import { tabletopRouteUnavailableMessage } from './tabletopRouteMessage.ts';
import type { fetchWalkingRoute, WalkingRoute } from './walkingRoute.ts';

const from = { id: 'origin', lngLat: [-73.95, 40.81] as const };
const to = [{ id: 'destination', lngLat: [-73.94, 40.80] as const }];
const route: WalkingRoute = {
  kind: 'straight', routeId: 'test-route', reason: 'no-token', coordinates: [],
};
const input = { placeId: from.id, from, to, accessToken: undefined };
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const start = (fetchRoute: typeof fetchWalkingRoute, overrides: Partial<typeof input> = {}) =>
  startTabletopRouteRequest({ ...input, ...overrides }, { getSession: useArSession.getState, fetchRoute });

describe('tabletop route request ownership', () => {
  beforeEach(() => useArSession.getState().reset());

  it('ends an empty catalogue without entering loading or calling Directions', () => {
    useArSession.getState().setRoute(route);
    useArSession.getState().setPlayheadM(40);
    const states: string[] = [];
    const unsubscribe = useArSession.subscribe((s) => states.push(s.route.status));
    const cleanup = start(async () => { assert.fail('An empty route must not be requested'); }, { to: [] });
    assert.deepEqual(states, ['unavailable']);
    assert.deepEqual(useArSession.getState().route, { status: 'unavailable', reason: 'no-destinations' });
    assert.equal(useArSession.getState().playheadM, 0);
    cleanup();
    unsubscribe();
  });

  it('clears old route state for an absent or unmapped origin', () => {
    const fetchRoute = async () => { assert.fail('There is no origin'); };
    for (const from of [null, { id: 'unmapped' }]) {
      startTabletopRouteRequest({ ...input, from }, { getSession: useArSession.getState, fetchRoute });
      assert.deepEqual(useArSession.getState().route, { status: 'unavailable', reason: 'missing-origin' });
    }
    startTabletopRouteRequest({ ...input, placeId: undefined }, { getSession: useArSession.getState, fetchRoute });
    assert.deepEqual(useArSession.getState().route, { status: 'idle' });
  });

  it('publishes a current result and resets its playhead', async () => {
    const pending = Promise.withResolvers<WalkingRoute>();
    const cleanup = start(() => pending.promise);
    assert.equal(useArSession.getState().route.status, 'loading');
    useArSession.getState().setPlayheadM(5);
    pending.resolve(route);
    await settle();
    assert.deepEqual(useArSession.getState().route, { status: 'ready', route });
    assert.equal(useArSession.getState().playheadM, 0);
    cleanup();
    assert.equal(useArSession.getState().route.status, 'ready');
  });

  for (const synchronous of [false, true]) {
    it(`owns ${synchronous ? 'synchronous throws' : 'rejections'} and allows a later request`, async () => {
      start(() => {
        if (synchronous) throw new Error('private upstream details');
        return Promise.reject(new Error('private upstream details'));
      });
      await settle();
      assert.deepEqual(useArSession.getState().route, { status: 'unavailable', reason: 'request-failed' });
      assert.equal(tabletopRouteUnavailableMessage(useArSession.getState().route), 'The walking route could not be loaded');
      start(async () => route);
      await settle();
      assert.equal(useArSession.getState().route.status, 'ready');
    });
  }

  for (const outcome of ['resolve', 'reject'] as const) {
    it(`ignores a cancelled request's late ${outcome}`, async () => {
      const pending = Promise.withResolvers<WalkingRoute>();
      let signal: AbortSignal | undefined;
      const cleanup = start((request) => { signal = request.signal; return pending.promise; });
      cleanup();
      assert.equal(signal?.aborted, true);
      assert.deepEqual(useArSession.getState().route, { status: 'idle' });
      if (outcome === 'resolve') pending.resolve(route);
      else pending.reject(new Error('Cancelled'));
      await settle();
      assert.deepEqual(useArSession.getState().route, { status: 'idle' });
    });
  }

  for (const outcome of ['resolve', 'reject'] as const) {
    it(`does not overwrite a newer route on a late ${outcome}`, async () => {
      const older = Promise.withResolvers<WalkingRoute>();
      const newer = Promise.withResolvers<WalkingRoute>();
      const cleanupOlder = start(() => older.promise);
      const cleanupNewer = start(() => newer.promise);
      cleanupOlder();
      assert.equal(useArSession.getState().route.status, 'loading');
      if (outcome === 'resolve') older.resolve(route);
      else older.reject(new Error('Late failure'));
      await settle();
      assert.equal(useArSession.getState().route.status, 'loading');
      const newRoute = { ...route, routeId: 'new-route' };
      newer.resolve(newRoute);
      await settle();
      assert.deepEqual(useArSession.getState().route, { status: 'ready', route: newRoute });
      cleanupNewer();
    });
  }

  it('cannot resurrect a route after a session reset, even before effect cleanup', async () => {
    const pending = Promise.withResolvers<WalkingRoute>();
    const cleanup = start(() => pending.promise);
    useArSession.getState().request({ placeId: 'new-session', mode: 'street' });
    pending.resolve(route);
    await settle();
    cleanup();
    assert.deepEqual(useArSession.getState().route, { status: 'idle' });
    assert.equal(useArSession.getState().requested?.placeId, 'new-session');
  });

  it('gives both presentation surfaces bounded copy for every unavailable state', () => {
    for (const reason of ['missing-origin', 'no-destinations', 'request-failed'] as const) {
      assert.ok(tabletopRouteUnavailableMessage({ status: 'unavailable', reason }));
    }
    assert.equal(tabletopRouteUnavailableMessage({ status: 'idle' }), null);
    assert.equal(tabletopRouteUnavailableMessage({ status: 'ready', route }), null);
  });
});
