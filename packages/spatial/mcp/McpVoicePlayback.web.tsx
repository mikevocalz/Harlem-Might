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

function speakFallback(text: string): (() => void) | undefined {
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
  let speaking = true;
  const finish = () => {
    speaking = false;
    utterance.onend = null;
    utterance.onerror = null;
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);

  return () => {
    if (!speaking) return;
    finish();
    window.speechSynthesis.cancel();
  };
}

export function McpVoicePlaybackWeb({
  state,
  localPlayerId = 'p1',
  baseUrl,
  enabled = true,
}: Props) {
  const handledEventKeys = useRef(new Set<string>());
  const currentPlayback = useRef<{ stop: () => void } | null>(null);
  const active = enabled && state !== null;
  const cue = active && state ? deriveMcpVoiceCue(state, localPlayerId) : null;
  const eventKey = cue?.eventKey;
  const text = cue?.text;
  const assetUrl = cue ? mcpVoiceAssetUrl(cue, baseUrl) : undefined;

  useEffect(() => {
    if (!active) {
      currentPlayback.current?.stop();
      currentPlayback.current = null;
      return;
    }
    if (!eventKey || !text || !assetUrl || handledEventKeys.current.has(eventKey)) return;

    currentPlayback.current?.stop();
    const audio = new Audio(assetUrl);
    audio.preload = 'auto';
    audio.volume = 0.94;
    let cancelled = false;
    let started = false;
    let fallbackUsed = false;
    let audioStopped = false;
    let cancelSpeech: (() => void) | undefined;

    const removeListeners = () => {
      audio.removeEventListener('playing', markPlayed);
      audio.removeEventListener('error', fallback);
      audio.removeEventListener('ended', finish);
    };
    const stopAudio = () => {
      removeListeners();
      if (audioStopped) return;
      audioStopped = true;
      audio.pause();
    };
    const stop = () => {
      if (cancelled) return;
      // Revoke this attempt before pause/cancel can dispatch or reject anything.
      cancelled = true;
      stopAudio();
      cancelSpeech?.();
    };
    const markPlayed = () => {
      if (cancelled || fallbackUsed) return;
      started = true;
      handledEventKeys.current.add(eventKey);
    };
    const finish = () => {
      cancelled = true;
      removeListeners();
    };
    const fallback = () => {
      if (cancelled || fallbackUsed) return;
      // Both the error event and play rejection can report the same failure.
      fallbackUsed = true;
      handledEventKeys.current.add(eventKey);
      stopAudio();
      cancelSpeech = speakFallback(text);
    };

    currentPlayback.current = { stop };
    audio.addEventListener('playing', markPlayed, { once: true });
    audio.addEventListener('error', fallback, { once: true });
    audio.addEventListener('ended', finish, { once: true });
    void audio.play().then(markPlayed, fallback);

    return () => {
      // A race tick or expiring cue window must not cut off a started line.
      // Only pending work is cancelled here; disable, replacement and unmount
      // stop the whole owned playback, including an active speech fallback.
      if (!started && !fallbackUsed) stop();
    };
  }, [active, assetUrl, eventKey, text]);

  useEffect(
    () => () => {
      currentPlayback.current?.stop();
      currentPlayback.current = null;
    },
    [],
  );

  return null;
}
