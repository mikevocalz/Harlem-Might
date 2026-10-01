'use client';
import { useEffect } from 'react';
import { Modal } from 'react-native';
import { SolitoImage } from 'solito/image';
import { useInstanceStore, useStore } from './use-instance-store';
import { View, Text, Pressable } from './tw';

export interface LightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function Lightbox({ images, initialIndex = 0, open, onClose }: LightboxProps) {
  const store = useInstanceStore<{ index: number }>(() => ({ index: initialIndex }));
  const index = useStore(store, (s) => s.index);
  const setIndex = (updater: (i: number) => number) =>
    store.setState((s) => ({ index: updater(s.index) }));

  // Re-sync when reopened on a different image — initialIndex is otherwise
  // only read at mount.
  useEffect(() => {
    if (open) store.setState({ index: initialIndex });
  }, [open, initialIndex, store]);

  const count = images.length;

  // Keyboard navigation (web): ← → move, Escape closes. Native uses the
  // on-screen arrows and the Modal back handler.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') store.setState((s) => ({ index: Math.max(0, s.index - 1) }));
      else if (e.key === 'ArrowRight') store.setState((s) => ({ index: Math.min(count - 1, s.index + 1) }));
      else if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, count, onClose, store]);

  if (!images.length) return null;
  const current = images[index] ?? '';
  const hasMultiple = images.length > 1;

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-ink-950/95">
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close image"
          className="absolute right-4 top-4 z-10 rounded-md bg-ink-800/80 p-2 active:opacity-70"
        >
          <Text className="text-xl leading-none text-ink-50">×</Text>
        </Pressable>

        {hasMultiple ? (
          <Pressable
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            accessibilityLabel="Previous image"
            className="absolute bottom-0 left-0 top-0 z-10 w-16 justify-center pl-4 active:opacity-70"
          >
            <Text className={`text-3xl leading-none ${index === 0 ? 'text-ink-700' : 'text-ink-50'}`}>‹</Text>
          </Pressable>
        ) : null}

        <SolitoImage src={current} alt="" fill unoptimized contentFit="contain" sizes="100vw" />

        {hasMultiple ? (
          <Pressable
            onPress={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
            disabled={index === images.length - 1}
            accessibilityLabel="Next image"
            className="absolute bottom-0 right-0 top-0 z-10 w-16 items-end justify-center pr-4 active:opacity-70"
          >
            <Text className={`text-3xl leading-none ${index === images.length - 1 ? 'text-ink-700' : 'text-ink-50'}`}>›</Text>
          </Pressable>
        ) : null}

        {hasMultiple ? (
          <View className="absolute inset-x-0 bottom-8 flex-row justify-center gap-2">
            {images.map((_, i) => (
              <View
                key={i}
                className={`h-2 w-2 rounded-full ${i === index ? 'bg-ember-400' : 'bg-ink-500'}`}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
