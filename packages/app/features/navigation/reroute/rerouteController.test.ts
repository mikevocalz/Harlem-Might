import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_NAVIGATION_CONFIG } from '../config.ts';
import type { RouteRequest, RouteResponse } from '../model/route.ts';
import { RouteProviderError, type RouteProvider } from '../providers/routeProvider.ts';
import { fixtureRoute } from '../testing/fixtures.ts';
import { createManualClock, deferred, flush } from '../testing/manualClock.ts';
import { createRerouteController } from './rerouteController.ts';

const T0 = 1_760_000_000_000;
const ROUTE = fixtureRoute('apollo-theater--sylvias-restaurant');
const REQUEST: RouteRequest = {
  origin: { latitude: 40.81, longitude: -73.95 },
  destination: { name: 'x', coordinate: { latitude: 40.8086, longitude: -73.9445 } },
  mode: 'walking',
};

function harness() {
  const clock = createManualClock(T0);
  const pending: { signal: AbortSignal | undefined; d: ReturnType<typeof deferred<RouteResponse>> }[] = [];
  const provider: RouteProvider = {
    id: 'mapbox',
    supportedModes: ['walking'],
    getRoutes(_request, options) {
      const d = deferred<RouteResponse>();
      pending.push({ signal: options?.signal, d });
      options?.signal?.addEventListener('abort', () => d.reject(new RouteProviderError('aborted', 'mapbox', 'aborted')));
      return d.promise;
    },
  };
  const events: string[] = [];
  const controller = createRerouteController({
    provider,
    config: DEFAULT_NAVIGATION_CONFIG.reroute,
    now: clock.now,
    schedule: clock.schedule,
    callbacks: {
      onStart: (n) => events.push(`start ${n}`),
      onResponse: (r, n) => events.push(`response ${n} ${r.kind}`),
      onFailure: (e, n) => events.push(`failure ${n} ${e.kind}`),
    },
  });
  const ok: RouteResponse = { kind: 'routes', provider: 'mapbox', routes: [ROUTE] };
  return { clock, pending, controller, events, ok };
}

describe('createRerouteController', () => {
  it('coalesces a burst of triggers into one request after the debounce', () => {
    const h = harness();
    h.controller.request(() => REQUEST);
    h.clock.advance(300);
    h.controller.request(() => REQUEST);
    h.controller.request(() => REQUEST);
    h.clock.advance(699);
    assert.equal(h.pending.length, 0);
    h.clock.advance(1);
    assert.equal(h.pending.length, 1);
    assert.deepEqual(h.events, ['start 1']);
  });

  it('keeps at least eight seconds between requests', () => {
    const h = harness();
    h.controller.request(() => REQUEST);
    h.clock.advance(1000);
    h.controller.request(() => REQUEST); // first request started at T0+1000
    h.clock.advance(7999);
    assert.equal(h.pending.length, 1);
    h.clock.advance(1); // T0+9000: eight seconds after the first start
    assert.equal(h.pending.length, 2);
  });

  it('aborts the in-flight request when a newer one starts, and drops its late result', async () => {
    const h = harness();
    h.controller.request(() => REQUEST);
    h.clock.advance(1000);
    h.controller.request(() => REQUEST);
    h.clock.advance(8000);
    assert.equal(h.pending.length, 2);
    assert.ok(h.pending[0]!.signal?.aborted);
    h.pending[0]!.d.resolve(h.ok); // too late; already aborted
    h.pending[1]!.d.resolve(h.ok);
    await flush();
    assert.deepEqual(h.events, ['start 1', 'start 2', 'response 2 routes']);
  });

  it('cancel() drops the pending timer and aborts the request in flight', async () => {
    const h = harness();
    h.controller.request(() => REQUEST);
    h.clock.advance(1000);
    assert.ok(h.controller.isBusy);
    h.controller.cancel();
    assert.ok(h.pending[0]!.signal?.aborted);
    assert.ok(!h.controller.isBusy);
    h.controller.request(() => REQUEST);
    h.controller.cancel();
    assert.equal(h.clock.pendingTimers, 0);
    await flush();
    assert.deepEqual(h.events, ['start 1']);
  });

  it('reports provider failures but never cancellations', async () => {
    const h = harness();
    h.controller.request(() => REQUEST);
    h.clock.advance(1000);
    h.pending[0]!.d.reject(new RouteProviderError('rate-limited', 'mapbox', 'slow down', 429));
    await flush();
    assert.deepEqual(h.events, ['start 1', 'failure 1 rate-limited']);
  });

  it('turns a request builder that throws into an invalid-request failure', () => {
    const h = harness();
    h.controller.request(() => {
      throw new Error('No position to reroute from');
    });
    h.clock.advance(1000);
    assert.deepEqual(h.events, ['start 1', 'failure 1 invalid-request']);
  });
});
