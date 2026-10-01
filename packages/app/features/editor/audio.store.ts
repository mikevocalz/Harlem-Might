'use client';
import { create } from 'zustand';

export interface Recording {
  /** File URI of the finished recording. */
  uri: string;
  /** Length in seconds, as reported by the recorder. */
  duration: number;
}

/**
 * The voice-note recorder's open state.
 *
 * Same reasoning as the attach dialog: the editor lives inside a Gorhom bottom
 * sheet, and a dialog mounted in there either gets confined to the sheet's box
 * or — if it uses a Modal — stops the sheet mounting at all. So the recorder is
 * mounted once at the app root and asked for a recording through this store.
 */
interface AudioState {
  open: boolean;
  settle: ((recording: Recording | null) => void) | null;
  request: () => Promise<Recording | null>;
  resolve: (recording: Recording | null) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  open: false,
  settle: null,

  request: () =>
    new Promise<Recording | null>((settle) => {
      get().settle?.(null);
      set({ open: true, settle });
    }),

  resolve: (recording) => {
    get().settle?.(recording);
    set({ open: false, settle: null });
  },
}));

/** mm:ss for an elapsed-seconds count. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}
