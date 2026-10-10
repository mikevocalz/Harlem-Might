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
import { summarise } from "./waveform.ts";
import type { AudioPlayerProps } from "./AudioPlayer.types.ts";

const TICK_MS = 60;

function createPlayerStore() {
  return createStore<{
    playing: boolean;
    elapsed: number;
    total: number;
    bars: number[];
    error: string | null;
    set: (
      next: Partial<{
        playing: boolean;
        elapsed: number;
        total: number;
        bars: number[];
        error: string | null;
      }>,
    ) => void;
  }>((set) => ({
    playing: false,
    elapsed: 0,
    total: 0,
    bars: [],
    error: null,
    set: (next) => set(next),
  }));
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * Play a voice note.
 *
 * The waveform is the recording's own shape: the recorder hands its captured
 * levels along, and the player only decodes the file when it was not given any
 * — a note opened on another device, say. Decoding on every render would make
 * the same recording look different depending on where it was opened.
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
  const store = useMemo(() => createPlayerStore(), []);
  const playing = useStore(store, (state) => state.playing);
  const elapsed = useStore(store, (state) => state.elapsed);
  const total = useStore(store, (state) => state.total);
  const bars = useStore(store, (state) => state.bars);
  const error = useStore(store, (state) => state.error);

  const context = useRef<AudioContext | null>(null);
  const buffer = useRef<Awaited<ReturnType<typeof decodeAudioData>> | null>(
    null,
  );
  const source = useRef<ReturnType<AudioContext["createBufferSource"]> | null>(
    null,
  );
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const offset = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const decoded = await decodeAudioData(uri);
        if (cancelled) return;

        buffer.current = decoded;
        // Only decode a waveform when the recorder did not supply one.
        const shape =
          levels !== undefined && levels.length > 0
            ? summarise(levels)
            : summarise(Array.from(decoded.getChannelData(0)));

        store
          ?.getState()
          .set({ total: duration ?? decoded.duration, bars: shape });
      } catch {
        if (!cancelled) {
          store
            ?.getState()
            .set({ error: "This recording could not be opened." });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (ticker.current !== null) clearInterval(ticker.current);
      source.current?.stop();
      void context.current?.close();
    };
  }, [uri, duration, levels]);

  const play = () => {
    const decoded = buffer.current;
    if (decoded === null) return;
    haptics.selection();

    const audioContext = context.current ?? new AudioContext();
    context.current = audioContext;

    const node = audioContext.createBufferSource();
    node.buffer = decoded;
    node.connect(audioContext.destination);
    node.onended = () => {
      if (ticker.current !== null) clearInterval(ticker.current);
      offset.current = 0;
      store?.getState().set({ playing: false, elapsed: 0 });
    };

    node.start(0, offset.current);
    source.current = node;
    startedAt.current = audioContext.currentTime;
    store?.getState().set({ playing: true });

    ticker.current = setInterval(() => {
      const played =
        offset.current + (audioContext.currentTime - startedAt.current);
      store?.getState().set({ elapsed: played });
    }, TICK_MS);
  };

  const pause = () => {
    haptics.selection();
    if (ticker.current !== null) clearInterval(ticker.current);
    const audioContext = context.current;
    if (audioContext !== null) {
      offset.current += audioContext.currentTime - startedAt.current;
    }
    source.current?.stop();
    source.current = null;
    store?.getState().set({ playing: false });
  };

  /**
   * Jump to a position.
   *
   * `AudioBufferSourceNode` is one-shot in Web Audio — a stopped source cannot
   * be restarted — so seeking tears the current source down and `play()` builds
   * a new one from the offset. Playback resumes only if it was already running,
   * so dragging the slider on a paused note scrubs without starting it.
   */
  const seek = (seconds: number) => {
    const wasPlaying = playing;
    if (ticker.current !== null) clearInterval(ticker.current);
    source.current?.stop();
    source.current = null;

    offset.current = Math.max(0, Math.min(seconds, total));
    store?.getState().set({ elapsed: offset.current, playing: false });
    if (wasPlaying) play();
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
          onPress={() => (playing ? pause() : play())}
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
