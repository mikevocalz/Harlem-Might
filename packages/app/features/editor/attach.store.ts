'use client';
import { create } from 'zustand';
import type { Attachment } from './attachment.ts';

/**
 * The attach dialog's open state, hoisted out of the editor.
 *
 * The dialog CANNOT be mounted inside the notes editor. That editor lives in a
 * Gorhom bottom sheet, and mounting a React Native `Modal` inside one stops the
 * sheet mounting its content at all — the whole sheet disappears. Rendering it
 * as an absolute overlay instead confined it to the sheet's box, where it had
 * no room.
 *
 * So the dialog is mounted once at the app root, and the editor asks for a file
 * through this store. `request()` returns a promise that settles when the user
 * picks or cancels, which keeps the capability's `await pickFile()` shape
 * intact regardless of where the UI lives.
 */
interface AttachState {
  open: boolean;
  settle: ((attachment: Attachment | null) => void) | null;
  request: () => Promise<Attachment | null>;
  resolve: (attachment: Attachment | null) => void;
}

export const useAttachStore = create<AttachState>((set, get) => ({
  open: false,
  settle: null,

  request: () =>
    new Promise<Attachment | null>((settle) => {
      // A second request while one is open cancels the first, so no caller is
      // left waiting on a promise that can never settle.
      get().settle?.(null);
      set({ open: true, settle });
    }),

  resolve: (attachment) => {
    get().settle?.(attachment);
    set({ open: false, settle: null });
  },
}));
