import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReactVisionSpatialBridge } from '@mapbox/react-native-mapbox-ar-reactvision/src/bridge.ts';
import type { GeospatialAnchorResult, GeospatialEnableResult } from '@mapbox/react-native-mapbox-ar-reactvision/src/types.ts';
import { observeEarthPose, startGeospatialPolling, withGeospatialAnchors, type EarthPose } from './navArGeospatial.ts';
import { placementConfidence } from './navAr.ts';
import { NAVIGATION_AR_BUILD, type NavigationArBuild } from './navArBuild.ts';

const pose: EarthPose = { latitude: 40.81, longitude: -73.95, altitude: 50,
  horizontalAccuracy: 15, orientationYawAccuracy: 19.6, verticalAccuracy: 8 };
const request = { mode: 'wgs84', coordinate: { latitude: 40.81, longitude: -73.95, altitude: 48.6 } } as const;
const anchor = (id: string): GeospatialAnchorResult => ({ success: true,
  anchor: { anchorId: id, position: [0, 0, id === 'b' ? -15 : 0] } });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('Earth pose accuracy boundary', () => {
  it('keeps ARCore 68% radii/yaw unchanged, avoiding a false high-confidence result', () => {
    const observed = observeEarthPose(pose, 1000, 1050)!;
    assert.equal(observed.horizontalAccuracy, 15);
    assert.equal(observed.orientationYawAccuracy, 19.6);
    assert.equal(placementConfidence(observed.orientationYawAccuracy, observed.horizontalAccuracy), 'medium');
    assert.equal(observed.observedAtMs, 1000, 'does not stamp an old reply with receipt time');
  });
  it('rejects late, backwards-clock, nonfinite, out-of-range and invalid accuracy replies', () => {
    assert.equal(observeEarthPose(pose, 1000, 2001), undefined);
    assert.equal(observeEarthPose(pose, 1000, 999), undefined);
    for (const bad of [{ latitude: 91 }, { longitude: -181 }, { altitude: NaN }, { horizontalAccuracy: 0 },
      { horizontalAccuracy: -1 }, { verticalAccuracy: Infinity }, { orientationYawAccuracy: 0 }, { orientationYawAccuracy: 181 }]) {
      assert.equal(observeEarthPose({ ...pose, ...bad }, 1000, 1000), undefined, JSON.stringify(bad));
    }
    assert.ok(observeEarthPose(pose, 1000, 2000), 'boundary is inclusive');
  });
});

describe('temporary anchor ownership', () => {
  it('releases the first anchor when creation of the second throws', async () => {
    const removed: string[] = [];
    let creates = 0;
    await assert.rejects(withGeospatialAnchors({
      bridge: { createAnchor: async () => { if (creates++ === 0) return anchor('a'); throw Error('second failed'); },
        removeAnchor: (id) => { removed.push(id); } },
      requests: [request, request], isCurrent: () => true, use: () => assert.fail('must not solve'),
    }), /second failed/);
    assert.deepEqual(removed, ['a']);
  });
  it('releases a late first anchor without creating a second after cancellation', async () => {
    const pending = deferred<GeospatialAnchorResult>();
    const removed: string[] = [];
    let active = true;
    let creates = 0;
    const result = withGeospatialAnchors({
      bridge: { createAnchor: () => { creates++; return pending.promise; }, removeAnchor: (id) => { removed.push(id); } },
      requests: [request, request], isCurrent: () => active, use: () => assert.fail('cancelled'),
    });
    active = false;
    pending.resolve(anchor('a'));
    assert.equal(await result, undefined);
    assert.equal(creates, 1);
    assert.deepEqual(removed, ['a']);
  });
  it('releases both after route/recalibration changes while the second is pending', async () => {
    const pending = deferred<GeospatialAnchorResult>();
    const removed: string[] = [];
    let active = true;
    let creates = 0;
    const result = withGeospatialAnchors({
      bridge: { createAnchor: async () => creates++ === 0 ? anchor('a') : pending.promise,
        removeAnchor: (id) => { removed.push(id); } },
      requests: [request, request], isCurrent: () => active, use: () => assert.fail('old route'),
    });
    await flush();
    active = false;
    pending.resolve(anchor('b'));
    await result;
    assert.deepEqual(removed, ['a', 'b']);
  });
  it('attempts every removal even if the first throws, and releases on solve failure', async () => {
    const removed: string[] = [];
    let creates = 0;
    await assert.rejects(withGeospatialAnchors({
      bridge: { createAnchor: async () => anchor(creates++ === 0 ? 'a' : 'b'),
        removeAnchor: (id) => { removed.push(id); if (id === 'a') throw Error('teardown'); } },
      requests: [request, request], isCurrent: () => true, use: () => { throw Error('solve'); },
    }), /solve/);
    assert.deepEqual(removed, ['a', 'b']);
  });
  it('cleans up handles attached to failed results and invalid positions', async () => {
    for (const bad of [{ ...anchor('a'), success: false }, { success: true, anchor: { anchorId: 'a', position: [NaN, 0, 0] as [number, number, number] } }]) {
      const removed: string[] = [];
      await withGeospatialAnchors({ bridge: { createAnchor: async () => bad, removeAnchor: (id) => { removed.push(id); } },
        requests: [request, request], isCurrent: () => true, use: () => assert.fail('invalid anchor') });
      assert.deepEqual(removed, ['a']);
    }
  });
});

function pollingHarness(over: Partial<Parameters<typeof startGeospatialPolling>[0]> = {}) {
  const events: string[] = [];
  let now = 1000;
  const bridge: Parameters<typeof startGeospatialPolling>[0]['bridge'] = {
    enableGeospatial: async () => ({ kind: 'enabled' }), disableGeospatial: () => { events.push('disable'); },
    getCameraPose: async () => ({ ...pose, heading: 0, headingAccuracy: 5, quaternion: [0, 0, 0, 1] }),
  };
  const input = { build: { provider: 'arcore', earth: 'arcore-configured' } as NavigationArBuild, navigator: {}, bridge, getEarthTrackingState: async () => ({ state: 'Enabled' }),
    canPoll: () => true, getGeneration: () => 0, now: () => now, onStatus: (s: string) => { events.push(s); },
    onUnavailable: () => { events.push('unavailable'); }, onPose: () => { events.push('pose'); },
    schedule: () => () => { events.push('unschedule'); }, ...over };
  return { input, events, setNow: (value: number) => { now = value; } };
}

describe('geospatial scene lifecycle', () => {
  it('does no Earth native work in the current unconfigured ReactVision build', async () => {
    const h = pollingHarness({ build: NAVIGATION_AR_BUILD });
    h.input.bridge.enableGeospatial = async () => assert.fail('must not probe or enable Earth');
    h.input.bridge.getCameraPose = async () => assert.fail('must not read or ingest Earth fixes');
    h.input.getEarthTrackingState = async () => assert.fail('must not read Earth state');
    const life = startGeospatialPolling(h.input);
    await life.ready;
    await life.poll();
    life.stop();
    assert.deepEqual(h.events, ['unavailable']);
  });
  it('requires both matching provider and explicit native-build configuration', async () => {
    for (const build of [{ provider: 'arcore', earth: 'unconfigured' }, { provider: 'reactvision', earth: 'arcore-configured' }] satisfies NavigationArBuild[]) {
      const h = pollingHarness({ build });
      h.input.bridge.enableGeospatial = async () => assert.fail('not configured');
      const life = startGeospatialPolling(h.input);
      await life.ready;
      assert.deepEqual(h.events, ['unavailable']);
      life.stop();
    }
  });
  it('never overlaps pose requests and ignores replies after unmount', async () => {
    const pending = deferred<Awaited<ReturnType<ReactVisionSpatialBridge['getCameraPose']>>>();
    const h = pollingHarness();
    let reads = 0;
    h.input.bridge.getCameraPose = () => { reads++; return pending.promise; };
    const life = startGeospatialPolling(h.input);
    await life.ready;
    await flush();
    await life.poll();
    assert.equal(reads, 1);
    life.stop();
    pending.resolve({ ...pose, heading: 0, headingAccuracy: 5, quaternion: [0, 0, 0, 1] });
    await flush();
    assert.deepEqual(h.events, ['available', 'unschedule', 'disable']);
  });
  it('discards an in-flight pose when recalibration changes its generation', async () => {
    const pending = deferred<Awaited<ReturnType<ReactVisionSpatialBridge['getCameraPose']>>>();
    let generation = 1;
    const h = pollingHarness({ getGeneration: () => generation });
    h.input.bridge.getCameraPose = () => pending.promise;
    const life = startGeospatialPolling(h.input);
    await life.ready;
    await flush();
    generation++;
    pending.resolve({ ...pose, heading: 0, headingAccuracy: 5, quaternion: [0, 0, 0, 1] });
    await flush();
    assert.deepEqual(h.events, ['available']);
    life.stop();
  });
  it('disables a late enable before a remount on the same navigator enables', async () => {
    const pending = deferred<GeospatialEnableResult>();
    const h = pollingHarness({ canPoll: () => false });
    let attempts = 0;
    h.input.bridge.enableGeospatial = async () => {
      h.events.push(`enable${++attempts}`);
      return attempts === 1 ? pending.promise : { kind: 'enabled' };
    };
    const first = startGeospatialPolling(h.input);
    await flush();
    first.stop();
    const second = startGeospatialPolling(h.input);
    assert.deepEqual(h.events, ['enable1']);
    pending.resolve({ kind: 'enabled' });
    await Promise.all([first.ready, second.ready]);
    assert.deepEqual(h.events.slice(0, 4), ['enable1', 'disable', 'enable2', 'available']);
    second.stop();
  });
  it('does not read poses when Earth is paused or the camera is stale', async () => {
    for (const over of [{ getEarthTrackingState: async () => ({ state: 'Paused' }) }, { canPoll: () => false }]) {
      const h = pollingHarness(over);
      h.input.bridge.getCameraPose = async () => assert.fail('must not read pose');
      const life = startGeospatialPolling(h.input);
      await life.ready;
      await flush();
      assert.ok(h.events.includes('unavailable'));
      life.stop();
    }
  });
  it('rejects a slow native reply instead of making it fresh on receipt', async () => {
    const h = pollingHarness();
    h.input.bridge.getCameraPose = async () => { h.setNow(2001); return { ...pose, heading: 0, headingAccuracy: 5, quaternion: [0, 0, 0, 1] }; };
    const life = startGeospatialPolling(h.input);
    await life.ready;
    await flush();
    assert.deepEqual(h.events, ['available', 'unavailable']);
    life.stop();
  });
  it('recovers on a later poll after an Earth read fails', async () => {
    let attempts = 0;
    const h = pollingHarness({ getEarthTrackingState: async () => { if (attempts++ === 0) throw Error('localizing'); return { state: 'Enabled' }; } });
    const life = startGeospatialPolling(h.input);
    await life.ready;
    await flush();
    await life.poll();
    assert.deepEqual(h.events, ['available', 'unavailable', 'pose']);
    life.stop();
  });
});
