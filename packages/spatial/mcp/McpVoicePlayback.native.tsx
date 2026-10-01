'use client';

import { useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { AudioContext } from 'react-native-audio-api';
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

function sourceUri(source: NativeAudioSource) {
  return typeof source === 'number'
    ? Image.resolveAssetSource(source)?.uri
    : source.uri;
}

export function McpVoicePlaybackNative({
  state,
  localPlayerId = 'p1',
  sources,
  enabled = true,
}: Props) {
  const playedEventKeys = useRef(new Set<string>());
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<ReturnType<AudioContext['createBufferSource']> | null>(
    null,
  );

  useEffect(() => {
    if (!enabled || !state) return;

    const cue = deriveMcpVoiceCue(state, localPlayerId);
    if (!cue || playedEventKeys.current.has(cue.eventKey)) return;

    const source = sources[cue.name];
    if (!source) return;
    const uri = sourceUri(source);
    if (!uri) return;

    playedEventKeys.current.add(cue.eventKey);

    let cancelled = false;
    const play = async () => {
      const context = contextRef.current ?? new AudioContext();
      contextRef.current = context;

      try {
        sourceRef.current?.stop();
      } catch {
        // A source that already ended throws on a second stop; safe to ignore.
      }

      const buffer = await fetch(uri)
        .then((response) => response.arrayBuffer())
        .then((data) => context.decodeAudioData(data));

      if (cancelled) return;

      const player = context.createBufferSource();
      player.buffer = buffer;
      player.connect(context.destination);
      sourceRef.current = player;
      player.start(context.currentTime);
    };

    void play();

    return () => {
      cancelled = true;
    };
  }, [enabled, localPlayerId, sources, state]);

  useEffect(
    () => () => {
      try {
        sourceRef.current?.stop();
      } catch {
        // Already stopped.
      }
      sourceRef.current = null;
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  return null;
}
