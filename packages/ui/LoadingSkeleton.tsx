import { tv, type VariantProps } from 'tailwind-variants';
import { View } from './tw';

const skeleton = tv({
  base: 'animate-pulse bg-surface-sunken motion-reduce:animate-none',
  variants: {
    variant: {
      line: 'h-4 w-full rounded-md',
      card: 'h-32 w-full rounded-card',
      avatar: 'h-12 w-12 rounded-full',
      custom: '',
    },
  },
  defaultVariants: { variant: 'line' },
});

export interface LoadingSkeletonProps extends VariantProps<typeof skeleton> {
  /** Number of blocks to render (default 1). */
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ variant, count = 1, className }: LoadingSkeletonProps) {
  if (count <= 1) {
    return <View aria-hidden className={skeleton({ variant, className })} />;
  }
  return (
    <View aria-hidden className="gap-2">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className={skeleton({ variant, className })} />
      ))}
    </View>
  );
}
