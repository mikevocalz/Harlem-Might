'use client';
import { View } from '../tw';
import type { AudioPlayerProps } from './AudioPlayer.types.ts';

/**
 * Web already has a fully accessible audio player with keyboard support and
 * platform-native affordances — reimplementing it in JS to match the native
 * waveform would be a downgrade the user can hear.
 */
export function AudioPlayer({ uri, label, className }: AudioPlayerProps) {
  return (
    <View
      className={`my-2 gap-2 rounded-md border-2 border-border bg-surface-raised p-3 shadow-card ${className ?? ''}`}
    >
      {/* No caption track: a voice note has none, and the note's own text is
          the transcript. (No jsx-a11y directive here — this package lints with
          eslint-config-expo, which does not load that plugin, so naming the
          rule is itself an error.) */}
      <audio src={uri} controls aria-label={label ?? 'Voice note'} style={{ width: '100%' }} />
    </View>
  );
}
