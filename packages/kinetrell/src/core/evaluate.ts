import { applyEase } from './easing.js';
import { interpolateColorValue } from './color.js';
import type { CompiledMotion, CompiledTrack, MotionState, MotionValue } from './types.js';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function interpolateValue(from: MotionValue | undefined, to: MotionValue, t: number): MotionValue {
  if (typeof from === 'number' && typeof to === 'number') return lerp(from, to, t);
  const color = interpolateColorValue(from, to, t);
  if (color !== null) return color;
  return t < 1 ? (from ?? to) : to;
}

function trackProgress(track: CompiledTrack, timeMs: number): number | null {
  const start = track.atMs + (track.delayMs ?? 0);
  if (timeMs < start) return null;

  const repeat = track.repeat ?? 0;
  const repeatDelay = track.repeatDelayMs ?? 0;
  const duration = track.durationMs;
  if (duration === 0) {
    return track.yoyo && repeat % 2 === 1 ? 0 : 1;
  }

  const activeSpan = duration + repeatDelay;
  const local = Math.max(0, timeMs - start);
  const maxLocal = duration * (repeat + 1) + repeatDelay * repeat;
  const bounded = Math.min(local, maxLocal);

  let cycle = Math.floor(bounded / activeSpan);
  if (cycle > repeat) cycle = repeat;

  const withinCycle = bounded - cycle * activeSpan;
  const raw = withinCycle >= duration ? 1 : withinCycle / duration;
  const directed = track.yoyo && cycle % 2 === 1 ? 1 - raw : raw;
  return applyEase(track.ease, directed);
}

export function evaluateMotion(motion: CompiledMotion, timeMs: number): Record<string, MotionState> {
  const time = Math.min(Math.max(0, timeMs), motion.durationMs);
  const state: Record<string, Record<string, MotionValue>> = {};

  for (const [target, initial] of Object.entries(motion.initial)) {
    state[target] = { ...initial };
  }

  // Deterministic ownership rule: later tracks in the definition win when
  // multiple active tracks write the same target/property.
  for (const track of motion.tracks) {
    const progress = trackProgress(track, time);
    if (progress === null) continue;

    const targetState = state[track.target]!;
    for (const [property, to] of Object.entries(track.to)) {
      const from = track.from?.[property] ?? targetState[property];
      targetState[property] = interpolateValue(from, to, progress);
    }
  }

  return state;
}
