'use client';
import { useEffect, useRef } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { createStore, useStore } from 'zustand';
import { AudioContext, AudioRecorder } from 'react-native-audio-api';
import { View } from '../tw';
import { Text } from '../Text';
import { Pressable } from '../tw';
import { Mic, Square, Trash2 } from '../icons';
import { haptics } from '../haptics';
import { AudioPlayer } from './AudioPlayer';
import { Waveform } from './Waveform.tsx';
import { frameLevel, pushLevel } from './waveform.ts';
import type { VoiceRecorderProps, VoiceRecording } from './VoiceRecorder.types.ts';

/** How often the meter samples. 16 is ~60fps, which is smoother than the eye
 *  needs for bars this wide and costs a JS frame each time; 50ms reads as
 *  continuous and leaves the thread alone. */
const SAMPLE_MS = 50;
const FFT_SIZE = 1024;

function createRecorderStore() {
  return createStore<{
    recording: boolean;
    seconds: number;
    levels: number[];
    error: string | null;
    /** The finished take, held for review before it is handed over. */
    take: VoiceRecording | null;
    set: (
      next: Partial<{
        recording: boolean;
        seconds: number;
        levels: number[];
        error: string | null;
        take: VoiceRecording | null;
      }>,
    ) => void;
  }>((set) => ({
    recording: false,
    seconds: 0,
    levels: [],
    error: null,
    take: null,
    set: (next) => set(next),
  }));
}

/**
 * Record a voice note.
 *
 * THE BARS ARE REAL. `AudioRecorder` feeds a `RecorderAdapterNode` into an
 * `AnalyserNode`, and each frame's RMS becomes one bar. A recorder that
 * animates on a timer looks identical until you stop speaking — and then it
 * keeps dancing, which tells the user the thing is not listening to them. The
 * analyser is deliberately NOT connected to the destination: routing the mic to
 * the speakers is a feedback loop.
 *
 * The captured levels travel with the recording, so the player draws the shape
 * that was actually recorded rather than a fresh decode that never quite
 * matches.
 *
 * Lives in the kit because a voice note is not a notes-editor feature — a
 * message composer wants exactly this component.
 */
export function VoiceRecorder({ onComplete, onCancel, maxSeconds, className }: VoiceRecorderProps) {
  const store = useRef<ReturnType<typeof createRecorderStore> | null>(null);
  store.current ??= createRecorderStore();
  const recording = useStore(store.current, (state) => state.recording);
  const seconds = useStore(store.current, (state) => state.seconds);
  const levels = useStore(store.current, (state) => state.levels);
  const error = useStore(store.current, (state) => state.error);
  const take = useStore(store.current, (state) => state.take);

  const recorder = useRef<AudioRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<ReturnType<AudioContext['createAnalyser']> | null>(null);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  const clock = useRef<ReturnType<typeof setInterval> | null>(null);
  const captured = useRef<number[]>([]);

  const teardown = () => {
    if (meter.current !== null) clearInterval(meter.current);
    if (clock.current !== null) clearInterval(clock.current);
    meter.current = null;
    clock.current = null;
  };

  // A recorder holds the microphone, so an unmount mid-take must release it.
  useEffect(
    () => () => {
      teardown();
      void recorder.current?.stop();
      void context.current?.close();
    },
    [],
  );

  /**
   * Android needs a RUNTIME grant for the microphone; the manifest entry alone
   * is not enough on 13+. `AudioRecorder.start()` does not ask, it just fails —
   * so without this the first tap always errors, which reads as a broken
   * button rather than a permission the user can grant.
   */
  const ensurePermission = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone access',
        message: 'Recording a voice note needs the microphone.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const start = async () => {
    haptics.selection();
    captured.current = [];

    if (!(await ensurePermission())) {
      store.current?.getState().set({
        error: 'Microphone access is needed to record a voice note.',
      });
      return;
    }

    const instance = new AudioRecorder();
    instance.enableFileOutput();

    const started = await instance.start();
    if (started.status === 'error') {
      store.current?.getState().set({
        error: 'Could not start recording. Check the microphone permission.',
      });
      return;
    }

    // Mic -> recorder adapter (owned internally by AudioRecorder) -> analyser,
    // and stop there. Connecting the analyser to the destination would play the
    // microphone back through the speakers.
    const audioContext = new AudioContext();
    const node = audioContext.createAnalyser();
    node.fftSize = FFT_SIZE;
    instance.connect(audioContext, node);

    recorder.current = instance;
    context.current = audioContext;
    analyser.current = node;
    store.current?.getState().set({ recording: true, seconds: 0, levels: [], error: null });

    const buffer = new Uint8Array(node.frequencyBinCount);
    meter.current = setInterval(() => {
      const current = analyser.current;
      const state = store.current?.getState();
      if (current === null || state === undefined) return;

      current.getByteTimeDomainData(buffer);
      const level = frameLevel(buffer);
      captured.current.push(level);
      state.set({ levels: pushLevel(state.levels, level) });
    }, SAMPLE_MS);

    clock.current = setInterval(() => {
      const state = store.current?.getState();
      if (state === undefined) return;
      const next = state.seconds + 1;
      state.set({ seconds: next });
      if (maxSeconds !== undefined && next >= maxSeconds) void stop();
    }, 1000);
  };

  const stop = async () => {
    haptics.selection();
    teardown();

    const result = await recorder.current?.stop();
    recorder.current?.disconnect();
    void context.current?.close();
    recorder.current = null;
    context.current = null;
    analyser.current = null;

    const path = result?.status === 'success' ? result.paths[0] : undefined;
    store.current?.getState().set({ recording: false });

    if (path === undefined) {
      store.current?.getState().set({ error: 'Nothing was recorded.' });
      return;
    }

    // The take is REVIEWED, not sent. A voice note is the one attachment you
    // cannot check before committing — you either hear it back or you find out
    // later that the mic was covered. This is also why the review player uses
    // the captured levels: the shape you watched while recording is the shape
    // you scrub through.
    store.current?.getState().set({
      take: {
        uri: path,
        duration: result?.status === 'success' ? result.duration : seconds,
        levels: captured.current,
      },
    });
  };

  const cancel = () => {
    teardown();
    void recorder.current?.stop();
    recorder.current?.disconnect();
    void context.current?.close();
    recorder.current = null;
    context.current = null;
    onCancel();
  };

  const clock_ = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  if (take !== null) {
    return (
      <View className={`gap-4 ${className ?? ''}`}>
        <AudioPlayer
          uri={take.uri}
          duration={take.duration}
          levels={take.levels}
          label="Your recording"
        />

        <View className="flex-row gap-3">
          <Pressable
            role="button"
            aria-label="Record again"
            onPress={() => {
              store.current?.getState().set({ take: null, levels: [], seconds: 0 });
            }}
            className="h-11 flex-1 items-center justify-center rounded-md border-2 border-border bg-surface-raised px-3 transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
          >
            <Text numberOfLines={1} className="text-sm font-medium text-text md:text-base">Record again</Text>
          </Pressable>

          <Pressable
            role="button"
            aria-label="Use this recording"
            onPress={() => onComplete(take)}
            className="h-11 flex-1 items-center justify-center rounded-md border-2 border-border bg-primary px-3 shadow-card transition-colors duration-fast hover:bg-primary-pressed active:bg-primary-pressed motion-reduce:transition-none"
          >
            <Text numberOfLines={1} className="text-sm font-semibold text-on-primary md:text-base">Use recording</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className={`gap-4 ${className ?? ''}`}>
      {/* The waveform is the subject, so it gets the slab and the space. */}
      <View className="gap-2 rounded-md border-2 border-border bg-surface-sunken px-3 py-3">
        <Waveform levels={levels} height={56} />
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text md:text-base">{clock_}</Text>
          <Text className="text-xs text-text-muted md:text-sm">
            {recording ? 'Recording' : 'Ready'}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-center gap-4">
        {recording ? (
          <Pressable
            role="button"
            aria-label="Discard recording"
            onPress={cancel}
            className="h-12 w-12 items-center justify-center rounded-md border-2 border-border bg-surface-raised transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
          >
            <Trash2 size={20} className="text-danger" />
          </Pressable>
        ) : null}

        {/* One control that changes meaning in place, so the target never moves
            out from under the finger mid-take. */}
        <Pressable
          role="button"
          aria-label={recording ? 'Stop and keep recording' : 'Start recording'}
          onPress={() => void (recording ? stop() : start())}
          className={`h-16 w-16 items-center justify-center rounded-md border-2 border-border shadow-card transition-colors duration-fast motion-reduce:transition-none ${
            recording ? 'bg-danger' : 'bg-primary'
          }`}
        >
          {recording ? (
            <Square size={24} className="text-on-danger" />
          ) : (
            <Mic size={24} className="text-on-primary" />
          )}
        </Pressable>
      </View>

      <Text className="text-center text-sm text-text-muted md:text-base">
        {recording ? 'Tap the square to finish' : 'Tap the mic to start'}
      </Text>

      {error ? <Text className="text-center text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
