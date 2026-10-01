import { tv, type VariantProps } from 'tailwind-variants';
import { SolitoImage } from 'solito/image';
import { View, Text } from './tw';

const avatar = tv({
  slots: {
    root: 'relative items-center justify-center overflow-hidden rounded-md border-2 border-border bg-burgundy-200',
    initials: 'font-semibold text-burgundy-800',
  },
  variants: {
    size: {
      sm: { root: 'h-8 w-8', initials: 'text-xs' },
      md: { root: 'h-11 w-11', initials: 'text-sm' },
      lg: { root: 'h-16 w-16', initials: 'text-xl' },
      xl: { root: 'h-24 w-24', initials: 'text-3xl' },
    },
  },
  defaultVariants: { size: 'md' },
});

export interface AvatarProps extends VariantProps<typeof avatar> {
  name: string;
  imageUri?: string;
  className?: string;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

export function Avatar({ name, imageUri, size, className }: AvatarProps) {
  const { root, initials } = avatar({ size });
  return (
    <View className={root({ className })} aria-label={name}>
      {imageUri ? (
        <SolitoImage
          src={imageUri}
          alt={name}
          fill
          unoptimized
          contentFit="cover"
          sizes="64px"
        />
      ) : (
        <Text className={initials()}>{initialsOf(name)}</Text>
      )}
    </View>
  );
}
