import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BAR_COUNT,
  MIN_BAR,
  barHeight,
  barProgress,
  frameLevel,
  pushLevel,
  summarise,
} from './waveform.ts';

/** A frame of silence: every sample sits on the 128 centre line. */
const silence = (size = 64) => new Uint8Array(size).fill(128);

/** A frame at full deflection, alternating either side of centre. */
const loud = (size = 64) =>
  new Uint8Array(Array.from({ length: size }, (_, i) => (i % 2 === 0 ? 0 : 255)));

describe('frameLevel', () => {
  it('reads silence as zero', () => {
    assert.equal(frameLevel(silence()), 0);
  });

  it('reads full deflection as the top of the range', () => {
    assert.equal(frameLevel(loud()), 1);
  });

  it('puts speech-level input somewhere visible, not near zero', () => {
    const quiet = new Uint8Array(64).fill(128 + 12);
    const level = frameLevel(quiet);
    assert.ok(level > 0.2, `expected a visible level, got ${level}`);
    assert.ok(level < 1);
  });

  it('KEEPS THE SPEAKING RANGE DISTINGUISHABLE — no clipping to a solid block', () => {
    // The bug this replaced: a power curve saturated around RMS 0.39, so every
    // frame above a quiet voice drew a full-height bar and the waveform was a
    // rectangle. Each step up the speaking range must still be visibly higher.
    // Deviations chosen to span real speech: RMS ~0.016 to ~0.25, which is
    // roughly -36dB to -12dB. Filling a buffer with a constant is a far louder
    // signal than any voice, so testing at 96/128 would only prove the ceiling.
    const at = (deviation: number) => frameLevel(new Uint8Array(64).fill(128 + deviation));
    const levels = [2, 4, 8, 16, 32].map(at);

    for (let i = 1; i < levels.length; i += 1) {
      assert.ok(
        (levels[i] ?? 0) > (levels[i - 1] ?? 0) + 0.05,
        `level ${i} (${levels[i]}) should be clearly above ${levels[i - 1]}`,
      );
    }
    // ...and nothing in that range is pinned to the ceiling.
    assert.ok((levels[3] ?? 0) < 1, 'a normal loud voice must not clip');
  });

  it('bottoms out below the meter window rather than going negative', () => {
    const nearSilent = new Uint8Array(64).fill(128 + 1);
    assert.ok(frameLevel(nearSilent) >= 0);
  });

  it('is louder for a louder frame', () => {
    const soft = new Uint8Array(64).fill(128 + 8);
    const hard = new Uint8Array(64).fill(128 + 60);
    assert.ok(frameLevel(hard) > frameLevel(soft));
  });

  it('handles an empty frame rather than dividing by zero', () => {
    assert.equal(frameLevel(new Uint8Array(0)), 0);
  });
});

describe('pushLevel', () => {
  it('appends while there is room', () => {
    assert.deepEqual(pushLevel([0.1, 0.2], 0.3, 4), [0.1, 0.2, 0.3]);
  });

  it('drops the oldest once full, so the window scrolls', () => {
    assert.deepEqual(pushLevel([0.1, 0.2, 0.3], 0.4, 3), [0.2, 0.3, 0.4]);
  });

  it('does not mutate the window it is given', () => {
    const levels = [0.1, 0.2];
    pushLevel(levels, 0.3, 2);
    assert.deepEqual(levels, [0.1, 0.2]);
  });
});

describe('summarise', () => {
  it('STRETCHES a short recording across the whole track', () => {
    // Returning [0.2, 0.4] made the player left-pad it, so a short note drew as
    // silence-then-audio and looked like it started halfway along.
    assert.deepEqual(summarise([0.2, 0.4], 8), [0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.4, 0.4]);
  });

  it('always returns exactly the requested bar count', () => {
    for (const length of [1, 3, 47, 48, 49, 5000]) {
      const samples = Array.from({ length }, (_, i) => (i % 7) / 7);
      assert.equal(summarise(samples, BAR_COUNT).length, BAR_COUNT, `length ${length}`);
    }
  });

  it('keeps a single sample visible rather than collapsing the track', () => {
    assert.deepEqual(summarise([0.8], 4), [0.8, 0.8, 0.8, 0.8]);
  });

  it('reduces to exactly the requested number of bars', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => i / 1000);
    assert.equal(summarise(samples, BAR_COUNT).length, BAR_COUNT);
  });

  it('keeps peaks instead of averaging them away', () => {
    // One loud sample in an otherwise silent slice must still show up, or every
    // recording flattens towards a uniform bar.
    const samples = [0, 0, 0, 1, 0, 0, 0, 0];
    assert.deepEqual(summarise(samples, 2), [1, 0]);
  });

  it('handles an empty recording', () => {
    assert.deepEqual(summarise([], 8), []);
  });
});

describe('barHeight', () => {
  it('never collapses a bar to nothing', () => {
    assert.equal(barHeight(0), MIN_BAR);
  });

  it('clamps to the track', () => {
    assert.equal(barHeight(5), 1);
  });
});

describe('barProgress', () => {
  it('fills bars behind the playhead and leaves those ahead empty', () => {
    assert.equal(barProgress(0, 4, 0.5), 1);
    assert.equal(barProgress(3, 4, 0.5), 0);
  });

  it('partially fills the bar the playhead is inside', () => {
    // Halfway through the second of four bars.
    assert.equal(barProgress(1, 4, 0.375), 0.5);
  });

  it('is empty at the start and full at the end', () => {
    assert.equal(barProgress(0, 4, 0), 0);
    assert.equal(barProgress(3, 4, 1), 1);
  });

  it('handles a waveform with no bars', () => {
    assert.equal(barProgress(0, 0, 0.5), 0);
  });
});
