"use client";
import { useMemo, useEffect, useRef } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import { createStore, useStore } from "zustand";
import { AudioContext, AudioRecorder } from "react-native-audio-api";
import { View, Pressable } from "../tw";
import { Text } from "../Text";
import { Mic, Square, Trash2 } from "../icons";
import { haptics } from "../haptics";
import { AudioPlayer } from "./AudioPlayer";
import { Waveform } from "./Waveform.tsx";
import {
  createNativeRecorderController,
  initialNativeRecorderState,
  type NativeRecorderState,
} from "./native-recorder-controller.ts";
import type { VoiceRecorderProps } from "./VoiceRecorder.types.ts";

/** Android requires the runtime grant before acquiring a microphone session. */
async function ensurePermission() {
  if (Platform.OS !== "android") return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: "Microphone access",
      message: "Recording a voice note needs the microphone.",
      buttonPositive: "Allow",
      buttonNegative: "Not now",
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
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
export function VoiceRecorder({
  onComplete,
  onCancel,
  maxSeconds,
  className,
}: VoiceRecorderProps) {
  const store = useMemo(
    () => createStore<NativeRecorderState>(() => initialNativeRecorderState()),
    [],
  );
  const phase = useStore(store, (state) => state.phase);
  const recording = phase === "recording";
  const busy = phase === "starting" || phase === "stopping";
  const seconds = useStore(store, (state) => state.seconds);
  const levels = useStore(store, (state) => state.levels);
  const error = useStore(store, (state) => state.error);
  const take = useStore(store, (state) => state.take);
  const controller = useRef<ReturnType<typeof createNativeRecorderController> | null>(null);
  const limit = useRef(maxSeconds);

  useEffect(() => {
    limit.current = maxSeconds;
  }, [maxSeconds]);

  useEffect(() => {
    const current = createNativeRecorderController({
      ensurePermission,
      createRecorder: () => new AudioRecorder(),
      createContext: () => new AudioContext(),
      createAnalyser: (context) => context.createAnalyser(),
      // Mic -> analyser only. Connecting to the destination creates feedback.
      connect: (recorder, context, analyser) => {
        recorder.connect(context, analyser);
      },
      maxSeconds: () => limit.current,
      onChange: (state) => store.setState(state),
    });
    controller.current = current;
    store.setState(initialNativeRecorderState());
    return () => {
      controller.current = null;
      void current.dispose();
    };
  }, [store]);

  const start = () => {
    haptics.selection();
    void controller.current?.start();
  };
  const stop = () => {
    haptics.selection();
    void controller.current?.stop();
  };
  const cancel = () => {
    void controller.current?.cancel();
    onCancel();
  };

  const clock_ = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const status = recording ? "Recording"
    : phase === "starting" ? "Starting"
    : phase === "stopping" ? "Finishing" : "Ready";
  const hint = recording ? "Tap the square to finish"
    : phase === "starting" ? "Preparing the microphone"
    : phase === "stopping" ? "Finishing your recording" : "Tap the mic to start";

  if (take !== null) {
    return (
      <View className={`gap-4 ${className ?? ""}`}>
        <AudioPlayer
          uri={take.uri}
          duration={take.duration}
          levels={take.levels}
          label="Your recording"
        />

        {error ? (
          <Text className="text-center text-sm text-danger">{error}</Text>
        ) : null}

        <View className="flex-row gap-3">
          <Pressable
            role="button"
            aria-label="Record again"
            onPress={() => controller.current?.reset()}
            className="h-11 flex-1 items-center justify-center rounded-md border-2 border-border bg-surface-raised px-3 transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
          >
            <Text
              numberOfLines={1}
              className="text-sm font-medium text-text md:text-base"
            >
              Record again
            </Text>
          </Pressable>

          <Pressable
            role="button"
            aria-label="Use this recording"
            onPress={() => onComplete(take)}
            className="h-11 flex-1 items-center justify-center rounded-md border-2 border-border bg-primary px-3 shadow-card transition-colors duration-fast hover:bg-primary-pressed active:bg-primary-pressed motion-reduce:transition-none"
          >
            <Text
              numberOfLines={1}
              className="text-sm font-semibold text-on-primary md:text-base"
            >
              Use recording
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className={`gap-4 ${className ?? ""}`}>
      {/* The waveform is the subject, so it gets the slab and the space. */}
      <View className="gap-2 rounded-md border-2 border-border bg-surface-sunken px-3 py-3">
        <Waveform levels={levels} height={56} />
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text md:text-base">
            {clock_}
          </Text>
          <Text className="text-xs text-text-muted md:text-sm">
            {status}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-center gap-4">
        {recording || busy ? (
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
          aria-label={busy ? hint : recording ? "Stop and keep recording" : "Start recording"}
          disabled={busy}
          aria-busy={busy}
          accessibilityState={{ disabled: busy }}
          onPress={recording ? stop : start}
          className={`h-16 w-16 items-center justify-center rounded-md border-2 border-border shadow-card transition-colors duration-fast motion-reduce:transition-none ${
            recording ? "bg-danger" : "bg-primary"
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
        {hint}
      </Text>

      {error ? (
        <Text className="text-center text-sm text-danger">{error}</Text>
      ) : null}
    </View>
  );
}
