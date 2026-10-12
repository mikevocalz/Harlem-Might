'use client';

import { useEffect, useId, useRef } from 'react';
import { spatialAudio } from '../audio/SpatialAudioEngine.native';
import type {
  LightCycleMatchState,
  LightCyclePlayerId,
} from '../lightcycle/tabletopCore';
import {
  deriveMcpVoiceCue,
  type McpVoiceCueName,
} from './mcpVoice';
import { useMcpVoicePlaybackStore } from './mcpVoicePlaybackStore';

type NativeAudioSource = number | { uri: string };

type Props = {
  state: LightCycleMatchState;
  localPlayerId: LightCyclePlayerId;
  sources: Partial<Record<McpVoiceCueName, NativeAudioSource>>;
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
  const playbackKey = `mcp-sound:${useId()}`;
  const volumeRef = useRef(volume);

  const cue = enabled ? deriveMcpVoiceCue(state, localPlayerId) : null;
  const source = cue ? sources[cue.name] : undefined;
  const scopedKey = cue ? `${state.seed}:${cue.eventKey}` : null;

  useEffect(() => {
    if (!scopedKey || !source) return;
    activate(scopedKey);
    return () => clear(scopedKey);
  }, [activate, clear, scopedKey, source]);

  useEffect(() => {
    volumeRef.current = volume;
    spatialAudio.setVolume(playbackKey, volume);
  }, [playbackKey, volume]);

  useEffect(() => {
    if (!source || !scopedKey || activeKey !== scopedKey) return;
    let cancelled = false;
    void spatialAudio.playAmbient(playbackKey, source, {
      volume: volumeRef.current,
      onFinish: () => clear(scopedKey),
    }).catch(() => {
      if (!cancelled) clear(scopedKey);
    });
    return () => {
      cancelled = true;
      spatialAudio.unload(playbackKey);
    };
  }, [activeKey, clear, playbackKey, scopedKey, source]);

  return null;
}
