'use client';
import { create } from 'zustand';

export type UrlKind = 'link' | 'youtube';

/**
 * The URL dialog's state.
 *
 * Replaces `Alert.prompt`, which is iOS-ONLY — on Android it does not exist, so
 * the link and YouTube buttons resolved null and silently did nothing. A
 * capability that works on one platform and quietly no-ops on the other is
 * worse than one that is absent, because nothing tells the user why.
 *
 * Root-mounted and store-driven for the same reason as the attach and record
 * dialogs: the editor lives in a bottom sheet, and a Modal mounted inside one
 * stops that sheet mounting its content.
 */
interface UrlState {
  open: boolean;
  kind: UrlKind;
  settle: ((url: string | null) => void) | null;
  request: (kind: UrlKind) => Promise<string | null>;
  resolve: (url: string | null) => void;
}

export const useUrlStore = create<UrlState>((set, get) => ({
  open: false,
  kind: 'link',
  settle: null,

  request: (kind) =>
    new Promise<string | null>((settle) => {
      get().settle?.(null);
      set({ open: true, kind, settle });
    }),

  resolve: (url) => {
    get().settle?.(url);
    set({ open: false, settle: null });
  },
}));
