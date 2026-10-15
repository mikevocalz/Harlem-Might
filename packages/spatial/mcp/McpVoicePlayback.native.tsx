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
type VoicePlaybackOutcome = 'played' | 'failed';

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
  const outcomes = useRef(new Map<string, VoicePlaybackOutcome>());
  const playbackKey = `mcp-playback:${useId()}`;
  const active = enabled && state !== null;
  const cue = active && state ? deriveMcpVoiceCue(state, localPlayerId) : null;
  const eventKey = cue?.eventKey;
  const source = cue ? sources[cue.name] : undefined;
  // Race state and source objects can change every tick without a new cue.
  const asset = typeof source === 'number' ? source : source?.uri;

  useEffect(() => {
    if (!active) {
      spatialAudio.unload(playbackKey);
      return;
    }
    if (!eventKey || asset === undefined || outcomes.current.has(eventKey)) return;

    let cancelled = false;
    void spatialAudio.playAmbientWithOutcome(playbackKey, asset).then((outcome) => {
      // Cancellation while loading never consumes a once-only cue. A successful
      // start does, even if the component is disabled before this continuation.
      if (outcome === 'played') outcomes.current.set(eventKey, 'played');
    }).catch(() => {
      if (cancelled) return;
      // An unavailable cue must not retry on every race tick or expose its URI.
      outcomes.current.set(eventKey, 'failed');
      console.warn('An MCP voice cue could not be played.');
    });

    return () => {
      cancelled = true;
      // Let a spoken line finish when its triggering race condition expires.
      spatialAudio.cancelPending(playbackKey);
    };
  }, [active, asset, eventKey, playbackKey]);

  useEffect(
    () => () => spatialAudio.unload(playbackKey),
    [playbackKey],
  );

  return null;
}
