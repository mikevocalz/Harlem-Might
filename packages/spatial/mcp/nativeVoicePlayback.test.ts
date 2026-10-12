import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, type TestContext } from 'node:test';
import { ModuleKind, transpileModule } from 'typescript';
import * as audioCore from '../audio/SpatialAudioEngineCore.ts';
import type { AudioContextLifecycle } from '../audio/SpatialAudioEngineCore.ts';
import { createLightCycleMatch, type LightCycleMatchState } from '../lightcycle/tabletopCore.ts';
import { deriveMcpVoiceCue, type McpVoiceCueName } from './mcpVoice.ts';

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const buffer = { id: 'decoded-audio', duration: 1, numberOfChannels: 1 };
type Sources = Partial<Record<McpVoiceCueName, number | { uri: string }>>;
const assets = (): Sources => ({
  'race-start': { uri: 'https://assets.invalid/start.wav' },
  'match-end': { uri: 'https://assets.invalid/end.wav' },
});

function loadModule(file: URL, modules: Record<string, unknown>) {
  const compiled = transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  const exports: Record<string, unknown> = {};
  new Function('require', 'exports', compiled.outputText)((id: string) => {
    assert.ok(id in modules, `Unexpected production import: ${id}`);
    return modules[id];
  }, exports);
  return exports;
}

// The real native adapter and shared core run here; only the native SDK graph
// and React hook scheduler are simulated. No native rendering/device claim.
function harness(t: TestContext, failures: string[] = []) {
  const fail = new Set(failures);
  const calls: string[] = [];
  const warnings: unknown[][] = [];
  const contexts: MockContext[] = [];
  const sources: MockSource[] = [];
  const gains: MockNode[] = [];
  const decodes: (string | number)[] = [];
  const decodeQueue: Promise<typeof buffer>[] = [];
  const controls = { resume: Promise.resolve() };
  t.mock.method(console, 'warn', (...values: unknown[]) => { warnings.push(values); });
  const check = (stage: string) => {
    calls.push(stage);
    if (fail.has(stage)) throw new Error(`Private native failure: ${stage}`);
  };

  class MockNode {
    disconnects = 0;
    connections: MockNode[] = [];
    kind: string;
    constructor(kind: string) { this.kind = kind; }
    connect(node: MockNode) {
      check(`connect-${this.kind}`);
      this.connections.push(node);
    }
    disconnect() {
      this.disconnects += 1;
      check(`disconnect-${this.kind}`);
      this.connections = [];
    }
  }
  class MockSource extends MockNode {
    starts = 0;
    stops = 0;
    loop = false;
    ended: (() => void) | null = null;
    private audioBuffer: typeof buffer | null = null;
    set buffer(value: typeof buffer | null) { check('buffer'); this.audioBuffer = value; }
    get buffer() { return this.audioBuffer; }
    set onended(callback: (() => void) | null) {
      check(callback ? 'listener' : 'clear-listener');
      this.ended = callback;
    }
    get onended() { return this.ended; }
    start() { this.starts += 1; check('start'); }
    stop() { this.stops += 1; check('stop'); this.ended?.(); }
  }
  class MockContext implements AudioContextLifecycle {
    currentTime = 42;
    state: AudioContextLifecycle['state'] = 'running';
    destination = new MockNode('destination');
    listener = {
      positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 },
      forwardX: { value: 0 }, forwardY: { value: 0 }, forwardZ: { value: -1 },
      upX: { value: 0 }, upY: { value: 1 }, upZ: { value: 0 },
    };
    constructor() { check('context'); contexts.push(this); }
    async decodeAudioData(source: string | number) {
      decodes.push(source);
      check('decode');
      return decodeQueue.shift() ?? buffer;
    }
    createBufferSource() {
      check('source');
      const source = new MockSource('source');
      sources.push(source);
      return source;
    }
    createGain() {
      check('gain');
      const gain = Object.assign(new MockNode('gain'), { gain: { value: 1 } });
      gains.push(gain);
      return gain;
    }
    createPanner() { throw new Error('Ambient voice must not allocate a panner.'); }
    async resume() { check('resume'); await controls.resume; this.state = 'running'; }
    async suspend() { check('suspend'); this.state = 'suspended'; }
    async close() { check('close'); this.state = 'closed'; }
  }
  const native = loadModule(new URL('../audio/SpatialAudioEngine.native.ts', import.meta.url), {
    'react-native-audio-api': { AudioContext: MockContext },
    './SpatialAudioEngineCore.ts': audioCore,
  });
  const engine = native.spatialAudio as audioCore.SpatialAudioEngineCore<typeof buffer, MockContext>;
  t.after(() => { fail.clear(); return engine.close(); });
  return { engine, calls, warnings, fail, contexts, sources, gains, decodes, decodeQueue, controls };
}

let nextId = 0;
function componentFixture(h: ReturnType<typeof harness>) {
  type Effect = { deps: unknown[]; callback: () => (() => void) | undefined; cleanup?: () => void };
  const effects: Effect[] = [];
  const refs: { current: unknown }[] = [];
  let effectIndex = 0;
  let refIndex = 0;
  let pending: (() => void)[] = [];
  const id = `test-${nextId++}`;
  const module = loadModule(new URL('./McpVoicePlayback.native.tsx', import.meta.url), {
    react: {
      useId: () => id,
      useRef(value: unknown) { return refs[refIndex++] ??= { current: value }; },
      useEffect(callback: Effect['callback'], deps: unknown[]) {
        const index = effectIndex++;
        const previous = effects[index];
        if (previous && deps.length === previous.deps.length
          && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
        pending.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps, callback, cleanup: callback() };
        });
      },
    },
    '../audio/SpatialAudioEngine.native': { spatialAudio: h.engine },
    './mcpVoice': { deriveMcpVoiceCue },
  });
  const component = module.McpVoicePlaybackNative as (props: unknown) => null;
  return {
    render(state: LightCycleMatchState | null, enabled = true, sources = assets()) {
      effectIndex = refIndex = 0;
      pending = [];
      assert.equal(component({ state, enabled, sources }), null);
      pending.forEach((effect) => effect());
    },
    outcomes() { return refs[0]!.current as Map<string, 'played' | 'failed'>; },
    reattachEffects() {
      effects.forEach((effect) => effect.cleanup?.());
      effects.forEach((effect) => { effect.cleanup = effect.callback(); });
    },
    unmount() { effects.forEach((effect) => effect.cleanup?.()); },
  };
}

describe('native MCP component with the shared audio engine', () => {
  it('does not cancel decoding on race ticks or equivalent asset object recreation', async (t) => {
    const h = harness(t);
    const component = componentFixture(h);
    const decode = Promise.withResolvers<typeof buffer>();
    h.decodeQueue.push(decode.promise);
    const state = createLightCycleMatch();
    component.render(state);
    await settle();
    component.render({ ...state, tick: 1, countdownTicks: state.countdownTicks - 1 });
    component.render({ ...state, tick: 2, countdownTicks: state.countdownTicks - 2 });
    assert.equal(h.decodes.length, 1);
    assert.equal(component.outcomes().size, 0);
    decode.resolve(buffer);
    await settle();
    assert.equal(h.sources.length, 1);
    assert.equal(h.sources[0]!.starts, 1);
    assert.equal(component.outcomes().get('race-start:1'), 'played');
    component.render({ ...state, tick: 3, countdownTicks: 120 });
    await settle();
    assert.equal(h.sources[0]!.stops, 0, 'started speech survives the cue window expiring');
    h.sources[0]!.onended!();
    await settle();
    assert.equal(h.sources[0]!.onended, null);
    assert.equal(h.sources[0]!.disconnects, 1);
    assert.equal(h.gains[0]!.disconnects, 1);
    assert.equal(h.contexts[0]!.state, 'suspended');
    component.render(state);
    await settle();
    assert.equal(h.sources.length, 1, 'successful cue is consumed');
    component.unmount();
    assert.ok(!h.calls.includes('close'), 'the component must not close the shared engine');
  });

  for (const interruption of ['disable', 'null-state', 'unmount'] as const) {
    for (const late of ['resolve', 'reject'] as const) {
      it(`${interruption} suppresses late decode ${late} without consuming the cue`, async (t) => {
        const h = harness(t);
        const component = componentFixture(h);
        const decode = Promise.withResolvers<typeof buffer>();
        h.decodeQueue.push(decode.promise);
        const state = createLightCycleMatch();
        component.render(state);
        await settle();
        if (interruption === 'disable') component.render(state, false);
        else if (interruption === 'null-state') component.render(null);
        else component.unmount();
        if (late === 'resolve') decode.resolve(buffer);
        else decode.reject(new Error('Private late decode failure'));
        await settle();
        assert.equal(h.sources.length, 0);
        assert.equal(component.outcomes().size, 0);
        assert.deepEqual(h.warnings, []);
        assert.equal(h.contexts[0]!.state, 'suspended');
        assert.ok(!h.calls.includes('close'));
        if (interruption !== 'unmount') {
          component.render(state);
          await settle();
          assert.equal(component.outcomes().get('race-start:1'), 'played');
          assert.equal(h.decodes.length, 2, 'disabled owner unloads its buffer');
          component.unmount();
        }
      });
    }
  }

  for (const replacement of ['cue', 'asset'] as const) {
    for (const late of ['resolve', 'reject'] as const) {
      it(`${replacement} replacement survives the previous decode's late ${late}`, async (t) => {
        const h = harness(t);
        const component = componentFixture(h);
        const decode = Promise.withResolvers<typeof buffer>();
        h.decodeQueue.push(decode.promise);
        const state = createLightCycleMatch();
        component.render(state);
        await settle();
        if (replacement === 'cue') component.render({ ...state, phase: 'match-over', matchWinner: 'p1' });
        else component.render(state, true, { 'race-start': { uri: 'replacement.wav' } });
        await settle();
        if (late === 'resolve') decode.resolve(buffer);
        else decode.reject(new Error('Private stale failure'));
        await settle();
        assert.equal(h.sources.length, 1);
        assert.equal(h.sources[0]!.starts, 1);
        assert.equal(h.sources[0]!.stops, 0);
        assert.equal(component.outcomes().get(replacement === 'cue' ? 'match-end:1:p1' : 'race-start:1'), 'played');
        if (replacement === 'cue') assert.equal(component.outcomes().has('race-start:1'), false);
        assert.deepEqual(h.warnings, []);
        component.unmount();
      });
    }
  }

  it('a new cue stops and disconnects the previously started line', async (t) => {
    const h = harness(t);
    const component = componentFixture(h);
    const state = createLightCycleMatch();
    component.render(state);
    await settle();
    component.render({ ...state, phase: 'match-over', matchWinner: 'p1' });
    await settle();
    assert.equal(h.sources.length, 2);
    assert.equal(h.sources[0]!.stops, 1);
    assert.equal(h.sources[0]!.disconnects, 1);
    assert.equal(h.gains[0]!.disconnects, 1);
    assert.equal(h.sources[1]!.starts, 1);
    component.unmount();
  });

  it('a cancelled cue can reappear before its original decode finishes', async (t) => {
    const h = harness(t);
    const component = componentFixture(h);
    const decode = Promise.withResolvers<typeof buffer>();
    h.decodeQueue.push(decode.promise);
    const state = createLightCycleMatch();
    component.render(state);
    await settle();
    component.render({ ...state, countdownTicks: 120 });
    component.render(state);
    await settle();
    assert.equal(h.decodes.length, 1, 'the shared decoder cache can safely be reused');
    decode.resolve(buffer);
    await settle();
    assert.equal(h.sources.length, 1);
    assert.equal(component.outcomes().get('race-start:1'), 'played');
    component.unmount();
  });

  it('effect reattachment cancels old work and preserves successful-cue suppression', async (t) => {
    const h = harness(t);
    const component = componentFixture(h);
    const decode = Promise.withResolvers<typeof buffer>();
    h.decodeQueue.push(decode.promise);
    component.render(createLightCycleMatch());
    await settle();
    component.reattachEffects();
    await settle();
    decode.resolve(buffer);
    await settle();
    assert.equal(h.contexts.length, 1);
    assert.equal(h.decodes.length, 2);
    assert.equal(h.sources.length, 1);
    assert.equal(component.outcomes().get('race-start:1'), 'played');
    component.reattachEffects();
    await settle();
    assert.equal(h.sources.length, 1);
    assert.equal(h.sources[0]!.stops, 1);
    component.unmount();
  });

  it('cancellation during context resume prevents starting and returns to idle', async (t) => {
    const h = harness(t);
    const component = componentFixture(h);
    const resume = Promise.withResolvers<void>();
    h.controls.resume = resume.promise;
    component.render(createLightCycleMatch());
    await settle();
    assert.ok(h.calls.includes('resume'));
    component.unmount();
    resume.resolve();
    await settle();
    assert.equal(h.sources.length, 0);
    assert.equal(component.outcomes().size, 0);
    assert.equal(h.contexts[0]!.state, 'suspended');
  });

  for (const interruption of ['disable', 'null-state', 'unmount'] as const) {
    it(`${interruption} releases only its own started voice, leaving other owners running`, async (t) => {
      const h = harness(t);
      const component = componentFixture(h);
      const state = createLightCycleMatch();
      component.render(state);
      await settle();
      assert.equal(await h.engine.playAmbient('theme', 'theme.wav', { loop: true }), 'theme');
      if (interruption === 'disable') component.render(state, false);
      else if (interruption === 'null-state') component.render(null);
      else component.unmount();
      await settle();
      assert.equal(h.contexts.length, 1);
      assert.equal(h.contexts[0]!.state, 'running');
      assert.equal(h.sources[0]!.stops, 1);
      assert.equal(h.sources[0]!.disconnects, 1);
      assert.equal(h.gains[0]!.disconnects, 1);
      assert.equal(h.sources[1]!.stops, 0);
      assert.ok(!h.calls.includes('close'));
      component.unmount();
    });
  }

  it('two mounted components have distinct playback keys in one shared context', async (t) => {
    const h = harness(t);
    const one = componentFixture(h);
    const two = componentFixture(h);
    one.render(createLightCycleMatch());
    two.render(createLightCycleMatch());
    await settle();
    assert.equal(h.contexts.length, 1);
    assert.equal(h.sources.length, 2);
    one.unmount();
    assert.equal(h.sources[0]!.stops, 1);
    assert.equal(h.sources[1]!.stops, 0);
    two.unmount();
  });

  it('passes bundled numeric assets through the shared native decoder', async (t) => {
    const h = harness(t);
    const component = componentFixture(h);
    component.render(createLightCycleMatch(), true, { 'race-start': 42 });
    await settle();
    assert.deepEqual(h.decodes, [42]);
    assert.equal(component.outcomes().get('race-start:1'), 'played');
    component.unmount();
  });

  for (const failure of ['context', 'decode', 'resume', 'source', 'gain', 'buffer', 'connect-source', 'connect-gain', 'listener', 'start']) {
    it(`contains ${failure} failure, cleans the partial graph and can play the next cue`, async (t) => {
      const h = harness(t, [failure]);
      const component = componentFixture(h);
      const state = createLightCycleMatch();
      component.render(state);
      await settle();
      assert.equal(component.outcomes().get('race-start:1'), 'failed');
      assert.deepEqual(h.warnings, [['An MCP voice cue could not be played.']]);
      for (const node of [...h.sources, ...h.gains]) assert.equal(node.disconnects, 1);
      if (failure === 'start') assert.equal(h.sources[0]!.stops, 1);
      if (h.contexts.length) assert.equal(h.contexts[0]!.state, 'suspended');
      const requests = h.decodes.length;
      component.render({ ...state, tick: 1 });
      component.render(state, false);
      component.render(state);
      await settle();
      assert.equal(h.decodes.length, requests, 'failed cue does not retry');
      h.fail.clear();
      component.render({ ...state, phase: 'match-over', matchWinner: 'p1' });
      await settle();
      assert.equal(component.outcomes().get('match-end:1:p1'), 'played');
      assert.equal(h.sources.at(-1)!.starts, 1);
      component.unmount();
    });
  }

  for (const failure of ['clear-listener', 'stop', 'disconnect-source', 'disconnect-gain']) {
    it(`contains ${failure} cleanup failure and still releases the remaining graph`, async (t) => {
      const h = harness(t);
      const component = componentFixture(h);
      component.render(createLightCycleMatch());
      await settle();
      h.fail.add(failure);
      component.unmount();
      await settle();
      assert.equal(h.sources[0]!.stops, 1);
      assert.equal(h.sources[0]!.disconnects, 1);
      assert.equal(h.gains[0]!.disconnects, 1);
      assert.equal(h.contexts[0]!.state, 'suspended');
      assert.ok(h.warnings.every((warning) => warning.length === 1
        && warning[0] === 'Spatial audio resources could not disconnect cleanly.'));
      component.unmount();
      assert.equal(h.sources[0]!.disconnects, 1, 'teardown is idempotent');
    });
  }

  it('construction cleanup failure does not hide the original failed cue or skip other nodes', async (t) => {
    const h = harness(t, ['connect-gain', 'disconnect-source']);
    const component = componentFixture(h);
    component.render(createLightCycleMatch());
    await settle();
    assert.equal(component.outcomes().get('race-start:1'), 'failed');
    assert.equal(h.sources[0]!.disconnects, 1);
    assert.equal(h.gains[0]!.disconnects, 1);
    assert.deepEqual(h.warnings, [['An MCP voice cue could not be played.']]);
    component.unmount();
  });
});
