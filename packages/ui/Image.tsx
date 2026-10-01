'use client';
import type { ComponentProps } from 'react';
import { SolitoImage } from 'solito/image';
import { View } from './tw';

type SolitoImageProps = ComponentProps<typeof SolitoImage>;

export interface ImageProps extends Omit<SolitoImageProps, 'fill'> {
  /** Tailwind classes for the wrapper (size the image here when using fill). */
  className?: string;
  /** Fill the wrapper (wrapper must have dimensions via className). Default true when no width/height given. */
  fill?: boolean;
}

// Universal content image — SolitoImage renders next/image on web and
// expo-image on native, so one component covers both.
export function Image({ className, fill, width, height, ...props }: ImageProps) {
  const useFill = fill ?? (width == null && height == null);
  if (!useFill) {
    return <SolitoImage width={width} height={height} {...props} />;
  }
  return (
    <View className={`relative overflow-hidden ${className ?? ''}`}>
      <SolitoImage fill contentFit="cover" {...props} />
    </View>
  );
}
