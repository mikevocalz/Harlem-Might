'use client';
import { useRef } from 'react';
import { createStore, useStore } from 'zustand';
import { Button, DropZone, Modal, MotionView } from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { CloudUpload, Paperclip, X } from '@acme/ui/icons';
import { attach, IDLE_PROGRESS, type AttachProgress, type Attachment } from './attachment.ts';
import { pickFile } from './pick-file';

import { useAttachStore } from './attach.store.ts';

function createProgressStore() {
  return createStore<{
    progress: AttachProgress;
    hovering: boolean;
    set: (progress: AttachProgress) => void;
    setHovering: (hovering: boolean) => void;
  }>((set) => ({
    progress: IDLE_PROGRESS,
    hovering: false,
    set: (progress) => set({ progress }),
    setHovering: (hovering) => set({ hovering }),
  }));
}

/**
 * Attach a file by dropping it in, or by choosing one.
 *
 * Drop uses `expo-drag-drop-content-view` through the kit's `DropZone`, which
 * is already how this app takes files. Choosing goes through `pickFile`, which
 * forks per platform because the browser has no document picker to call.
 *
 * The bar reports real bytes for a remote URL and completes immediately for a
 * local file, because a local file has already arrived — see `attachment.ts`
 * for why that distinction is kept rather than animating both.
 */
export function AttachSheet() {
  const open = useAttachStore((state) => state.open);
  const resolve = useAttachStore((state) => state.resolve);
  const onClose = () => resolve(null);
  const onAttached = (attachment: Attachment) => resolve(attachment);

  const store = useRef<ReturnType<typeof createProgressStore> | null>(null);
  store.current ??= createProgressStore();
  const progress = useStore(store.current, (state) => state.progress);
  const hovering = useStore(store.current, (state) => state.hovering);


  const report = (next: AttachProgress) => store.current?.getState().set(next);

  const run = async (source: { uri: string; name?: string }) => {
    const attachment = await attach(source, report);
    if (attachment) onAttached(attachment);
  };

  const choose = async () => {
    const picked = await pickFile();
    if (picked === null) return;
    await run(picked);
  };

  const percent = Math.round(progress.ratio * 100);
  const indeterminate = progress.phase === 'attaching' && progress.bytesTotal === null;

  return (
    /*
      A Modal, not an absolutely-positioned overlay. This component is mounted
      inside the notes editor, which is inside a bottom sheet — so `inset-0`
      covered the editor's box, not the screen, and the card was squeezed into
      whatever space the sheet had left. A Modal escapes that entirely and
      overlays the window, which is what a file dialog has to do.
    */
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-ink-950/40 p-6">
      {/* `overflow-hidden` is load-bearing, not decoration: React Native does
          not clip children to their parent, so once the card's content grew
          taller than the card the footer painted outside it — the Cancel button
          hanging off the bottom-right corner over the screen behind. The height
          cap keeps the card inside the viewport on a short window, and the drop
          zone gives up its own space first. */}
      <View className="w-full max-w-lg gap-4 overflow-hidden rounded-card border-2 border-border bg-surface-raised p-5 shadow-overlay">
        <View className="flex-row items-center gap-2">
          <Paperclip size={20} className="text-accent" />
          <Text className="flex-1 text-lg font-semibold text-text md:text-xl">Attach a file</Text>
          <Pressable
            aria-label="Close"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center rounded-md border-2 border-border bg-surface transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
          >
            <X size={18} className="text-text-muted" />
          </Pressable>
        </View>

        {/* The drop target carries its own browse action rather than leaving it
            to the footer: dropping is unavailable on a phone with no second app
            to drag from, and a drop zone whose only fallback is a button
            somewhere else reads as broken on those devices. */}
        <DropZone
          active={hovering}
          title={hovering ? 'Release to attach' : 'Drag and drop a file here'}
          description="Or browse from your device. Images, documents and audio."
          onEnter={() => store.current?.getState().setHovering(true)}
          onExit={() => store.current?.getState().setHovering(false)}
          className="h-64 p-4"
          onDrop={({ assets }) => {
            store.current?.getState().setHovering(false);
            const asset = assets[0];
            // A text-only drop carries no uri — there is nothing to attach.
            if (asset?.uri === undefined) return;
            void run({ uri: asset.uri, name: asset.fileName });
          }}
        >
          <View className="h-full w-full items-center justify-center gap-3">
            <View className="h-16 w-16 items-center justify-center rounded-md border-2 border-border bg-surface-raised shadow-card">
              <CloudUpload size={28} className={hovering ? 'text-accent' : 'text-text-muted'} />
            </View>
            <Text className="text-center text-base font-semibold text-text md:text-lg">
              {hovering ? 'Release to attach' : 'Drag and drop a file here'}
            </Text>
            <Pressable
              role="button"
              aria-label="Browse files"
              onPress={() => void choose()}
              className="min-h-11 items-center justify-center rounded-md border-2 border-border bg-surface-raised px-4 py-2 transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
            >
              <Text className="text-sm font-medium text-text md:text-base">Browse files</Text>
            </Pressable>
            <Text className="text-center text-xs text-text-muted md:text-sm">
              Images, documents and audio
            </Text>
          </View>
        </DropZone>

        {progress.phase === 'idle' ? null : (
          <View className="gap-2">
            <View className="flex-row items-baseline justify-between gap-2">
              <Text numberOfLines={1} className="flex-1 text-sm text-text md:text-base">
                {progress.name}
              </Text>
              <Text className="text-sm font-semibold text-text-muted md:text-base">
                {progress.phase === 'done'
                  ? 'Attached'
                  : progress.phase === 'error'
                    ? 'Failed'
                    : indeterminate
                      ? 'Attaching…'
                      : `${percent}%`}
              </Text>
            </View>

            {/* The track is full-width; the fill is the measured ratio. An
                indeterminate transfer fills the track rather than sitting at
                zero, which would read as stalled. */}
            <View className="h-3 overflow-hidden rounded-sm border-2 border-border bg-surface-sunken">
              <MotionView
                animate={{ width: `${progress.phase === 'done' || indeterminate ? 100 : percent}%` }}
                transition={{ type: 'timing', duration: 160 }}
                className={`h-full ${progress.phase === 'error' ? 'bg-danger' : 'bg-primary'}`}
              />
            </View>

            {progress.error ? (
              <Text className="text-sm text-danger">{progress.error}</Text>
            ) : null}
          </View>
        )}

        <View className="flex-row justify-end">
          <Button variant="outline" title="Cancel" onPress={onClose} />
        </View>
        </View>
      </View>
    </Modal>
  );
}
