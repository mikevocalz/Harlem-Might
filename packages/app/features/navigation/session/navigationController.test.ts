import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { create } from 'zustand';
import { liveProgress } from '../../journey/model.ts';
import { createStore } from 'zustand/vanilla';
import { DEFAULT_NAVIGATION_CONFIG } from '../config.ts';
import type { LocationFix } from '../model/location.ts';
import type { RouteRequest, RouteResponse } from '../model/route.ts';
import { RouteProviderError, type RouteProvider } from '../providers/routeProvider.ts';
import { fixtureDestination, fixtureRoute, loadFixture, lngLatToCoordinate } from '../testing/fixtures.ts';
import { createManualClock, deferred, flush } from '../testing/manualClock.ts';
import { synthesizeTrace, type TraceOptions } from '../testing/traces.ts';
import { createNavigationController } from './navigationController.ts';
import {
  INITIAL_FIX_STATE,
  INITIAL_NAVIGATION_STATE,
  selectProgress,
  summarizeSession,
  type NavigationFixState,
  type NavigationState,
} from './navigationStore.ts';

const T0 = 1_760_000_000_000;
const NAME = 'apollo-theater--sylvias-restaurant';

/** A provider that answers from a script, recording every request. */
function scriptedProvider() {
  const requests: { request: RouteRequest; signal: AbortSignal | undefined }[] = [];
  const answers: (() => Promise<RouteResponse>)[] = [];
  const provider: RouteProvider = {
    id: 'mapbox',
    supportedModes: ['walking', 'cycling', 'driving'],
    getRoutes(request, options) {
      requests.push({ request, signal: options?.signal });
      const next = answers.shift();
      if (!next) return Promise.reject(new Error('no scripted answer'));
      return next();
    },
  };
  const routes = (name: string): RouteResponse => ({ kind: 'routes', provider: 'mapbox', routes: [fixtureRoute(name)] });
  return { provider, requests, answers, routes };
}

function harness() {
  const clock = createManualClock(T0 - 60_000);
  const scripted = scriptedProvider();
  const store = create<NavigationState>()(() => INITIAL_NAVIGATION_STATE);
  const fixStore = createStore<NavigationFixState>()(() => INITIAL_FIX_STATE);
  const controller = createNavigationController({
    provider: scripted.provider,
    store,
    fixStore,
    now: clock.now,
    schedule: clock.schedule,
  });
  const destination = fixtureDestination(NAME);
  const origin = lngLatToCoordinate(loadFixture(NAME).origin.lngLat);
  const feed = (fix: LocationFix) => {
    if (fix.timestampMs > clock.now()) clock.advance(fix.timestampMs - clock.now());
    controller.ingestFix(fix);
  };
  async function startNavigating() {
    scripted.answers.push(async () => scripted.routes(NAME));
    controller.beginSelection({ kind: 'device-location' });
    await controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: origin, destination, mode: 'walking' });
    assert.equal(store.getState().session.phase, 'routeReady');
    assert.ok(controller.start());
  }
  const trace = (options: Omit<TraceOptions, 'startMs'>) =>
    synthesizeTrace(fixtureRoute(NAME), { startMs: T0, ...options }).map((s) => s.fix);
  return { clock, scripted, store, fixStore, controller, destination, origin, feed, startNavigating, trace };
}

describe('navigation controller: planning', () => {
  it('goes idle → selectingDestination → calculatingRoute → routeReady', async () => {
    const h = harness();
    const phases: string[] = [];
    h.store.subscribe((s, prev) => {
      if (s.session.phase !== prev.session.phase) phases.push(s.session.phase);
    });
    await h.startNavigating();
    assert.deepEqual(phases, ['selectingDestination', 'calculatingRoute', 'routeReady', 'navigating']);
    assert.equal(h.scripted.requests[0]!.request.mode, 'walking');
    assert.equal(h.scripted.requests[0]!.request.destination, h.destination);
  });

  it('surfaces a provider failure as an error with the trip kept for retry', async () => {
    const h = harness();
    h.scripted.answers.push(async () => {
      throw new RouteProviderError('no-route', 'mapbox', 'No route found');
    });
    await h.controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: h.origin, destination: h.destination, mode: 'walking' });
    const s = h.store.getState();
    assert.ok(s.session.phase === 'error' && s.session.error.kind === 'route-failed' && s.session.error.reason === 'no-route');
    assert.ok(s.session.phase === 'error' && s.session.trip?.destination === h.destination);
    assert.ok(s.routeLoading.kind === 'failed' && s.routeLoading.purpose === 'initial');
  });

  it('hands transit off to external maps instead of faking a route', async () => {
    const h = harness();
    h.scripted.answers.push(async () => ({
      kind: 'unsupported',
      mode: 'transit',
      reason: 'Mapbox Directions does not route public transit.',
      handoff: { appleMapsUrl: 'https://maps.apple.com/?dirflg=r', googleMapsUrl: 'https://www.google.com/maps/dir/?travelmode=transit' },
    }));
    await h.controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: h.origin, destination: h.destination, mode: 'transit' });
    const s = h.store.getState().session;
    assert.ok(s.phase === 'error' && s.error.kind === 'unsupported-mode' && s.error.handoff.appleMapsUrl.includes('dirflg=r'));
  });

  it('a newer plan cancels the older one, whose late answer is ignored', async () => {
    const h = harness();
    const slow = deferred<RouteResponse>();
    h.scripted.answers.push(() => slow.promise, async () => h.scripted.routes(NAME));
    const first = h.controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: h.origin, destination: h.destination, mode: 'walking' });
    const second = h.controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: h.origin, destination: h.destination, mode: 'walking' });
    assert.ok(h.scripted.requests[0]!.signal?.aborted);
    await second;
    slow.resolve(h.scripted.routes('apollo-theater--marcus-garvey-park'));
    await first;
    const s = h.store.getState().session;
    assert.ok(s.phase === 'routeReady' && s.routes[0].distanceM < 600, 'the Sylvia’s route, not the late Marcus Garvey one');
  });
});

describe('navigation controller: guidance on a recorded route', () => {
  it('walks Apollo → Sylvia’s with GPS noise and dropouts and arrives at the door, confirmed', async () => {
    const h = harness();
    await h.startNavigating();
    const fixes = h.trace({ seed: 42, noiseSigmaM: 3, dwellFixes: 6, events: [{ kind: 'dropout', fromM: 150, toM: 190 }] });
    let sessionWrites = 0;
    h.store.subscribe((s, prev) => {
      if (s.session !== prev.session) sessionWrites += 1;
    });
    const steps = new Set<number>();
    for (const fix of fixes) {
      h.feed(fix);
      const p = selectProgress(h.store.getState());
      if (p) steps.add(p.activeStepIndex);
    }
    const s = h.store.getState().session;
    assert.equal(s.phase, 'arrived');
    assert.ok(s.phase === 'arrived' && s.arrival.kind === 'arrived' && s.arrival.confidence === 'confirmed');
    assert.ok(steps.size >= 4, `saw steps ${[...steps].join(',')}`);
    // 385 fixes, but the session only changes on phase/deviation/arrival kind changes.
    assert.ok(sessionWrites < 15, `${sessionWrites} session writes for ${fixes.length} fixes`);
  });

  it('keeps the raw fix and the matched position apart', async () => {
    const h = harness();
    await h.startNavigating();
    const fixes = h.trace({ seed: 7, noiseSigmaM: 4 });
    for (const fix of fixes.slice(0, 30)) h.feed(fix);
    const last = fixes[29]!;
    const { lastFix, match } = h.fixStore.getState();
    assert.ok(lastFix && lastFix.fix === last, 'the raw fix object is passed through untouched');
    assert.ok(match?.kind === 'matched');
    assert.notDeepEqual(match.kind === 'matched' && match.coordinate, last.coordinate);
  });

  it('rides out a single 70 m GPS jump: the location pipeline rejects it before matching', async () => {
    const h = harness();
    await h.startNavigating();
    const rejected: string[] = [];
    for (const fix of h.trace({ seed: 9, noiseSigmaM: 3, events: [{ kind: 'jump', atM: 250, eastM: 0, northM: 70 }] })) {
      h.feed(fix);
      const last = h.fixStore.getState().lastFix;
      if (last?.kind === 'rejected') rejected.push(last.reason);
      assert.notEqual(h.store.getState().session.phase, 'rerouting');
    }
    assert.deepEqual(rejected, ['implausible-speed']);
    assert.equal(h.scripted.requests.length, 1);
  });

  it('a 30 m multipath drift for 20 m of walking does not reroute', async () => {
    const h = harness();
    await h.startNavigating();
    for (const fix of h.trace({ seed: 5, noiseSigmaM: 3, events: [{ kind: 'drift', fromM: 300, toM: 320, eastM: 12, northM: 12 }] })) {
      h.feed(fix);
    }
    assert.equal(h.scripted.requests.length, 1);
  });

  it('leaving the route reroutes once, replaces the route atomically and keeps the destination and entrance', async () => {
    const h = harness();
    await h.startNavigating();
    const before = h.store.getState().session;
    assert.ok(before.phase === 'navigating');
    const reroute = deferred<RouteResponse>();
    h.scripted.answers.push(() => reroute.promise);

    const fixes = h.trace({ seed: 11, noiseSigmaM: 3, events: [{ kind: 'leave', atM: 200, forM: 70, bearingDeg: 0 }], dwellFixes: 10 });
    let rerouteStartedAt: number | undefined;
    for (const fix of fixes) {
      h.feed(fix);
      if (rerouteStartedAt === undefined && h.store.getState().session.phase === 'rerouting') rerouteStartedAt = fix.timestampMs;
    }
    assert.ok(rerouteStartedAt !== undefined, 'went to rerouting');
    h.clock.advance(10_000);
    assert.equal(h.scripted.requests.length, 2, 'exactly one reroute request');
    const sent = h.scripted.requests[1]!.request;
    assert.equal(sent.destination, before.destination, 'reroute aims at the same destination object, entrance included');
    assert.ok(sent.destination.entrance);

    const generations: number[] = [];
    h.store.subscribe((s) => {
      if ('activeRoute' in s.session) generations.push(s.session.activeRoute.generation);
    });
    reroute.resolve(h.scripted.routes('apollo-theater--marcus-garvey-park'));
    await flush();
    const after = h.store.getState();
    assert.equal(after.session.phase, 'navigating');
    assert.ok('activeRoute' in after.session && after.session.activeRoute.generation === 2);
    assert.ok('destination' in after.session && after.session.destination === before.destination);
    assert.equal(after.routeLoading.kind, 'idle');
    assert.deepEqual(generations, [2], 'one store write switched the route');
    assert.equal(after.progress.kind, 'none', 'progress from the old route is cleared');
  });

  it('walking the wrong way triggers a reroute', async () => {
    const h = harness();
    await h.startNavigating();
    h.scripted.answers.push(() => new Promise<RouteResponse>(() => {}));
    for (const fix of h.trace({ seed: 13, noiseSigmaM: 2, events: [{ kind: 'reverse', atM: 300, forM: 120 }] })) {
      h.feed(fix);
      if (h.store.getState().session.phase === 'rerouting') break;
    }
    const s = h.store.getState().session;
    assert.ok(s.phase === 'rerouting' && s.reroute.kind === 'pending' && s.reroute.reason === 'wrong-direction');
  });

  it('a failed reroute keeps the old route and resumes guidance', async () => {
    const h = harness();
    await h.startNavigating();
    h.scripted.answers.push(async () => {
      throw new RouteProviderError('unavailable', 'mapbox', 'HTTP 503');
    });
    for (const fix of h.trace({ seed: 1, noiseSigmaM: 2 }).slice(0, 3)) h.feed(fix);
    const routeBefore = 'activeRoute' in h.store.getState().session ? h.store.getState().session : undefined;
    assert.ok(h.controller.reroute());
    h.clock.advance(2000);
    await flush();
    const s = h.store.getState().session;
    assert.ok(s.phase === 'navigating' && s.reroute.kind === 'failed' && s.reroute.reason === 'unavailable');
    assert.ok(routeBefore && 'activeRoute' in routeBefore && s.activeRoute === routeBefore.activeRoute);
  });

  it('cancel() during a reroute aborts the request and returns to idle', async () => {
    const h = harness();
    await h.startNavigating();
    h.scripted.answers.push(() => new Promise<RouteResponse>(() => {}));
    for (const fix of h.trace({ seed: 1, noiseSigmaM: 2 }).slice(0, 3)) h.feed(fix);
    h.controller.reroute();
    h.clock.advance(2000);
    assert.equal(h.scripted.requests.length, 2);
    h.controller.cancel();
    assert.ok(h.scripted.requests[1]!.signal?.aborted);
    assert.deepEqual(h.store.getState(), INITIAL_NAVIGATION_STATE);
    assert.deepEqual(h.fixStore.getState(), INITIAL_FIX_STATE);
  });
});

describe('navigation controller: AR, pause and safety', () => {
  it('moves through the AR phases and back', async () => {
    const h = harness();
    await h.startNavigating();
    assert.ok(!h.controller.completeARCalibration(), 'not before entering AR');
    assert.ok(h.controller.enterAR());
    assert.equal(h.store.getState().session.phase, 'calibratingAR');
    assert.ok(h.controller.completeARCalibration());
    assert.equal(h.store.getState().session.phase, 'navigatingAR');
    h.controller.setArTracking({ kind: 'limited', reason: 'relocalizing' });
    assert.equal(h.store.getState().session.phase, 'calibratingAR');
    assert.equal(h.store.getState().arTracking.kind, 'limited');
    h.controller.completeARCalibration();
    h.controller.setArTracking({ kind: 'unavailable', reason: 'unsupported-device' });
    assert.equal(h.store.getState().session.phase, 'navigating');
    assert.equal(h.store.getState().arTracking.kind, 'off');
  });

  it('pauses and resumes into the phase it left', async () => {
    const h = harness();
    await h.startNavigating();
    h.controller.enterAR();
    h.controller.completeARCalibration();
    assert.ok(h.controller.pause());
    const paused = h.store.getState().session;
    assert.ok(paused.phase === 'paused' && paused.resumePhase === 'navigatingAR');
    assert.ok(!h.controller.pause());
    assert.ok(h.controller.resume());
    assert.equal(h.store.getState().session.phase, 'navigatingAR');
  });

  it('ignores commands that do not fit the phase', () => {
    const h = harness();
    assert.ok(!h.controller.start());
    assert.ok(!h.controller.enterAR());
    assert.ok(!h.controller.resume());
    assert.ok(!h.controller.reroute());
    assert.ok(!h.controller.selectRoute(0));
    assert.equal(h.store.getState().session.phase, 'idle');
  });

  it('reports positioning confidence separately and flags driving speed', async () => {
    const h = harness();
    await h.startNavigating();
    for (const fix of h.trace({ seed: 3, noiseSigmaM: 2 }).slice(0, 5)) h.feed(fix);
    const p = h.store.getState().positioning;
    assert.ok(p.kind === 'tracking' && p.confidence === 'high' && !p.isMovingTooFast);

    const car = harness();
    car.scripted.answers.push(async () => car.scripted.routes(NAME));
    await car.controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: car.origin, destination: car.destination, mode: 'cycling' });
    car.controller.start();
    for (const s of synthesizeTrace(fixtureRoute(NAME), { seed: 4, startMs: T0, speedMps: 9, noiseSigmaM: 2 }).slice(0, 20)) car.feed(s.fix);
    const q = car.store.getState().positioning;
    assert.ok(q.kind === 'tracking' && q.isMovingTooFast);
  });

  it('marks positioning lost after fifteen seconds without a fix', async () => {
    const h = harness();
    await h.startNavigating();
    const [first] = h.trace({ seed: 3, noiseSigmaM: 2 });
    h.feed(first!);
    h.clock.advance(16_000);
    h.controller.refreshPositioning();
    assert.equal(h.store.getState().positioning.kind, 'lost');
  });

  it('summarises the session with everything the spec lists', async () => {
    const h = harness();
    await h.startNavigating();
    for (const fix of h.trace({ seed: 8, noiseSigmaM: 2 }).slice(0, 20)) h.feed(fix);
    const summary = summarizeSession(h.store.getState(), h.fixStore.getState());
    assert.ok(summary);
    assert.equal(summary.provider, 'mapbox');
    assert.equal(summary.entrance, h.destination.entrance);
    assert.equal(summary.maneuvers.length, 6);
    assert.ok(summary.activeStep);
    assert.equal(summary.matchedPosition?.kind, 'matched');
    assert.equal(summary.rerouting, 'idle');
    assert.equal(summary.confidence, 'high');
  });
});


describe('navigation controller: fresh stationary progress', () => {
  it('refreshes timestamp and ETA on fresh fixes even when the step and rounded distance stay the same', async () => {
    const h = harness();
    await h.startNavigating();
    const fix: LocationFix = { coordinate: fixtureRoute(NAME).geometry.coordinates[0]!, accuracy: { horizontalM: 6 }, timestampMs: T0, source: 'device-gps' };
    h.feed(fix);
    const initial = selectProgress(h.store.getState());
    assert.ok(initial);
    let sessionWrites = 0;
    h.store.subscribe((state, previous) => { if (state.session !== previous.session) sessionWrites += 1; });
    for (let second = 1; second <= 20; second += 1) h.feed({ ...fix, timestampMs: T0 + second * 1000 });
    const current = selectProgress(h.store.getState());
    assert.ok(current);
    assert.equal(current.activeStepIndex, initial.activeStepIndex);
    assert.equal(Math.round(current.distanceRemainingM), Math.round(initial.distanceRemainingM));
    assert.ok(liveProgress({ state: h.store.getState(), fixes: h.fixStore.getState(), now: h.clock.now(), online: true, stopSlug: h.destination.placeId!, location: 'granted' }),
      'a stationary walker still has fresh, matched GPS after twenty seconds');
    assert.equal(current.timestampMs, T0 + 20_000);
    assert.equal(current.etaMs, current.timestampMs + current.durationRemainingS * 1000);
    assert.equal(sessionWrites, 0, 'fresh progress never rewrites an unchanged session');
    h.clock.advance(10_001);
    assert.equal(liveProgress({ state: h.store.getState(), fixes: h.fixStore.getState(), now: h.clock.now(), online: true, stopSlug: h.destination.placeId!, location: 'granted' }), undefined,
      'silence must still expire live progress');
  });

  for (const command of ['pause', 'cancel'] as const) {
    it(`does not apply arrival or reroute after a progress subscriber calls ${command}`, async () => {
      const h = harness();
      await h.startNavigating();
      const fix: LocationFix = { coordinate: h.destination.entrance!.coordinate, accuracy: { horizontalM: 6 }, timestampMs: T0, source: 'device-gps' };
      h.feed(fix);
      const release = h.store.subscribe((state, previous) => {
        if (state.progress !== previous.progress && state.progress.kind === 'tracking') h.controller[command]();
      });
      h.feed({ ...fix, timestampMs: T0 + 1000 });
      release();
      assert.equal(h.store.getState().session.phase, command === 'pause' ? 'paused' : 'idle');
      assert.equal(h.scripted.requests.length, 1);
    });
  }

  it('never refreshes progress from rejected fixes, paused fixes, or cancelled trips', async () => {
    const h = harness();
    await h.startNavigating();
    const fix: LocationFix = { coordinate: fixtureRoute(NAME).geometry.coordinates[0]!, accuracy: { horizontalM: 6 }, timestampMs: T0, source: 'device-gps' };
    h.feed(fix);
    const progress = h.store.getState().progress;
    h.feed({ ...fix, accuracy: { horizontalM: 500 }, timestampMs: T0 + 1000 });
    assert.equal(h.fixStore.getState().lastFix?.kind, 'rejected');
    assert.equal(h.store.getState().progress, progress);
    assert.ok(h.controller.pause());
    const paused = h.store.getState().session;
    h.feed({ ...fix, timestampMs: T0 + 2000 });
    assert.equal(h.store.getState().session, paused);
    assert.equal(h.store.getState().progress, progress);
    assert.ok(h.controller.resume());
    h.feed({ ...fix, timestampMs: T0 + 3000 });
    assert.equal(selectProgress(h.store.getState())?.timestampMs, T0 + 3000);
    h.controller.cancel();
    h.feed({ ...fix, timestampMs: T0 + 4000 });
    assert.equal(h.store.getState().session.phase, 'idle');
    assert.deepEqual(h.store.getState().progress, { kind: 'none' });
  });
});

describe('navigation controller: terminal arrival confidence', () => {
  async function estimatedArrival() {
    const h = harness();
    await h.startNavigating();
    const fix: LocationFix = { coordinate: h.destination.entrance!.coordinate,
      accuracy: { horizontalM: 18 }, timestampMs: T0, source: 'device-gps' };
    h.feed(fix);
    h.feed({ ...fix, timestampMs: T0 + 1000 });
    const arrived = h.store.getState().session;
    assert.ok(arrived.phase === 'arrived' && arrived.arrival.kind === 'arrived' && arrived.arrival.confidence === 'estimated');
    return { ...h, fix, arrived, arrivedAtMs: arrived.arrival.arrivedAtMs };
  }

  it('upgrades an estimate from an already-delivered precise fix without resuming guidance or replacing the trip', async () => {
    const h = await estimatedArrival();
    const progress = h.store.getState().progress;
    h.feed({ ...h.fix, accuracy: { horizontalM: 5 }, timestampMs: T0 + 2000 });
    const confirmed = h.store.getState().session;
    assert.ok(confirmed.phase === 'arrived' && confirmed.arrival.kind === 'arrived');
    assert.equal(confirmed.arrival.confidence, 'confirmed');
    assert.equal(confirmed.arrival.arrivedAtMs, h.arrivedAtMs);
    assert.equal(confirmed.destination, h.arrived.destination);
    assert.equal(confirmed.activeRoute, h.arrived.activeRoute);
    assert.equal(confirmed.origin, h.arrived.origin);
    assert.equal(h.store.getState().progress, progress, 'arrival confirmation is not progress tracking');
    assert.equal(h.controller.resume(), false);
    assert.equal(h.controller.reroute(), false);
    h.clock.advance(20_000);
    assert.equal(h.scripted.requests.length, 1);
  });

  it('keeps the arrived route when a cancelled reroute answers after confirmation', async () => {
    const h = harness();
    await h.startNavigating();
    const fix: LocationFix = { coordinate: h.destination.entrance!.coordinate,
      accuracy: { horizontalM: 18 }, timestampMs: T0, source: 'device-gps' };
    h.feed(fix);
    const response = deferred<RouteResponse>();
    h.scripted.answers.push(() => response.promise);
    assert.ok(h.controller.reroute());
    h.clock.advance(1000);
    assert.equal(h.scripted.requests.length, 2);
    h.feed({ ...fix, timestampMs: T0 + 1000 });
    assert.ok(h.scripted.requests[1]!.signal?.aborted);
    h.feed({ ...fix, accuracy: { horizontalM: 5 }, timestampMs: T0 + 2000 });
    const arrival = h.store.getState().session;
    assert.ok(arrival.phase === 'arrived' && arrival.arrival.kind === 'arrived' && arrival.arrival.confidence === 'confirmed');
    assert.equal(arrival.activeRoute.generation, 1);
    response.resolve(h.scripted.routes('apollo-theater--marcus-garvey-park'));
    await flush();
    assert.equal(h.store.getState().session, arrival);
    assert.equal(h.store.getState().routeLoading.kind, 'idle');
  });

  it('does not downgrade, leave arrived, or reroute when later fixes are coarse or far away', async () => {
    const h = await estimatedArrival();
    h.feed({ ...h.fix, accuracy: { horizontalM: 5 }, timestampMs: T0 + 2000 });
    const confirmed = h.store.getState().session;
    assert.ok(confirmed.phase === 'arrived' && confirmed.arrival.kind === 'arrived' && confirmed.arrival.confidence === 'confirmed');
    for (let second = 60; second <= 70; second += 1) {
      h.feed({ ...h.fix, coordinate: h.origin, timestampMs: T0 + second * 1000 });
    }
    assert.equal(h.store.getState().session, confirmed, 'completed arrivals retain their original ownership and confidence');
    assert.equal(h.scripted.requests.length, 1);
  });

  for (const evidence of ['invalid', 'stale', 'outside'] as const) {
    it(`never confirms an estimate from ${evidence} evidence`, async () => {
      const h = await estimatedArrival();
      if (evidence === 'stale') h.clock.advance(20_000);
      for (let index = 2; index <= 8; index += 1) {
        h.feed({ ...h.fix, coordinate: evidence === 'invalid' ? { latitude: Number.NaN, longitude: 0 } : evidence === 'outside' ? h.origin : h.fix.coordinate,
          accuracy: { horizontalM: 5 }, timestampMs: T0 + index * 1000 });
      }
      assert.equal(h.store.getState().session, h.arrived);
      h.clock.advance(20_000);
      assert.equal(h.scripted.requests.length, 1);
    });
  }

  it('does not restore an arrival cancelled by a fix subscriber', async () => {
    const h = await estimatedArrival();
    // Only cancel once: cancel itself resets the fix store.
    let cancelled = false;
    const unsubscribe = h.fixStore.subscribe(() => {
      if (!cancelled) { cancelled = true; h.controller.cancel(); }
    });
    h.feed({ ...h.fix, accuracy: { horizontalM: 5 }, timestampMs: T0 + 2000 });
    unsubscribe();
    assert.equal(h.store.getState().session.phase, 'idle');
  });

  it('ignores invalid arrival evidence and cannot resurrect a cancelled arrival in a new paused trip', async () => {
    const h = await estimatedArrival();
    h.feed({ ...h.fix, accuracy: { horizontalM: 500 }, timestampMs: T0 + 2000 });
    assert.equal(h.store.getState().session, h.arrived);
    h.controller.cancel();
    h.feed({ ...h.fix, accuracy: { horizontalM: 5 }, timestampMs: T0 + 3000 });
    assert.equal(h.store.getState().session.phase, 'idle');
    await h.startNavigating();
    assert.ok(h.controller.pause());
    const paused = h.store.getState().session;
    h.feed({ ...h.fix, accuracy: { horizontalM: 5 }, timestampMs: T0 + 4000 });
    assert.equal(h.store.getState().session, paused);
  });
});


describe('positioning uncertainty contract', () => {
  it('names the display r68 independently from the unchanged filter sigma', async () => {
    const h = harness();
    await h.startNavigating();
    h.feed(h.trace({ seed: 77, accuracyM: 12 })[0]!);
    const position = h.store.getState().positioning;
    const fix = h.fixStore.getState().lastFix;
    assert.ok(position.kind === 'tracking' && fix?.kind === 'accepted');
    assert.equal(position.horizontalRadius68M, Math.round(fix.filtered.sigmaM / DEFAULT_NAVIGATION_CONFIG.location.radiusToSigma));
    assert.equal(Object.hasOwn(position, 'sigmaM'), false);
    assert.equal(typeof fix.filtered.sigmaM, 'number');
  });
});
