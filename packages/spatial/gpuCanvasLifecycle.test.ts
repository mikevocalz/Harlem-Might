import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGpuCanvasHost, deferred, flush } from './testing/gpuCanvasHost.ts';

for (const kind of ['lightcycle', 'sightline'] as const) {
  for (const platform of ['web', 'native'] as const) {
    const name = `${kind} ${platform}`;
    test(`${name}: rejected init releases resources without an unhandled rejection`, async (t) => {
      const host = createGpuCanvasHost(kind, platform);
      t.after(() => { host.unmount(); host.restore(); });
      const failures: string[] = [];
      host.setInit(async () => { throw new Error('backend init failed'); });
      host.render({ onUnavailable: (reason: string) => failures.push(reason) });
      await flush();
      assert.equal(host.instances.length, 1);
      assert.equal(host.instances[0]!.disposed, 1);
      assert.equal(host.instances[0]!.activations, 0);
      assert.equal(host.nativeDevice.destroyed, 0, 'native device is borrowed');
      if (platform === 'web') assert.equal(host.devices[0]!.destroyed, 1);
      if (kind === 'sightline' && platform === 'web') assert.deepEqual(failures, ['init-failed']);
      host.unmount();
      await flush();
      assert.equal(host.instances[0]!.disposed, 1, 'unmount does not repeat failed-session disposal');
    });

    for (const outcome of ['resolve', 'reject'] as const) {
      test(`${name}: unmount waits for pending init to ${outcome}, then releases once`, async (t) => {
        const host = createGpuCanvasHost(kind, platform);
        t.after(() => { host.unmount(); host.restore(); });
        const pending = deferred();
        host.setInit(() => pending.promise);
        const failures: string[] = [];
        let ready = 0;
        host.render({ onUnavailable: (reason: string) => failures.push(reason), onReady: () => ready++ });
        await flush();
        const renderer = host.instances[0]!;
        host.unmount();
        assert.equal(renderer.disposed, 0, 'init can still allocate; disposal must wait');
        if (outcome === 'resolve') pending.resolve();
        else pending.reject(new Error('late init failure'));
        await flush();
        assert.equal(renderer.disposed, 1);
        assert.equal(renderer.liveAllocation, false);
        assert.equal(renderer.activations, 0);
        assert.equal(host.nativeDevice.destroyed, 0);
        if (platform === 'web') assert.equal(host.devices[0]!.destroyed, 1);
        assert.deepEqual(failures, []);
        assert.equal(ready, 0);
      });
    }

    test(`${name}: replacement waits for old startup and async disposal`, async (t) => {
      const host = createGpuCanvasHost(kind, platform);
      t.after(() => { host.unmount(); host.restore(); });
      const firstInit = deferred();
      const firstDispose = deferred();
      host.setInit(() => firstInit.promise);
      host.setDispose(() => firstDispose.promise);
      host.render({ getState: () => null, getProgress: () => 0 });
      await flush();
      const old = host.instances[0]!;
      host.setInit(async () => {});
      host.setDispose(async () => {});
      host.render({ getState: () => ({ version: 2 }), getProgress: () => 1 });
      await flush();
      assert.equal(host.instances.length, 1, 'two initializers must not race on one surface');
      firstInit.resolve();
      await flush();
      assert.equal(old.disposed, 1);
      assert.equal(host.instances.length, 1, 'renderer disposal can itself be asynchronous');
      firstDispose.resolve();
      await flush();
      assert.equal(host.instances.length, 2);
      assert.equal(old.liveAllocation, false);
      assert.equal(old.activations, 0);
      assert.equal(host.instances[1]!.disposed, 0);
      assert.equal(host.instances[1]!.liveAllocation, true);
      assert.equal(host.instances[1]!.activations, 1);
      host.unmount();
      await flush();
      assert.equal(host.instances[1]!.disposed, 1);
      assert.equal(host.nativeDevice.destroyed, 0);
      if (platform === 'web') assert.deepEqual(host.devices.map((device) => device.destroyed), [1, 1]);
    });

    test(`${name}: successful startup preserves rendering, sizes and asset arguments`, async (t) => {
      const host = createGpuCanvasHost(kind, platform);
      t.after(() => { host.unmount(); host.restore(); });
      const state = { version: 1 };
      const getState = () => state;
      const getProgress = () => 0.7;
      host.render({ state, getState, getProgress, assetUri: '/bike.glb', mcpAssetUri: '/head.glb', reducedMotion: true });
      await flush();
      const renderer = host.instances[0]!;
      const dpr = kind === 'sightline' ? 2 : 3;
      assert.equal(host.surface.width, 100 * dpr);
      assert.equal(host.surface.height, 50 * dpr);
      assert.equal(renderer.options.device, platform === 'web' ? host.devices[0] : host.nativeDevice);
      if (kind === 'lightcycle') {
        assert.deepEqual(renderer.initArgs, ['/bike.glb', '/head.glb']);
        renderer.loop!(25);
        assert.deepEqual(renderer.frames, [[state, 25]]);
      } else if (platform === 'web') {
        assert.equal(renderer.activations, 0, 'web reduced motion draws one frame');
        assert.equal(renderer.frames.length, 1);
        assert.equal(renderer.frames[0]![1], true);
        assert.deepEqual(renderer.progress, [0.7]);
        host.surface.clientWidth = 150;
        host.observers[0]!.callback();
        assert.equal(renderer.frames.length, 2);
        assert.deepEqual(renderer.sizes.at(-1), [300, 100]);
      } else {
        renderer.loop!(25);
        assert.deepEqual(renderer.frames, [[25, true]]);
        assert.deepEqual(renderer.progress, [0.7]);
      }
      const staleFrame = renderer.loop;
      host.unmount();
      await flush();
      const frameCount = renderer.frames.length;
      staleFrame?.(30);
      assert.equal(renderer.frames.length, frameCount, 'a queued callback cannot render after unmount');
      assert.equal(renderer.disposed, 1);
      if (platform === 'web') assert.equal(host.observers[0]!.disconnected, 1);
    });
  }

  for (const stage of ['adapter', 'device', 'context', 'configure', 'observer'] as const) {
    test(`${kind} web: ${stage} startup failure is contained and releases acquired resources`, async (t) => {
      const host = createGpuCanvasHost(kind, 'web');
      t.after(() => { host.unmount(); host.restore(); });
      if (stage === 'adapter') host.gpu.requestAdapter = async () => { throw new Error('adapter rejected'); };
      if (stage === 'device') host.adapter.requestDevice = async () => { throw new Error('device rejected'); };
      if (stage === 'context') host.setMissingContext(true);
      if (stage === 'configure') host.setConfigureError(true);
      if (stage === 'observer') host.setObserverError(true);
      const failures: string[] = [];
      host.render({ onUnavailable: (reason: string) => failures.push(reason) });
      await flush();
      for (const device of host.devices) assert.equal(device.destroyed, 1);
      for (const renderer of host.instances) assert.equal(renderer.disposed, 1);
      for (const observer of host.observers) assert.equal(observer.disconnected, 1);
      if (kind === 'sightline') assert.deepEqual(failures, [stage === 'context' ? 'no-context' : 'init-failed']);
    });
  }

  test(`${kind} web: a device returned after unmount is released without constructing a renderer`, async (t) => {
    const host = createGpuCanvasHost(kind, 'web');
    t.after(() => { host.unmount(); host.restore(); });
    const device = await host.adapter.requestDevice();
    const pending = deferred<typeof device>();
    host.adapter.requestDevice = () => pending.promise;
    host.render();
    await flush();
    host.unmount();
    pending.resolve(device);
    await flush();
    assert.equal(device.destroyed, 1);
    assert.equal(host.instances.length, 0);
    assert.equal(host.configureCalls.length, 0);
  });
}

for (const duringInit of [false, true]) {
  test(`sightline web: device loss ${duringInit ? 'during' : 'after'} init closes ownership without waiting for host unmount`, async (t) => {
    const host = createGpuCanvasHost('sightline', 'web');
    t.after(() => { host.unmount(); host.restore(); });
    const pending = deferred();
    if (duringInit) host.setInit(() => pending.promise);
    let ready = 0;
    const failures: string[] = [];
    host.render({ onReady: () => ready++, onUnavailable: (reason: string) => failures.push(reason) });
    await flush();
    const renderer = host.instances[0]!;
    host.devices[0]!.lose({ reason: 'unknown' });
    await flush();
    assert.deepEqual(failures, ['device-lost']);
    if (duringInit) pending.resolve();
    await flush();
    assert.equal(renderer.disposed, 1);
    assert.equal(renderer.liveAllocation, false);
    assert.equal(renderer.loop, null);
    assert.equal(ready, duringInit ? 0 : 1);
    assert.equal(host.devices[0]!.destroyed, 1);
    host.unmount();
    await flush();
    assert.deepEqual(failures, ['device-lost']);
    assert.equal(renderer.disposed, 1);
  });
}

test('sightline web: callback changes keep the device and use the latest callback', async (t) => {
  const host = createGpuCanvasHost('sightline', 'web');
  t.after(() => { host.unmount(); host.restore(); });
  const calls: string[] = [];
  host.render({ onUnavailable: () => calls.push('old') });
  await flush();
  host.render({ onUnavailable: () => calls.push('new') });
  await flush();
  assert.equal(host.instances.length, 1);
  host.devices[0]!.lose({ reason: 'unknown' });
  await flush();
  assert.deepEqual(calls, ['new']);
});

for (const kind of ['lightcycle', 'sightline'] as const) {
  for (const platform of ['web', 'native'] as const) {
    test(`${kind} ${platform}: animation-loop setup rejection follows startup cleanup`, async (t) => {
      const host = createGpuCanvasHost(kind, platform);
      t.after(() => { host.unmount(); host.restore(); });
      const pending = deferred();
      host.setInit(() => pending.promise);
      host.render();
      await flush();
      const renderer = host.instances[0]!;
      renderer.renderer.setAnimationLoop = async () => { throw new Error('loop setup failed'); };
      pending.resolve();
      await flush();
      assert.equal(renderer.disposed, 1);
      assert.equal(host.nativeDevice.destroyed, 0);
      if (platform === 'web') assert.equal(host.devices[0]!.destroyed, 1);
    });
  }

  test(`${kind} web: teardown failure still releases the browser-owned device`, async (t) => {
    const host = createGpuCanvasHost(kind, 'web');
    t.after(() => { host.unmount(); host.restore(); });
    host.setDispose(async () => { throw new Error('backend teardown failed'); });
    host.render();
    await flush();
    host.unmount();
    await flush();
    assert.equal(host.instances[0]!.disposed, 1);
    assert.equal(host.devices[0]!.destroyed, 1);
    assert.equal(host.warnings.length, 1);
    assert.equal(host.warnings[0]![0], 'GPU canvas cleanup failed');
  });

  test(`${kind} web: a late adapter does not request a device after unmount`, async (t) => {
    const host = createGpuCanvasHost(kind, 'web');
    t.after(() => { host.unmount(); host.restore(); });
    const pending = deferred<typeof host.adapter>();
    host.gpu.requestAdapter = () => pending.promise;
    host.render();
    await flush();
    host.unmount();
    pending.resolve(host.adapter);
    await flush();
    assert.equal(host.devices.length, 0);
    assert.equal(host.instances.length, 0);
  });
}

for (const platform of ['web', 'native'] as const) {
  test(`lightcycle ${platform}: callback changes keep the renderer and notify the current consumer`, async (t) => {
    const host = createGpuCanvasHost('lightcycle', platform);
    t.after(() => { host.unmount(); host.restore(); });
    const calls: string[] = [];
    host.render({ onUnavailable: () => calls.push('old') });
    await flush();
    host.render({ onUnavailable: () => calls.push('new') });
    await flush();
    assert.equal(host.instances.length, 1);
    const device = platform === 'web' ? host.devices[0]! : host.nativeDevice;
    device.lose({ reason: 'unknown' });
    await flush();
    assert.deepEqual(calls, ['new']);
  });
}

test('lightcycle web: missing WebGPU immediately notifies its consumer', (t) => {
  const host = createGpuCanvasHost('lightcycle', 'web');
  t.after(() => { host.unmount(); host.restore(); });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  const calls: string[] = [];
  host.render({ onUnavailable: (reason: string) => calls.push(reason) });
  assert.deepEqual(calls, ['no-webgpu']);
  assert.equal(host.instances.length, 0);
});
