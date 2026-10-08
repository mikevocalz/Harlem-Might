import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { sceneModeFor, useArSession } from './arSession.store.ts';

const ROUTE = {
  kind: 'straight' as const,
  routeId: 'walk:a:b',
  reason: 'no-token' as const,
  coordinates: [
    { latitude: 40.81, longitude: -73.95 },
    { latitude: 40.808, longitude: -73.947 },
  ],
};

describe('useArSession', () => {
  beforeEach(() => useArSession.getState().reset());

  it('records the request and clears earlier session state', () => {
    const s = useArSession.getState();
    s.setRoute(ROUTE);
    s.setPlayheadM(30);
    s.request({ mode: 'tabletop', placeId: 'apollo-theater' });
    const next = useArSession.getState();
    assert.deepEqual(next.requested, { mode: 'tabletop', placeId: 'apollo-theater' });
    assert.deepEqual(next.route, { status: 'idle' });
    assert.equal(next.playheadM, 0);
  });

  it('resets the playhead when a new route arrives', () => {
    const s = useArSession.getState();
    s.setPlayheadM(12);
    s.setRoute(ROUTE);
    assert.deepEqual(useArSession.getState().route, { status: 'ready', route: ROUTE });
    assert.equal(useArSession.getState().playheadM, 0);
  });

  it('clamps the playhead to zero and rejects non-finite values', () => {
    const s = useArSession.getState();
    s.setPlayheadM(-4);
    assert.equal(useArSession.getState().playheadM, 0);
    assert.throws(() => s.setPlayheadM(Number.NaN), RangeError);
  });

  it('stores the placed surface and the resolved mode', () => {
    const s = useArSession.getState();
    s.place({ anchorId: 'plane-1', surface: 'Table', widthM: 1.2, depthM: 0.8 });
    s.resolve(
      { mode: 'tabletop', placement: { kind: 'table-anchor', sceneAnchorId: 'plane-1' }, worldToTableScale: 2000 },
      [],
    );
    const state = useArSession.getState();
    assert.equal(state.placement?.anchorId, 'plane-1');
    assert.equal(state.resolved?.mode, 'tabletop');
  });

  it('starts a street session just south of the place, facing north', () => {
    const s = useArSession.getState();
    s.teleport({ eastM: 40, northM: 12 });
    s.snapTurn('right');
    s.request({ mode: 'street', placeId: 'apollo-theater' });
    const next = useArSession.getState();
    assert.deepEqual(next.street, { user: { eastM: 0, northM: -4 }, headingDeg: 0 });
    assert.equal(sceneModeFor(next.requested), 'street');
  });

  it('teleports and snap-turns in the street scene', () => {
    const s = useArSession.getState();
    s.teleport({ eastM: 12.5, northM: -3 });
    s.snapTurn('left');
    s.snapTurn('left');
    assert.deepEqual(useArSession.getState().street, { user: { eastM: 12.5, northM: -3 }, headingDeg: 270 });
    assert.throws(() => s.teleport({ eastM: Number.POSITIVE_INFINITY, northM: 0 }), RangeError);
  });

  it('teleports with a heading, normalised to [0, 360)', () => {
    const s = useArSession.getState();
    s.teleport({ eastM: 1, northM: 2 }, -90);
    assert.deepEqual(useArSession.getState().street, { user: { eastM: 1, northM: 2 }, headingDeg: 270 });
    assert.throws(() => s.teleport({ eastM: 0, northM: 0 }, Number.NaN), RangeError);
  });
});

describe('sceneModeFor', () => {
  it('is tabletop for every request except street', () => {
    assert.equal(sceneModeFor(null), 'tabletop');
    for (const mode of ['tabletop', 'room', 'preview'] as const) {
      assert.equal(sceneModeFor({ mode }), 'tabletop');
    }
    assert.equal(sceneModeFor({ mode: 'street' }), 'street');
  });
});
