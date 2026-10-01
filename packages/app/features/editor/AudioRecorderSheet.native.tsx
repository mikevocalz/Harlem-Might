'use client';
import { Modal, VoiceRecorder } from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Mic, X } from '@acme/ui/icons';
import { useAudioStore } from './audio.store.ts';

/**
 * The recorder, presented as a dialog.
 *
 * All of the recording lives in the kit's `VoiceRecorder` — this only presents
 * it. A message composer wanting voice notes should mount that component
 * directly rather than reaching for this dialog.
 *
 * Mounted at the app ROOT. The editor sits inside a Gorhom bottom sheet, and a
 * Modal mounted in there stops the sheet mounting its content at all; an
 * absolute overlay instead gets confined to the sheet's box.
 */
export function AudioRecorderSheet() {
  const open = useAudioStore((state) => state.open);
  const resolve = useAudioStore((state) => state.resolve);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => resolve(null)}>
      <View className="flex-1 items-center justify-center bg-ink-950/40 p-6">
        <View className="w-full max-w-md gap-5 overflow-hidden rounded-card border-2 border-border bg-surface-raised p-5 shadow-overlay">
          <View className="flex-row items-center gap-2">
            <Mic size={20} className="text-accent" />
            <Text className="flex-1 text-lg font-semibold text-text md:text-xl">Voice note</Text>
            <Pressable
              aria-label="Close"
              onPress={() => resolve(null)}
              className="h-11 w-11 items-center justify-center rounded-md border-2 border-border bg-surface transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
            >
              <X size={18} className="text-text-muted" />
            </Pressable>
          </View>

          <VoiceRecorder
            onComplete={(recording) =>
              resolve({ uri: recording.uri, duration: recording.duration })
            }
            onCancel={() => resolve(null)}
          />
        </View>
      </View>
    </Modal>
  );
}
