/**
 * Waveform maths for the recorder and the player.
 *
 * Pure, so the levels can be tested without a microphone or an audio graph.
 * Both surfaces share these functions deliberately: a voice note recorded with
 * one shape and played back with another reads as two different recordings.
 */

/** Bars drawn in a recorder or player. Enough to read as a waveform, few
 *  enough to stay legible at a phone's width. */
export const BAR_COUNT = 48;

/** Floor so silence still draws a line rather than a gap in the middle. */
export const MIN_BAR = 0.06;

/**
 * Window of the meter, in dBFS.
 *
 * -60 is effectively silence in a room; -6 leaves headroom below clipping so a
 * loud passage still has somewhere to go. Speech normally lives around -30 to
 * -12, which lands mid-scale — the range where differences are actually
 * visible.
 */
export const MIN_DB = -60;
export const MAX_DB = -6;

/**
 * Loudness of one analyser frame, 0–1.
 *
 * `getByteTimeDomainData` centres samples on 128, so the deviation from centre
 * is the amplitude. RMS rather than peak: peak jumps on a single click and
 * makes the bars twitch, while RMS tracks what a listener would call loudness.
 *
 * The RMS is then mapped through DECIBELS, not a power curve. Loudness is
 * logarithmic — a linear scale leaves every normal voice bunched near the
 * bottom, and the obvious fix of multiplying by a constant just moves the
 * problem: the earlier `sqrt(rms) * 1.6` saturated at RMS 0.39, so anything
 * above a quiet voice clipped to a full bar and every recording drew as a solid
 * block. dBFS across a fixed window is what a real meter uses, and it keeps the
 * whole speaking range distinguishable.
 */
export function frameLevel(timeDomain: Uint8Array): number {
  if (timeDomain.length === 0) return 0;

  let sum = 0;
  for (const sample of timeDomain) {
    const deviation = (sample - 128) / 128;
    sum += deviation * deviation;
  }

  const rms = Math.sqrt(sum / timeDomain.length);
  // log10(0) is -Infinity, so digital silence short-circuits.
  if (rms <= 0) return 0;

  const db = 20 * Math.log10(rms);
  const level = (db - MIN_DB) / (MAX_DB - MIN_DB);
  return Math.max(0, Math.min(1, level));
}

/**
 * Append a level to a rolling window, oldest first.
 *
 * The window is fixed-length, so the recorder scrolls: new samples enter at the
 * right and the oldest fall off the left, which is what makes it read as time
 * passing rather than a meter bouncing in place.
 */
export function pushLevel(levels: readonly number[], level: number, size = BAR_COUNT): number[] {
  const next = [...levels, level];
  return next.length > size ? next.slice(next.length - size) : next;
}

/**
 * Resample a finished recording to exactly `count` bars.
 *
 * ALWAYS `count`, never fewer. Returning a short array made the player pad it —
 * and the padding goes on the LEFT, because that is what makes a live recording
 * scroll in from the right. On a finished take that reads as a recording that
 * starts halfway along the track: a two-second note drew silence for the first
 * half and audio on the right. A completed waveform fills its track whatever
 * its length.
 *
 * Where there are more samples than bars, each bar is the PEAK of its slice
 * rather than the average: averaging flattens a waveform towards silence and
 * every voice note ends up looking the same.
 */
export function summarise(samples: readonly number[], count = BAR_COUNT): number[] {
  if (samples.length === 0) return [];

  // Fewer samples than bars: stretch them across the track so a short note
  // still reads left-to-right, holding each sample for its share of the width.
  if (samples.length < count) {
    return Array.from({ length: count }, (_, index) => {
      const source = Math.floor((index * samples.length) / count);
      return samples[Math.min(source, samples.length - 1)] ?? 0;
    });
  }

  const perBar = samples.length / count;
  const bars: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index * perBar);
    const end = Math.max(start + 1, Math.floor((index + 1) * perBar));

    let peak = 0;
    for (let i = start; i < end && i < samples.length; i += 1) {
      const value = Math.abs(samples[i] ?? 0);
      if (value > peak) peak = value;
    }
    bars.push(peak);
  }

  return bars;
}

/** Bar height as a fraction of the track, never fully collapsed. */
export function barHeight(level: number): number {
  return Math.max(MIN_BAR, Math.min(1, level));
}

/**
 * How far through playback a given bar sits, 0–1.
 *
 * Used to colour bars behind the playhead differently, which is what tells you
 * where you are without a separate scrubber line.
 */
export function barProgress(index: number, total: number, progress: number): number {
  if (total <= 0) return 0;
  const start = index / total;
  const end = (index + 1) / total;
  if (progress >= end) return 1;
  if (progress <= start) return 0;
  return (progress - start) / (end - start);
}
