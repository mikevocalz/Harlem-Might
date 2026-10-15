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
 * A host using this exported dialog should mount it once outside that sheet,
 * and ask for a file through this store. `request()` returns a promise that
 * settles when the user picks or cancels. No current app host mounts it.
 *
 * A successful request transfers ownership of the attachment and its optional
 * release callback to the caller. The host must retain it for as long as its
 * editor/document uses the URI, then release it; closing the dialog is not the
 * end of an adopted attachment's lifetime.
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
    const settle = get().settle;
    if (settle) settle(attachment);
    else attachment?.release?.();
    set({ open: false, settle: null });
  },
}));
