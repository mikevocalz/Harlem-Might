import assert from 'node:assert/strict';
import { it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { liveProgress } from './model.ts';
import { verifiedArrival } from './cues.ts';
import type { NavigationFixState, NavigationState } from '../navigation/session/navigationStore.ts';
import { fixtureDestination, fixtureRoute } from '../navigation/testing/fixtures.ts';

const tick = 1800000000000;
const route = fixtureRoute('apollo-theater--sylvias-restaurant');
const destination = fixtureDestination('apollo-theater--sylvias-restaurant', false);
const stopSlug = destination.placeId!;
function inputs(timestampMs: number) {
  const state = { session: { phase: 'navigating', origin: { kind: 'device-location' }, destination, mode: 'walking', activeRoute: { route, generation: 1, receivedAtMs: tick }, deviation: { kind: 'on-route' }, arrival: { kind: 'en-route', distanceM: 100 }, reroute: { kind: 'idle' } }, positioning: { kind: 'tracking', confidence: 'high', horizontalRadius68M: 3, isMovingTooFast: false }, progress: { kind: 'tracking', progress: { routeId: route.id, timestampMs } }, routeLoading: { kind: 'idle' }, arTracking: { kind: 'off' } } as NavigationState;
  const fixes = { lastFix: { kind: 'accepted', fix: { source: 'device-gps', timestampMs, accuracy: { horizontalM: 5 } }, filtered: { coordinate: destination.coordinate } }, match: { kind: 'matched' } } as NavigationFixState;
  const arrived = { ...state, session: { ...state.session, phase: 'arrived', arrival: { kind: 'arrived', confidence: 'confirmed', arrivedAtMs: tick } } } as NavigationState;
  return { state, fixes, arrived };
}
it('journey renders evaluate new fixes immediately between one-second clock ticks', () => {
  const result = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', fileURLToPath(new URL('./test-helpers/journey-clock.mjs', import.meta.url))], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (const elapsed of [1, 250, 999]) {
    const evaluatedAt = tick + elapsed;
    const { state, fixes, arrived } = inputs(evaluatedAt);
    assert.ok(liveProgress({ state, fixes, now: evaluatedAt, online: true, stopSlug, location: 'granted' }));
    assert.equal(verifiedArrival({ state: arrived, fixes, now: evaluatedAt, stopSlug, location: 'granted', online: true }), true);
  }
});
it('fresh render times still reject genuinely future or expired fixes', () => {
  const evaluatedAt = tick + 500;
  for (const timestamp of [tick + 501, tick + 60_000, tick - 10_001]) {
    const { state, fixes, arrived } = inputs(timestamp);
    assert.equal(liveProgress({ state, fixes, now: evaluatedAt, online: true, stopSlug, location: 'granted' }), undefined);
    assert.equal(verifiedArrival({ state: arrived, fixes, now: evaluatedAt, stopSlug, location: 'granted', online: true }), false);
  }
});
it('live guidance fails closed on non-finite fix or progress ages', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const { state, fixes, arrived } = inputs(invalid);
    assert.equal(liveProgress({ state, fixes, now: tick, online: true, stopSlug, location: 'granted' }), undefined);
    assert.equal(verifiedArrival({ state: arrived, fixes, now: tick, stopSlug, location: 'granted', online: true }), false);
    const current = inputs(tick);
    assert.equal(liveProgress({ state: { ...current.state, progress: state.progress }, fixes: current.fixes, now: tick, online: true, stopSlug, location: 'granted' }), undefined);
  }
});
