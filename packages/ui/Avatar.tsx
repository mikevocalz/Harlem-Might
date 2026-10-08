'use client';
import { tv, type VariantProps } from './tv';
import { SolitoImage } from 'solito/image';
import { View, Text } from './tw';

const avatar = tv({
  slots: {
    root:
      'relative shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-sunken',
    initials: 'font-semibold tracking-[-0.02em]',
  },
  variants: {
    size: {
      xs: { root: 'h-7 w-7', initials: 'text-[10px]' },
      sm: { root: 'h-8 w-8', initials: 'text-xs' },
      md: { root: 'h-11 w-11', initials: 'text-sm' },
      lg: { root: 'h-14 w-14', initials: 'text-base' },
      xl: { root: 'h-20 w-20', initials: 'text-2xl' },
    },
    entity: {
      person: { root: 'rounded-full' },
      business: { root: 'rounded-xl' },
    },
  },
  defaultVariants: { size: 'md', entity: 'person' },
});

const FALLBACK_TONES = [
  'bg-gold-50 text-gold-800',
  'bg-forest-50 text-forest-800',
  'bg-sky-50 text-sky-800',
  'bg-rose-50 text-rose-800',
] as const;

export interface AvatarProps extends VariantProps<typeof avatar> {
  name: string;
  imageUri?: string | null;
  fallbackLabel?: string;
  className?: string;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

const toneFor = (value: string) => {
  const index = Array.from(value).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return FALLBACK_TONES[index % FALLBACK_TONES.length];
};

export function Avatar({
  name,
  imageUri,
  fallbackLabel,
  size,
  entity,
  className,
}: AvatarProps) {
  const { root, initials } = avatar({ size, entity });
  const label = fallbackLabel?.trim() || initialsOf(name) || 'HM';

  return (
    <View className={root({ className })} aria-label={name}>
      {imageUri ? (
        <SolitoImage
          src={imageUri}
          alt={name}
          fill
          unoptimized
          contentFit="cover"
          sizes="80px"
        />
      ) : (
        <View className={`h-full w-full items-center justify-center ${toneFor(name)}`}>
          <Text className={initials()}>{label}</Text>
        </View>
      )}
    </View>
  );
}
