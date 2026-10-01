'use client';

import { useEffect, useRef } from 'react';
import type {
  LightCycleMatchState,
  LightCyclePlayerId,
} from '../lightcycle/tabletopCore';
import {
  deriveMcpVoiceCue,
  mcpVoiceAssetUrl,
} from './mcpVoice';

type Props = {
  state: LightCycleMatchState | null;
  localPlayerId?: LightCyclePlayerId;
  baseUrl?: string;
  enabled?: boolean;
};

function speakFallback(text: string) {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.78;
  utterance.pitch = 0.62;
  utterance.volume = 0.92;

  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(
      (voice) =>
        /english/i.test(voice.lang) &&
        /(male|daniel|alex|david|george|fred)/i.test(voice.name),
    ) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ??
    null;

  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

export function McpVoicePlaybackWeb({
  state,
  localPlayerId = 'p1',
  baseUrl,
  enabled = true,
}: Props) {
  const playedEventKeys = useRef(new Set<string>());
  const currentAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled || !state) return;

    const cue = deriveMcpVoiceCue(state, localPlayerId);
    if (!cue || playedEventKeys.current.has(cue.eventKey)) return;

    playedEventKeys.current.add(cue.eventKey);
    currentAudio.current?.pause();

    const audio = new Audio(mcpVoiceAssetUrl(cue, baseUrl));
    currentAudio.current = audio;
    audio.preload = 'auto';
    audio.volume = 0.94;

    const fallback = () => {
      if (currentAudio.current !== audio) return;
      speakFallback(cue.text);
    };
    audio.addEventListener('error', fallback, { once: true });
    void audio.play().catch(fallback);

    return () => {
      audio.removeEventListener('error', fallback);
    };
  }, [baseUrl, enabled, localPlayerId, state]);

  useEffect(
    () => () => {
      currentAudio.current?.pause();
      currentAudio.current = null;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  return null;
}
