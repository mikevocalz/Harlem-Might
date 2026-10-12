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

type NativeAudioSource = number | { uri: string };

type Props = {
  state: LightCycleMatchState | null;
  localPlayerId?: LightCyclePlayerId;
  sources: Partial<Record<McpVoiceCueName, NativeAudioSource>>;
  enabled?: boolean;
};

export function McpVoicePlaybackNative({
  state,
  localPlayerId = 'p1',
  sources,
  enabled = true,
}: Props) {
  const playedEventKeys = useRef(new Set<string>());
  const playbackKey = `mcp-playback:${useId()}`;

  useEffect(() => {
    if (!enabled || !state) return;

    const cue = deriveMcpVoiceCue(state, localPlayerId);
    if (!cue || playedEventKeys.current.has(cue.eventKey)) return;

    const source = sources[cue.name];
    if (!source) return;

    playedEventKeys.current.add(cue.eventKey);

    // A source that already ended throws on a second stop; safe to ignore.
    void spatialAudio.playAmbient(playbackKey, source).catch((error) => {
      console.warn('Unable to play MCP voice cue.', error);
    });

    return () => spatialAudio.cancelPending(playbackKey);
  }, [enabled, localPlayerId, playbackKey, sources, state]);

  useEffect(
    () => () => {
      // Already stopped.
      spatialAudio.unload(playbackKey);
    },
    [playbackKey],
  );

  return null;
}
