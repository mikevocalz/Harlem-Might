import type { CompiledMotion, CompiledTrack, MotionDefinition } from './types.js';

function finiteNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${field} must be a finite number >= 0`);
  return value;
}

export function compileMotion(definition: MotionDefinition): CompiledMotion {
  if (!definition.id.trim()) throw new Error('Motion id is required');
  const labels = Object.freeze({ ...(definition.labels ?? {}) });
  for (const [name, value] of Object.entries(labels)) finiteNonNegative(value, `label:${name}`);

  let durationMs = 0;
  const tracks: CompiledTrack[] = definition.tracks.map((track, index) => {
    if (!definition.initial[track.target]) throw new Error(`Unknown target "${track.target}" at track ${index}`);
    const atMs = finiteNonNegative(track.atMs ?? 0, `tracks[${index}].atMs`);
    const duration = finiteNonNegative(track.durationMs, `tracks[${index}].durationMs`);
    const delay = finiteNonNegative(track.delayMs ?? 0, `tracks[${index}].delayMs`);
    const repeatDelay = finiteNonNegative(track.repeatDelayMs ?? 0, `tracks[${index}].repeatDelayMs`);
    const repeat = track.repeat ?? 0;
    if (!Number.isInteger(repeat) || repeat < 0) throw new RangeError(`tracks[${index}].repeat must be an integer >= 0`);
    const endMs = atMs + delay + duration * (repeat + 1) + repeatDelay * repeat;
    durationMs = Math.max(durationMs, endMs);
    return Object.freeze({ ...track, atMs, endMs, ease: track.ease ?? 'linear' });
  });

  return Object.freeze({
    schemaVersion: 1 as const,
    id: definition.id,
    initial: definition.initial,
    tracks: Object.freeze(tracks),
    labels,
    durationMs,
  });
}
