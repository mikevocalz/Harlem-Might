'use client';

import { useEffect } from 'react';
import { ViroSound } from '../viro';
import type {
  LightCycleMatchState,
  LightCyclePlayerId,
} from '../lightcycle/tabletopCore';
import {
  deriveMcpVoiceCue,
  type McpVoiceCueName,
} from './mcpVoice';
import { useMcpVoicePlaybackStore } from './mcpVoicePlaybackStore';

type ViroAudioSource = number | { uri: string };

type Props = {
  state: LightCycleMatchState;
  localPlayerId: LightCyclePlayerId;
  sources: Partial<Record<McpVoiceCueName, ViroAudioSource>>;
  enabled?: boolean;
  volume?: number;
};

export function McpVoiceSoundNative({
  state,
  localPlayerId,
  sources,
  enabled = true,
  volume = 0.94,
}: Props) {
  const activeKey = useMcpVoicePlaybackStore((store) => store.activeKey);
  const activate = useMcpVoicePlaybackStore((store) => store.activate);
  const clear = useMcpVoicePlaybackStore((store) => store.clear);

  const cue = enabled ? deriveMcpVoiceCue(state, localPlayerId) : null;
  const source = cue ? sources[cue.name] : undefined;
  const scopedKey = cue ? `${state.seed}:${cue.eventKey}` : null;

  useEffect(() => {
    if (!scopedKey || !source) return;
    activate(scopedKey);
    return () => clear(scopedKey);
  }, [activate, clear, scopedKey, source]);

  if (!cue || !source || !scopedKey || activeKey !== scopedKey) {
    return null;
  }

  return (
    <ViroSound
      key={scopedKey}
      source={source}
      paused={false}
      loop={false}
      muted={false}
      volume={volume}
      onFinish={() => clear(scopedKey)}
      onError={() => clear(scopedKey)}
    />
  );
}
