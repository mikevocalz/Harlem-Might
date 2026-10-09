import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { create } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { RouteResponse } from '../model/route.ts';
import { RouteProviderError, type RouteProvider } from '../providers/routeProvider.ts';
import { createNavigationController } from '../session/navigationController.ts';
import {
  INITIAL_FIX_STATE,
  INITIAL_NAVIGATION_STATE,
  type NavigationFixState,
  type NavigationState,
} from '../session/navigationStore.ts';
import { distanceM } from '../geo/localFrame.ts';
import { fixtureDestination, fixtureRoute, loadFixture, lngLatToCoordinate } from '../testing/fixtures.ts';
import { createManualClock } from '../testing/manualClock.ts';
import { synthesizeTrace } from '../testing/traces.ts';
import { directionsView, routeOptions, stepRows, type DirectionsInput } from './directionsView.ts';
import { externalMapsLinks } from './externalLinks.ts';
import { formatArrivalClock, formatRouteDistance, formatRouteDuration, spokenRouteDuration } from './format.ts';
import { hudView, type HudInput } from './hudView.ts';
import {
  availabilityFromBrowserError,
  createBrowserLocationSource,
  fixFromBrowserPosition,
  NO_LOCATION_SOURCE,
  type BrowserGeolocation,
  type LocationAvailability,
} from './locationSource.ts';
import { maneuverGlyph, stepInstruction } from './maneuver.ts';
import { simplifyRoute, splitRouteAt, toLngLat } from './routeLine.ts';

const T0 = 1_760_000_000_000;
const NAME = 'apollo-theater--sylvias-restaurant';
const fixture = loadFixture(NAME);
const ORIGIN = lngLatToCoordinate(fixture.origin.lngLat);
const DESTINATION = fixtureDestination(NAME, false);

function harness(answer: () => Promise<RouteResponse>) {
  const clock = createManualClock(T0 - 60_000);
  const store = create<NavigationState>()(() => INITIAL_NAVIGATION_STATE);
  const fixStore = createStore<NavigationFixState>()(() => INITIAL_FIX_STATE);
  const provider: RouteProvider = { id: 'mapbox', supportedModes: ['walking'], getRoutes: () => answer() };
  const controller = createNavigationController({ provider, store, fixStore, now: clock.now, schedule: clock.schedule });
  const plan = () =>
    controller.planRoute({ origin: { kind: 'device-location' }, originCoordinate: ORIGIN, destination: DESTINATION, mode: 'walking' });
  return { clock, store, fixStore, controller, plan };
}

const routes = (): RouteResponse => ({ kind: 'routes', provider: 'mapbox', routes: [fixtureRoute(NAME)] });

function input(overrides: Partial<DirectionsInput> = {}): DirectionsInput {
  return {
    place: { id: DESTINATION.placeId!, name: DESTINATION.name, coordinate: DESTINATION.coordinate, street: 'Malcolm X Boulevard' },
    mode: 'walking',
    originChoice: { kind: 'device' },
    location: 'granted',
    online: true,
    devicePosition: ORIGIN,
    now: T0,
    locale: 'en-US',
    timeZone: 'America/New_York',
    ...overrides,
  };
}

const HUD: HudInput = { location: 'granted', awarenessAcknowledged: true, now: T0, locale: 'en-US', timeZone: 'America/New_York' };

describe('format', () => {
  it('prints distances the way Explore does, finer close to a turn', () => {
    assert.equal(formatRouteDistance(42, 'en-US'), '40 m');
    assert.equal(formatRouteDistance(47, 'en-US'), '45 m');
    assert.equal(formatRouteDistance(436, 'en-US'), '440 m');
    assert.equal(formatRouteDistance(1234, 'en-US'), '1.2 km');
    assert.equal(formatRouteDistance(Number.NaN), '');
  });

  it('never says a route takes 0 minutes', () => {
    assert.equal(formatRouteDuration(10), '1 min');
    assert.equal(formatRouteDuration(372), '6 min');
    assert.equal(formatRouteDuration(3600), '1 hr');
    assert.equal(formatRouteDuration(3900), '1 hr 5 min');
    assert.equal(spokenRouteDuration(60), '1 minute');
    assert.equal(spokenRouteDuration(3900), '1 hour 5 minutes');
  });

  it('prints the arrival clock in the given zone', () => {
    // 2025-10-09T08:53:20Z is 4:53 AM in New York.
    assert.equal(formatArrivalClock(T0, 'en-US', 'America/New_York'), '4:53 AM');
  });
});

describe('maneuver glyphs', () => {
  it('maps types first and modifiers second', () => {
    assert.equal(maneuverGlyph({ type: 'depart', modifier: 'left' }), 'depart');
    assert.equal(maneuverGlyph({ type: 'arrive', modifier: 'right' }), 'arrive');
    assert.equal(maneuverGlyph({ type: 'rotary' }), 'roundabout');
    assert.equal(maneuverGlyph({ type: 'turn', modifier: 'sharp-left' }), 'sharp-left');
    assert.equal(maneuverGlyph({ type: 'new-name' }), 'straight');
  });

  it('every step of every recorded route gets a non-empty instruction', () => {
    const route = fixtureRoute(NAME);
    for (const step of route.legs.flatMap((leg) => leg.steps)) assert.ok(stepInstruction(step).length > 0);
    const blank = { ...route.legs[0]!.steps[1]!, maneuver: { ...route.legs[0]!.steps[1]!.maneuver, instruction: ' ' } };
    assert.match(stepInstruction(blank), /^(Turn|Bear|Continue|Sharp)/);
  });
});

describe('directions panel states', () => {
  it('empty: a place with no verified point has nothing to route to', () => {
    const view = directionsView(INITIAL_NAVIGATION_STATE, input({ place: { id: 'strivers-row', name: "Striver's Row" } }));
    assert.equal(view.kind, 'empty');
  });

  it('default: explains location before asking, and cannot request without an origin', () => {
    const view = directionsView(INITIAL_NAVIGATION_STATE, input({ location: 'unknown', devicePosition: undefined }));
    assert.equal(view.kind, 'default');
    if (view.kind !== 'default') return;
    assert.equal(view.canRequest, false);
    assert.equal(view.origin.canAskLocation, true);
    assert.match(view.origin.notice!.text, /never saves it/);
    assert.equal(view.destination.entranceVerified, false);
    assert.match(view.destination.entranceText, /No entrance on record/);
  });

  for (const [location, pattern] of [
    ['denied', /Settings/],
    ['disabled', /location services/],
    ['approximate', /approximate/],
    ['unsupported', /Start from a place/],
  ] as const satisfies readonly (readonly [LocationAvailability, RegExp])[]) {
    it(`default: words the ${location} location state`, () => {
      const view = directionsView(INITIAL_NAVIGATION_STATE, input({ location, devicePosition: location === 'approximate' ? ORIGIN : undefined }));
      assert.equal(view.kind, 'default');
      if (view.kind === 'default') assert.match(view.origin.notice!.text, pattern);
    });
  }

  it('default: a chosen place is labelled as not your location', () => {
    const view = directionsView(
      INITIAL_NAVIGATION_STATE,
      input({ originChoice: { kind: 'place', placeId: 'apollo-theater' }, originPlaceName: 'Apollo Theater', location: 'unsupported' }),
      ORIGIN,
    );
    assert.equal(view.kind, 'default');
    if (view.kind !== 'default') return;
    assert.equal(view.canRequest, true);
    assert.equal(view.origin.text, 'Apollo Theater (chosen, not your location)');
  });

  it('loading, then success with summary, options and every step', async () => {
    let release!: () => void;
    const h = harness(() => new Promise((resolve) => (release = () => resolve(routes()))));
    const planned = h.plan();
    assert.equal(directionsView(h.store.getState(), input()).kind, 'loading');
    release();
    await planned;
    const view = directionsView(h.store.getState(), input());
    assert.equal(view.kind, 'success');
    if (view.kind !== 'success') return;
    const route = fixtureRoute(NAME);
    assert.equal(view.summary.durationText, formatRouteDuration(route.durationS));
    assert.equal(view.steps.length, route.legs[0]!.steps.length);
    assert.equal(view.steps.at(-1)!.glyph, 'arrive');
    assert.equal(view.steps.at(-1)!.distanceText, '');
    assert.equal(view.options.length, 1);
    assert.equal(view.guidanceNote, undefined);
    assert.match(view.external.googleMapsUrl, /travelmode=walking/);
  });

  it('success from a chosen place warns that guidance will not follow you', async () => {
    const h = harness(async () => routes());
    await h.controller.planRoute({
      origin: { kind: 'manual', coordinate: ORIGIN, label: 'Apollo Theater' },
      originCoordinate: ORIGIN,
      destination: DESTINATION,
      mode: 'walking',
    });
    const view = directionsView(h.store.getState(), input({ location: 'unsupported', devicePosition: undefined }));
    assert.equal(view.kind, 'success');
    if (view.kind === 'success') {
      assert.equal(view.originText, 'Apollo Theater (chosen, not your location)');
      assert.match(view.guidanceNote!, /can’t follow you/);
    }
  });

  it('error: words each provider failure and only offers retry where it can help', async () => {
    for (const [kind, canRetry] of [
      ['no-route', true],
      ['missing-token', false],
      ['rate-limited', true],
      ['unavailable', true],
    ] as const) {
      const h = harness(async () => {
        throw new RouteProviderError(kind, 'mapbox', kind);
      });
      await h.plan();
      const view = directionsView(h.store.getState(), input());
      assert.equal(view.kind, 'error', kind);
      if (view.kind === 'error') assert.equal(view.canRetry, canRetry, kind);
    }
  });

  it('offline: a network failure, or the platform saying offline, is not an error', async () => {
    const h = harness(async () => {
      throw new RouteProviderError('network', 'mapbox', 'fetch failed');
    });
    await h.plan();
    const failed = directionsView(h.store.getState(), input());
    assert.ok(failed.kind === 'offline' && failed.canRetry);
    const before = directionsView(INITIAL_NAVIGATION_STATE, input({ online: false }));
    assert.ok(before.kind === 'offline' && !before.canRetry);
  });

  it('transit: an honest handoff, never a drawn route', () => {
    const view = directionsView(INITIAL_NAVIGATION_STATE, input({ mode: 'transit' }));
    assert.equal(view.kind, 'handoff');
    if (view.kind !== 'handoff') return;
    assert.match(view.body, /won’t draw one/);
    assert.match(view.external.appleMapsUrl, /dirflg=r/);
    assert.match(view.external.googleMapsUrl, /travelmode=transit/);
  });

  it('a session for another place does not leak into this panel', async () => {
    const h = harness(async () => routes());
    await h.plan();
    const view = directionsView(h.store.getState(), input({ place: { id: 'apollo-theater', name: 'Apollo', coordinate: ORIGIN } }));
    assert.equal(view.kind, 'default');
  });

  it('guiding: marks passed, active and upcoming steps from progress', async () => {
    const h = harness(async () => routes());
    await h.plan();
    h.controller.start();
    const trace = synthesizeTrace(fixtureRoute(NAME), { seed: 3, startMs: T0, noiseSigmaM: 2 });
    for (const sample of trace.slice(0, Math.floor(trace.length * 0.7))) {
      if (sample.fix.timestampMs > h.clock.now()) h.clock.advance(sample.fix.timestampMs - h.clock.now());
      h.controller.ingestFix(sample.fix);
    }
    const view = directionsView(h.store.getState(), input({ now: h.clock.now() }));
    assert.equal(view.kind, 'guiding');
    if (view.kind !== 'guiding') return;
    const statuses = view.steps.map((s) => s.status);
    assert.equal(statuses.filter((s) => s === 'active').length, 1);
    assert.ok(statuses.indexOf('active') > 0, 'progress moved past the first step');
    assert.ok(statuses.slice(0, statuses.indexOf('active')).every((s) => s === 'passed'));
  });
});

describe('route options', () => {
  it('labels the first route suggested and the rest by time difference', () => {
    const a = fixtureRoute(NAME);
    const b = { ...a, id: 'b', durationS: a.durationS + 180 };
    const options = routeOptions([a, b], 1);
    assert.equal(options[0]!.label, 'Suggested');
    assert.equal(options[1]!.deltaText, '+3 min');
    assert.equal(options[1]!.selected, true);
    assert.match(options[1]!.accessibilityLabel, /^Alternative 1: /);
  });

  it('step rows without progress are all upcoming', () => {
    assert.ok(stepRows(fixtureRoute(NAME)).every((row) => row.status === 'upcoming'));
  });
});

describe('HUD', () => {
  it('is hidden without an active trip', () => {
    assert.equal(hudView(INITIAL_NAVIGATION_STATE, HUD).kind, 'hidden');
  });

  it('before the first fix: route totals, the first turn, the acquiring and awareness notices', async () => {
    const h = harness(async () => routes());
    await h.plan();
    h.controller.start();
    const view = hudView(h.store.getState(), { ...HUD, awarenessAcknowledged: false });
    assert.equal(view.kind, 'guiding');
    if (view.kind !== 'guiding') return;
    assert.equal(view.maneuver.distanceText, '');
    assert.deepEqual(view.notices.map((n) => n.id), ['gps-acquiring', 'awareness']);
    assert.equal(view.generation, 1);
  });

  it('while guiding: distance to the next turn and the street being walked', async () => {
    const h = harness(async () => routes());
    await h.plan();
    h.controller.start();
    for (const sample of synthesizeTrace(fixtureRoute(NAME), { seed: 9, startMs: T0, noiseSigmaM: 2 }).slice(0, 8)) {
      if (sample.fix.timestampMs > h.clock.now()) h.clock.advance(sample.fix.timestampMs - h.clock.now());
      h.controller.ingestFix(sample.fix);
    }
    const view = hudView(h.store.getState(), HUD);
    assert.equal(view.kind, 'guiding');
    if (view.kind !== 'guiding') return;
    assert.match(view.maneuver.distanceText, /^In \d+ m$/);
    assert.ok(view.maneuver.street.length > 0);
    assert.equal(view.notices.length, 0);
  });

  it('says guidance cannot follow you with no device location', async () => {
    const h = harness(async () => routes());
    await h.plan();
    h.controller.start();
    const view = hudView(h.store.getState(), { ...HUD, location: 'unsupported' });
    assert.ok(view.kind === 'guiding' && view.notices.some((n) => n.id === 'no-location'));
  });

  it('paused and rerouting are their own kinds', async () => {
    const h = harness(async () => routes());
    await h.plan();
    h.controller.start();
    h.controller.pause();
    assert.equal(hudView(h.store.getState(), HUD).kind, 'paused');
    h.controller.resume();
    h.store.setState({ routeLoading: { kind: 'loading', purpose: 'reroute', attempt: 1 } });
    const view = hudView(h.store.getState(), HUD);
    assert.equal(view.kind, 'rerouting');
    if (view.kind === 'rerouting') assert.match(view.statusText, /new route/);
  });

  it('flags driving speed as a safety notice ahead of everything else', async () => {
    const h = harness(async () => routes());
    await h.plan();
    h.controller.start();
    h.store.setState({ positioning: { kind: 'tracking', confidence: 'high', sigmaM: 3, isMovingTooFast: true } });
    const view = hudView(h.store.getState(), { ...HUD, awarenessAcknowledged: false });
    assert.ok(view.kind === 'guiding');
    if (view.kind === 'guiding') assert.equal(view.notices[0]!.id, 'too-fast');
  });

  it('arrival: confirmed and estimated are worded differently', async () => {
    const h = harness(async () => routes());
    await h.plan();
    h.controller.start();
    for (const sample of synthesizeTrace(fixtureRoute(NAME), { seed: 1, startMs: T0, noiseSigmaM: 2, dwellFixes: 6 })) {
      if (sample.fix.timestampMs > h.clock.now()) h.clock.advance(sample.fix.timestampMs - h.clock.now());
      h.controller.ingestFix(sample.fix);
    }
    const arrived = hudView(h.store.getState(), HUD);
    assert.equal(arrived.kind, 'arrived');
    if (arrived.kind !== 'arrived') return;
    assert.match(arrived.arrival.title, /^You’ve arrived at /);
    assert.equal(arrived.arrival.placeId, DESTINATION.placeId);

    const session = h.store.getState().session;
    assert.equal(session.phase, 'arrived');
    if (session.phase !== 'arrived' || session.arrival.kind !== 'arrived') return;
    h.store.setState({ session: { ...session, arrival: { ...session.arrival, confidence: 'estimated' } } });
    const estimated = hudView(h.store.getState(), HUD);
    assert.ok(estimated.kind === 'arrived' && /^You should be near /.test(estimated.arrival.title));
  });
});

describe('location source (W3C adapter)', () => {
  it('keeps raw accuracy, course and speed, and drops null course/speed', () => {
    const fix = fixFromBrowserPosition({
      coords: { latitude: 40.81, longitude: -73.95, accuracy: 12, heading: null, speed: Number.NaN },
      timestamp: T0,
    });
    assert.deepEqual(fix, {
      coordinate: { latitude: 40.81, longitude: -73.95 },
      accuracy: { horizontalM: 12 },
      timestampMs: T0,
      source: 'device-gps',
    });
    assert.equal(fixFromBrowserPosition({ coords: { latitude: 40, longitude: -73, accuracy: 0 }, timestamp: T0 }), undefined);
  });

  it('maps error codes; a timeout is not terminal', () => {
    assert.equal(availabilityFromBrowserError(1), 'denied');
    assert.equal(availabilityFromBrowserError(2), 'disabled');
    assert.equal(availabilityFromBrowserError(3), undefined);
  });

  it('watches with high accuracy and no cached fixes, reports approximate fixes, and stops', async () => {
    let options: unknown;
    let success!: Parameters<BrowserGeolocation['watchPosition']>[0];
    let cleared = -1;
    const geo: BrowserGeolocation = {
      watchPosition(onSuccess, _onError, opts) {
        success = onSuccess;
        options = opts;
        return 7;
      },
      clearWatch: (id) => (cleared = id),
    };
    const source = createBrowserLocationSource(geo, { query: async () => ({ state: 'prompt' }) });
    assert.equal(await source.check(), 'unknown');
    const seen: LocationAvailability[] = [];
    let fixes = 0;
    const stop = source.watch({ onFix: () => (fixes += 1), onAvailability: (a) => seen.push(a) });
    assert.deepEqual(options, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
    success({ coords: { latitude: 40.81, longitude: -73.95, accuracy: 900 }, timestamp: T0 });
    success({ coords: { latitude: 40.81, longitude: -73.95, accuracy: 8 }, timestamp: T0 + 1000 });
    success({ coords: { latitude: 40.81, longitude: -73.95, accuracy: 9 }, timestamp: T0 + 2000 });
    assert.deepEqual(seen, ['approximate', 'granted']);
    assert.equal(fixes, 3);
    stop();
    assert.equal(cleared, 7);
  });

  it('a build without location never prompts', async () => {
    assert.equal(createBrowserLocationSource(undefined), NO_LOCATION_SOURCE);
    assert.equal(await NO_LOCATION_SOURCE.check(), 'unsupported');
  });
});

describe('route line', () => {
  it('simplifies in metres, keeps the ends, and stays within tolerance of the original', () => {
    const route = fixtureRoute(NAME);
    const coordinates = route.geometry.coordinates;
    const simple = simplifyRoute(coordinates, 3);
    assert.ok(simple.length < coordinates.length);
    assert.deepEqual(simple[0], coordinates[0]);
    assert.deepEqual(simple.at(-1), coordinates.at(-1));
    // Every dropped vertex is close to some kept vertex pair; a loose check: the
    // kept polyline is never shorter than 95% of the original.
    const length = (cs: typeof coordinates) => cs.slice(1).reduce((sum, c, i) => sum + distanceM(cs[i]!, c), 0);
    assert.ok(length(simple) > length(coordinates) * 0.95);
  });

  it('converts to GeoJSON order only at the boundary', () => {
    assert.deepEqual(toLngLat([{ latitude: 40.8, longitude: -73.9 }]), [[-73.9, 40.8]]);
  });

  it('splits at the matched point', () => {
    const cs = fixtureRoute(NAME).geometry.coordinates;
    const at = { coordinate: { latitude: 0, longitude: 0 }, segmentIndex: 2 };
    const { walked, ahead } = splitRouteAt(cs, at);
    assert.equal(walked.length, 4);
    assert.deepEqual(walked.at(-1), at.coordinate);
    assert.deepEqual(ahead[0], at.coordinate);
    assert.equal(ahead.length, cs.length - 2);
    assert.deepEqual(splitRouteAt(cs, undefined).walked, []);
  });
});

describe('external maps', () => {
  it('uses the domain handoff with an origin and the destination alone without one', () => {
    const withOrigin = externalMapsLinks(DESTINATION, 'walking', ORIGIN);
    assert.match(withOrigin.appleMapsUrl, /saddr=/);
    const without = externalMapsLinks(DESTINATION, 'cycling');
    assert.doesNotMatch(without.appleMapsUrl, /saddr=/);
    assert.match(without.googleMapsUrl, /travelmode=bicycling/);
  });
});

describe('displayed route', () => {
  it('draws the selected option while choosing and the active route while guiding, nothing when idle', async () => {
    const { selectDisplayedRoute } = await import('./routeLine.ts');
    assert.equal(selectDisplayedRoute(INITIAL_NAVIGATION_STATE), undefined);
    const h = harness(async () => routes());
    await h.plan();
    assert.equal(selectDisplayedRoute(h.store.getState())?.kind, 'preview');
    h.controller.start();
    const active = selectDisplayedRoute(h.store.getState());
    assert.equal(active?.kind, 'active');
    assert.equal(active?.generation, 1);
  });
});
