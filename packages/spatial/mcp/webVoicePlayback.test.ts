import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ModuleKind, transpileModule } from 'typescript';
import { createLightCycleMatch, type LightCycleMatchState } from '../lightcycle/tabletopCore.ts';
import * as mcpVoice from './mcpVoice.ts';

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
type Effect = { deps: unknown[]; callback: () => (() => void) | undefined; cleanup?: () => void };
type Props = {
  state: LightCycleMatchState | null;
  enabled?: boolean;
  baseUrl?: string;
  localPlayerId?: 'p1' | 'p2';
};

// This executes the production component and cue derivation. The hook host
// compares dependencies and runs all old cleanups before new effect setups.
// Only browser audio/speech leaves are controlled; no audible/browser claim.
function fixture({ speechAvailable = true } = {}) {
  const audio: ControlledAudio[] = [];
  const spoken: ControlledUtterance[] = [];
  const speaking = new Set<ControlledUtterance>();
  let speechCancels = 0;
  const voices = [{ name: 'Daniel', lang: 'english' }];
  class ControlledUtterance {
    text: string;
    rate = 1;
    pitch = 1;
    volume = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) { this.text = text; }
    finish() { speaking.delete(this); this.onend?.(); }
  }
  class ControlledAudio {
    url: string;
    preload = '';
    volume = 1;
    pauses = 0;
    plays = 0;
    paused = true;
    completion = Promise.withResolvers<void>();
    listeners = new Map<string, Map<() => void, boolean>>();
    captured = new Map<string, (() => void)[]>();
    constructor(url: string) { this.url = url; audio.push(this); }
    play() { this.plays += 1; return this.completion.promise; }
    pause() { this.pauses += 1; this.paused = true; }
    addEventListener(event: string, callback: () => void, options?: { once?: boolean }) {
      const listeners = this.listeners.get(event) ?? new Map<() => void, boolean>();
      listeners.set(callback, options?.once ?? false);
      this.listeners.set(event, listeners);
      this.captured.set(event, [...this.captured.get(event) ?? [], callback]);
    }
    removeEventListener(event: string, callback: () => void) { this.listeners.get(event)?.delete(callback); }
    emit(event: string) {
      for (const [callback, once] of this.listeners.get(event) ?? []) {
        if (once) this.listeners.get(event)?.delete(callback);
        callback();
      }
    }
    start() { this.paused = false; this.emit('playing'); this.completion.resolve(); }
    fail() { this.completion.reject(new Error('controlled playback failure')); }
    finish() { this.paused = true; this.emit('ended'); }
    listenerCount() { return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0); }
  }
  const effects: Effect[] = [];
  const refs: { current: unknown }[] = [];
  let effectIndex = 0;
  let refIndex = 0;
  let pending: { index: number; callback: Effect['callback']; deps: unknown[] }[] = [];
  const modules: Record<string, unknown> = {
    react: {
      useRef(value: unknown) { return refs[refIndex++] ??= { current: value }; },
      useEffect(callback: Effect['callback'], deps: unknown[]) {
        const index = effectIndex++;
        const previous = effects[index];
        if (previous && deps.length === previous.deps.length
          && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
        pending.push({ index, callback, deps });
      },
    },
    './mcpVoice': mcpVoice,
  };
  const compiled = transpileModule(readFileSync(new URL('./McpVoicePlayback.web.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS }, reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  const exports: Record<string, unknown> = {};
  new Function('require', 'exports', 'Audio', 'window', 'SpeechSynthesisUtterance', compiled.outputText)(
    (id: string) => { assert.ok(id in modules, `Unexpected production import: ${id}`); return modules[id]; },
    exports,
    ControlledAudio,
    speechAvailable ? {
      speechSynthesis: {
        cancel() { speechCancels += 1; speaking.clear(); },
        speak(utterance: ControlledUtterance) { spoken.push(utterance); speaking.add(utterance); },
        getVoices() { return voices; },
      },
    } : {},
    speechAvailable ? ControlledUtterance : undefined,
  );
  const component = exports.McpVoicePlaybackWeb as (props: Props) => null;
  return {
    audio, spoken, speaking, voices,
    speechCancels: () => speechCancels,
    startUnrelatedSpeech() {
      const utterance = new ControlledUtterance('A different speaker');
      speaking.add(utterance);
      return utterance;
    },
    render(state: LightCycleMatchState | null, props: Omit<Props, 'state'> = {}) {
      effectIndex = refIndex = 0;
      pending = [];
      assert.equal(component({ state, ...props }), null);
      pending.forEach(({ index }) => effects[index]?.cleanup?.());
      pending.forEach(({ index, callback, deps }) => { effects[index] = { deps, callback, cleanup: callback() }; });
    },
    reattachEffects() {
      effects.forEach((effect) => effect.cleanup?.());
      effects.forEach((effect) => { effect.cleanup = effect.callback(); });
    },
    unmount() { effects.forEach((effect) => effect.cleanup?.()); },
  };
}

describe('web MCP production component lifecycle', () => {
  it('keeps pending playback and its error listener across repeated equivalent race ticks', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    for (let tick = 1; tick <= 4; tick += 1) h.render({ ...state, tick, countdownTicks: state.countdownTicks - tick });
    assert.equal(h.audio.length, 1);
    assert.equal(h.audio[0]!.pauses, 0);
    h.audio[0]!.emit('error');
    await settle();
    assert.equal(h.spoken.length, 1, 'repeated ticks must not disarm current error fallback');
    h.unmount();
  });

  it('uses the asset URL and retains a successfully started line when the cue window expires', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state, { baseUrl: '/custom/voice/' });
    const audio = h.audio[0]!;
    assert.equal(audio.url, '/custom/voice/race-start.wav');
    assert.equal(audio.preload, 'auto');
    assert.equal(audio.volume, 0.94);
    audio.start();
    await settle();
    h.render({ ...state, tick: 60, countdownTicks: 120 }, { baseUrl: '/custom/voice/' });
    assert.equal(audio.pauses, 0);
    assert.equal(audio.paused, false);
    audio.finish();
    h.render(state, { baseUrl: '/custom/voice/' });
    await settle();
    assert.equal(h.audio.length, 1, 'a successful cue is consumed');
    assert.deepEqual(h.spoken, []);
    assert.equal(audio.listenerCount(), 0, 'natural end releases listeners');
    h.unmount();
  });

  for (const interruption of ['disable', 'null-state', 'unmount'] as const) {
    for (const late of ['resolve', 'reject', 'error'] as const) {
      it(`${interruption} cancels pending audio and suppresses late ${late}`, async () => {
        const h = fixture();
        const state = createLightCycleMatch();
        h.render(state);
        const audio = h.audio[0]!;
        const oldError = audio.captured.get('error')![0]!;
        if (interruption === 'disable') h.render(state, { enabled: false });
        else if (interruption === 'null-state') h.render(null);
        else h.unmount();
        assert.equal(audio.pauses, 1);
        assert.equal(audio.listenerCount(), 0);
        if (late === 'resolve') audio.completion.resolve();
        else if (late === 'reject') audio.fail();
        else oldError();
        await settle();
        assert.deepEqual(h.spoken, []);
        if (interruption !== 'unmount') {
          h.render(state);
          assert.equal(h.audio.length, 2, 'cancellation before starting must not consume the cue');
          h.audio[1]!.start();
          await settle();
          h.unmount();
        }
      });
    }
    it(`${interruption} stops started audio and does not replay its consumed cue`, async () => {
      const h = fixture();
      const state = createLightCycleMatch();
      h.render(state);
      h.audio[0]!.start();
      await settle();
      if (interruption === 'disable') h.render(state, { enabled: false });
      else if (interruption === 'null-state') h.render(null);
      else h.unmount();
      assert.equal(h.audio[0]!.pauses, 1);
      assert.equal(h.audio[0]!.paused, true);
      assert.equal(h.audio[0]!.listenerCount(), 0);
      if (interruption !== 'unmount') {
        h.render(state);
        assert.equal(h.audio.length, 1);
        h.unmount();
      }
    });
    it(`${interruption} cancels speech fallback`, async () => {
      const h = fixture();
      const state = createLightCycleMatch();
      h.render(state);
      h.audio[0]!.fail();
      await settle();
      assert.equal(h.speaking.size, 1);
      if (interruption === 'disable') h.render(state, { enabled: false });
      else if (interruption === 'null-state') h.render(null);
      else h.unmount();
      assert.equal(h.speaking.size, 0);
      if (interruption !== 'unmount') {
        h.render(state);
        assert.equal(h.audio.length, 1, 'fallback also consumes the once-only cue');
        assert.equal(h.spoken.length, 1);
        h.unmount();
      }
    });
  }

  for (const replacement of ['cue', 'baseUrl'] as const) {
    for (const late of ['resolve', 'reject', 'error'] as const) {
      it(`${replacement} replacement owns playback despite previous late ${late}`, async () => {
        const h = fixture();
        const state = createLightCycleMatch();
        h.render(state);
        const previous = h.audio[0]!;
        const oldError = previous.captured.get('error')![0]!;
        const nextState: LightCycleMatchState = replacement === 'cue'
          ? { ...state, phase: 'match-over', matchWinner: 'p1' } : state;
        h.render(nextState, replacement === 'baseUrl' ? { baseUrl: '/replacement' } : {});
        assert.equal(h.audio.length, 2);
        assert.equal(previous.pauses, 1);
        assert.equal(previous.listenerCount(), 0);
        if (late === 'resolve') previous.completion.resolve();
        else if (late === 'reject') previous.fail();
        else oldError();
        await settle();
        assert.deepEqual(h.spoken, []);
        assert.equal(h.audio[1]!.pauses, 0);
        assert.equal(h.audio[1]!.url, replacement === 'cue'
          ? '/assets/mcp/voice/end-of-line.wav' : '/replacement/race-start.wav');
        h.audio[1]!.start();
        await settle();
        h.unmount();
      });
    }
  }

  it('a new cue stops a started line', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    h.audio[0]!.start();
    await settle();
    h.render({ ...state, phase: 'match-over', matchWinner: 'p1' });
    assert.equal(h.audio[0]!.pauses, 1);
    assert.equal(h.audio[1]!.pauses, 0);
    h.unmount();
  });

  it('a new audio cue stops earlier fallback speech before playing', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    h.audio[0]!.fail();
    await settle();
    h.render({ ...state, phase: 'match-over', matchWinner: 'p1' });
    assert.equal(h.speaking.size, 0);
    assert.equal(h.audio.length, 2);
    h.audio[1]!.start();
    await settle();
    assert.equal(h.spoken.length, 1);
    h.unmount();
  });

  for (const first of ['error', 'rejection'] as const) {
    it(`delivers fallback once when ${first} arrives before the other failure signal`, async () => {
      const h = fixture();
      const state = createLightCycleMatch();
      h.render(state);
      const audio = h.audio[0]!;
      const oldError = audio.captured.get('error')![0]!;
      if (first === 'error') { audio.emit('error'); audio.fail(); }
      else { audio.fail(); await settle(); oldError(); }
      await settle();
      assert.equal(h.spoken.length, 1);
      assert.equal(h.spoken[0]!.text, mcpVoice.deriveMcpVoiceCue(state)!.text);
      assert.equal(h.spoken[0]!.rate, 0.78);
      assert.equal(h.spoken[0]!.pitch, 0.62);
      assert.equal(h.spoken[0]!.volume, 0.92);
      assert.equal(h.spoken[0]!.voice, h.voices[0]);
      assert.equal(audio.paused, true);
      assert.equal(audio.listenerCount(), 0);
      for (let tick = 1; tick <= 3; tick += 1) h.render({ ...state, tick });
      assert.equal(h.speaking.size, 1);
      assert.equal(h.audio.length, 1);
      h.unmount();
    });
  }

  it('allows current audio failure after a successful start to use the fallback once', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    h.audio[0]!.start();
    await settle();
    h.render({ ...state, countdownTicks: 120 });
    h.audio[0]!.emit('error');
    assert.equal(h.spoken.length, 1);
    assert.equal(h.audio[0]!.paused, true);
    h.unmount();
  });

  it('effect replay retries pending work but preserves already successful cue suppression', async () => {
    const h = fixture();
    h.render(createLightCycleMatch());
    const oldError = h.audio[0]!.captured.get('error')![0]!;
    h.reattachEffects();
    assert.equal(h.audio.length, 2);
    assert.equal(h.audio[0]!.pauses, 1);
    h.audio[0]!.fail();
    oldError();
    h.audio[1]!.start();
    await settle();
    assert.deepEqual(h.spoken, []);
    h.reattachEffects();
    assert.equal(h.audio.length, 2);
    assert.equal(h.audio[1]!.pauses, 1);
    h.unmount();
    assert.equal(h.audio[1]!.pauses, 1, 'cleanup is idempotent');
  });

  it('cancels a pending expired cue and can retry if that cue reappears', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    h.render({ ...state, countdownTicks: 120 });
    assert.equal(h.audio[0]!.pauses, 1);
    h.render(state);
    assert.equal(h.audio.length, 2);
    h.audio[0]!.fail();
    h.audio[1]!.start();
    await settle();
    assert.deepEqual(h.spoken, []);
    h.unmount();
  });

  it('does not cancel another speaker after its own fallback naturally finishes', async () => {
    const h = fixture();
    h.render(createLightCycleMatch());
    h.audio[0]!.fail();
    await settle();
    h.spoken[0]!.finish();
    const cancels = h.speechCancels();
    const unrelated = h.startUnrelatedSpeech();
    h.unmount();
    assert.ok(h.speaking.has(unrelated));
    assert.equal(h.speechCancels(), cancels, 'a finished utterance has no speech left to cancel');
  });

  it('treats a fulfilled play promise as success even without a playing event', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    h.audio[0]!.completion.resolve();
    await settle();
    h.render({ ...state, countdownTicks: 120 });
    assert.equal(h.audio[0]!.pauses, 0);
    h.render(state, { enabled: false });
    h.render(state);
    assert.equal(h.audio.length, 1);
    h.unmount();
  });

  it('remembers an actual start even when disabled before the play continuation runs', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    h.audio[0]!.start();
    h.render(state, { enabled: false });
    h.render(state);
    await settle();
    assert.equal(h.audio.length, 1);
    assert.equal(h.audio[0]!.pauses, 1);
    assert.deepEqual(h.spoken, []);
    h.unmount();
  });

  it('does not replay a successfully started cue when the base URL changes', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    h.audio[0]!.start();
    await settle();
    h.render(state, { baseUrl: '/replacement' });
    assert.equal(h.audio.length, 1);
    assert.equal(h.audio[0]!.pauses, 0);
    h.unmount();
  });

  it('normalizes equivalent asset base URLs without interrupting pending playback', () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state, { baseUrl: '/voice' });
    h.render({ ...state, tick: 1 }, { baseUrl: '/voice/' });
    assert.equal(h.audio.length, 1);
    assert.equal(h.audio[0]!.pauses, 0);
    assert.equal(h.audio[0]!.listeners.get('error')?.size, 1);
    h.unmount();
  });

  it('preserves a started fallback after the cue expires and suppresses it on effect replay', async () => {
    const h = fixture();
    const state = createLightCycleMatch();
    h.render(state);
    h.audio[0]!.fail();
    await settle();
    h.render({ ...state, countdownTicks: 120 });
    assert.equal(h.speaking.size, 1);
    h.render(state);
    assert.equal(h.audio.length, 1);
    h.reattachEffects();
    assert.equal(h.speaking.size, 0);
    assert.equal(h.spoken.length, 1);
    assert.equal(h.audio.length, 1);
    h.unmount();
  });

  it('is silent until active with a cue and resets consumed cues only on a fresh mount', async () => {
    const state = createLightCycleMatch();
    const h = fixture();
    h.render(null);
    h.render(state, { enabled: false });
    h.render({ ...state, countdownTicks: 120 });
    assert.equal(h.audio.length, 0);
    h.render(state);
    h.audio[0]!.start();
    await settle();
    h.unmount();
    const remounted = fixture();
    remounted.render(state);
    assert.equal(remounted.audio.length, 1);
    remounted.unmount();
  });

  it('contains unavailable speech fallback without retrying a failed cue on ticks or reenable', async () => {
    const h = fixture({ speechAvailable: false });
    const state = createLightCycleMatch();
    h.render(state);
    h.audio[0]!.fail();
    await settle();
    h.render({ ...state, tick: 1 });
    h.render(state, { enabled: false });
    h.render(state);
    assert.equal(h.audio.length, 1);
    assert.deepEqual(h.spoken, []);
    h.render({ ...state, phase: 'match-over', matchWinner: 'p1' });
    assert.equal(h.audio.length, 2);
    h.unmount();
  });
});
