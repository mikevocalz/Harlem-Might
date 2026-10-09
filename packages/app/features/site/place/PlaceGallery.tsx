'use client';

import { create } from 'zustand';
import type { EditorialImage } from '@acme/app/content';
import { Image, Lightbox } from '@acme/ui';
import { MightsButton, MightsEditorialImage, MightsLocationStamp } from '@acme/ui/mights';
import { Pressable, View } from '@acme/ui/tw';

// One gallery per page, so one store (repo rule: zustand for UI state).
const useGallery = create<{
  index: number;
  open: boolean;
  show: (index: number) => void;
  openAt: (index: number) => void;
  close: () => void;
}>((set) => ({
  index: 0,
  open: false,
  show: (index) => set({ index }),
  openAt: (index) => set({ index, open: true }),
  close: () => set({ open: false }),
}));

/**
 * The place's photographs: one large frame with its credit, a thumbnail strip
 * to switch it, and the kit Lightbox for full screen (Lightbox.stories.tsx
 * pattern: Pressable thumbnails over `Image`).
 */
export function PlaceGallery({
  images,
  placeId,
  name,
  street,
}: {
  images: readonly EditorialImage[];
  placeId: string;
  name: string;
  street?: string;
}) {
  const stored = useGallery((s) => s.index);
  const open = useGallery((s) => s.open);
  const { show, openAt, close } = useGallery.getState();
  const index = stored < images.length ? stored : 0;
  const current = images[index];
  if (!current) return null;

  return (
    <View className="gap-3">
      <View className="relative">
        <Pressable aria-label={`Open ${name} photos full screen`} onPress={() => openAt(index)}>
          <MightsEditorialImage
            key={current.id}
            image={current}
            screenId={`place-${placeId}`}
            ratio="wide"
            sizes="(min-width: 768px) 42vw, 100vw"
            priority={index === 0}
            interactiveCredit={false}
          />
        </Pressable>
        <MightsLocationStamp name={name} street={street} tone="dark" className="absolute left-4 top-4" />
      </View>
      {images.length > 1 ? (
        <View className="flex-row items-center gap-2">
          <View role="list" aria-label="Photos" className="min-w-0 flex-1 flex-row gap-2 overflow-x-auto">
            {images.map((image, i) => (
              <Pressable
                key={image.id}
                role="listitem"
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === index ? 'true' : undefined}
                onPress={() => show(i)}
                className={`shrink-0 border-2 transition-opacity duration-fast hover:opacity-90 active:opacity-80 ${
                  i === index ? 'border-primary' : 'border-transparent opacity-70'
                }`}
              >
                <Image src={image.url} alt="" unoptimized className="h-16 w-24" sizes="96px" />
              </Pressable>
            ))}
          </View>
          <MightsButton size="sm" variant="outline" onPress={() => openAt(index)}>
            {`All ${images.length} photos`}
          </MightsButton>
        </View>
      ) : null}
      <Lightbox images={images.map((i) => i.url)} initialIndex={index} open={open} onClose={close} />
    </View>
  );
}
