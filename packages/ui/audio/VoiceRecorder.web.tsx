'use client';
import { View } from '../tw';
import { Text } from '../Text';
import { Mic } from '../icons';
import type { VoiceRecorderProps } from './VoiceRecorder.types.ts';

/**
 * Recording is native-only.
 *
 * `react-native-audio-api`'s recorder takes a microphone session through the
 * platform, not `MediaRecorder`, so there is nothing here to drive it. Rather
 * than ship controls that cannot record, this states the limit — a disabled
 * button with no explanation is worse than an absent feature.
 */
export function VoiceRecorder({ className }: VoiceRecorderProps) {
  return (
    <View
      className={`items-center gap-2 rounded-md border-2 border-border bg-surface-sunken p-6 ${className ?? ''}`}
    >
      <Mic size={24} className="text-text-muted" />
      <Text className="text-center text-sm text-text-muted md:text-base">
        Voice notes can be recorded in the mobile app.
      </Text>
    </View>
  );
}
