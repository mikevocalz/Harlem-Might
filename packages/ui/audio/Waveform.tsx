'use client';
import { View } from '../tw';
import { BAR_COUNT, barHeight, barProgress } from './waveform.ts';

export interface WaveformProps {
  /** Levels, 0–1, oldest first. Short arrays are padded from the left. */
  levels: readonly number[];
  /** Playback position 0–1. Omit while recording — every bar is then "live". */
  progress?: number;
  /** Track height in dp. */
  height?: number;
  className?: string;
}

/**
 * The bars.
 *
 * Square-ended, flat-filled rectangles rather than the rounded gradient bars
 * most voice-note UIs use — this app is hard edges and flat colour everywhere
 * else, and a waveform is exactly the kind of component that reverts to a
 * generic look if it is not held to the same rules.
 *
 * Bars are laid out with a fixed count and `flex-1`, so the waveform occupies
 * the same width whether it holds two samples or fifty. A meter that grows as
 * it fills reads as a progress bar, which is a different promise.
 */
export function Waveform({ levels, progress, height = 48, className }: WaveformProps) {
  // Pad from the left so a new recording grows from the right edge, the way a
  // tape moves past a head, rather than stretching from the middle.
  const padded =
    levels.length >= BAR_COUNT
      ? levels.slice(levels.length - BAR_COUNT)
      : [...Array.from({ length: BAR_COUNT - levels.length }, () => 0), ...levels];

  return (
    <View
      className={`flex-row items-center gap-0.5 ${className ?? ''}`}
      style={{ height }}
      aria-hidden
    >
      {padded.map((level, index) => {
        const filled = progress === undefined ? 1 : barProgress(index, BAR_COUNT, progress);
        return (
          <View
            key={index}
            className="flex-1 justify-center overflow-hidden rounded-[1px]"
            style={{ height: barHeight(level) * height }}
          >
            {/* Two stacked fills rather than one tinted bar: the played portion
                keeps full contrast while the rest stays muted, so the playhead
                is readable at a glance without a separate marker. */}
            <View className="h-full w-full bg-border/25" />
            {filled > 0 ? (
              <View
                className="absolute left-0 top-0 h-full bg-accent"
                style={{ width: `${filled * 100}%` }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
