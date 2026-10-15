"use client";
import { useMemo, useEffect, useRef } from "react";
import { createStore, useStore } from "zustand";
import { AudioContext, decodeAudioData } from "react-native-audio-api";
import { View, Pressable } from "../tw";
import { Text } from "../Text";
import { Play, Pause, AudioLines } from "../icons";
import { haptics } from "../haptics";
import { Slider } from "../Slider";
import { Waveform } from "./Waveform.tsx";
import {
  createNativePlayerController,
  initialNativePlayerState,
  type NativePlayerState,
} from "./native-player-controller.ts";
import type { AudioPlayerProps } from "./AudioPlayer.types.ts";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * Play a voice note.
 *
 * The waveform is the recording's own shape: the recorder hands its captured
 * levels along, and the player only derives bars from the decoded file when it
 * was not given any — a note opened on another device, say. Rebuilding the bars
 * would make the same recording look different depending on where it was opened.
 *
 * `AudioBufferSourceNode` is one-shot by design in Web Audio: a stopped source
 * cannot restart, so each play builds a new one. The elapsed clock is derived
 * from the context's own time rather than a counter, so pausing and resuming
 * cannot drift away from the audio.
 */
export function AudioPlayer({
  uri,
  duration,
  levels,
  label,
  className,
}: AudioPlayerProps) {
  const store = useMemo(
    () => createStore<NativePlayerState>(() => initialNativePlayerState()),
    [],
  );
  const playing = useStore(store, (state) => state.playing);
  const elapsed = useStore(store, (state) => state.elapsed);
  const total = useStore(store, (state) => state.total);
  const bars = useStore(store, (state) => state.bars);
  const error = useStore(store, (state) => state.error);

  const controller = useRef<ReturnType<typeof createNativePlayerController> | null>(null);

  useEffect(() => {
    const current = createNativePlayerController({
      decode: decodeAudioData,
      createContext: () => new AudioContext(),
      createSource: (context) => context.createBufferSource(),
      connect: (context, source) => { source.connect(context.destination); },
      setOnEnded: (source, callback) => { source.onended = callback; },
      onChange: (state) => store.setState(state),
    });
    controller.current = current;
    void current.load(uri, duration, levels);
    return () => {
      controller.current = null;
      void current.dispose();
    };
  }, [uri, duration, levels, store]);

  const play = () => {
    if (controller.current?.play()) haptics.selection();
  };

  const pause = () => {
    haptics.selection();
    controller.current?.pause();
  };

  // A seek recreates the one-shot source only when the note was playing.
  const seek = (seconds: number) => {
    if (controller.current?.seek(seconds)) haptics.selection();
  };

  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  return (
    <View
      className={`my-2 gap-2 rounded-md border-2 border-border bg-surface-raised p-3 shadow-card ${className ?? ""}`}
    >
      {label ? (
        <View className="flex-row items-center gap-2">
          <AudioLines size={16} className="text-accent" />
          <Text className="flex-1 text-sm font-medium text-text md:text-base">
            {label}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center gap-3">
        <Pressable
          role="button"
          aria-label={playing ? "Pause" : "Play"}
          onPress={() => (store.getState().playing ? pause() : play())}
          className="h-12 w-12 items-center justify-center rounded-md border-2 border-border bg-primary shadow-card transition-colors duration-fast hover:bg-primary-pressed active:bg-primary-pressed motion-reduce:transition-none"
        >
          {playing ? (
            <Pause size={20} className="text-on-primary" />
          ) : (
            <Play size={20} className="text-on-primary" />
          )}
        </Pressable>

        <View className="flex-1 gap-1">
          <Waveform levels={bars} progress={progress} height={36} />

          {/* The waveform SHOWS position; the slider is what moves it. A
              waveform can be made draggable, but it is a poor target — bars are
              a few dp wide and it carries no accessibility semantics. The kit's
              Slider is the platform's own control, so it arrives with a
              keyboard path, screen-reader value announcements and the right
              touch slop already. */}
          <Slider
            value={elapsed}
            min={0}
            max={Math.max(total, 0.1)}
            onValueChange={seek}
            label={`Seek, ${clock(elapsed)} of ${clock(total)}`}
          />

          <View className="flex-row justify-between">
            <Text className="text-xs text-text-muted md:text-sm">
              {clock(elapsed)}
            </Text>
            <Text className="text-xs text-text-muted md:text-sm">
              {clock(total)}
            </Text>
          </View>
        </View>
      </View>

      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
