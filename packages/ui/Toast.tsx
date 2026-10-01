import { tv, type VariantProps } from 'tailwind-variants';
import { View } from './tw';
import { Text } from './Text';
import { SlideUp } from './motion';

// Presentational shell — visibility and entrance animation are owned by the
// nav shell / parent; transition-opacity is here so a parent opacity change
// animates for free.
const toast = tv({
  slots: {
    root:
      'w-full max-w-content-form flex-row items-start gap-3 rounded-card border-2 border-border bg-surface-raised p-4 ' +
      'shadow-overlay transition-opacity duration-base motion-reduce:transition-none',
    indicator: 'w-1 self-stretch rounded-full',
    body: 'flex-1 gap-0.5',
    title: 'text-sm font-medium text-text',
    description: 'text-sm text-text-muted',
  },
  variants: {
    variant: {
      info: { indicator: 'bg-primary' },
      success: { indicator: 'bg-accent' },
      error: { indicator: 'bg-danger', title: 'text-danger' },
    },
  },
  defaultVariants: { variant: 'info' },
});

export interface ToastProps extends VariantProps<typeof toast> {
  title: string;
  description?: string;
  className?: string;
}

export function Toast({ variant, title, description, className }: ToastProps) {
  const s = toast({ variant });
  return (
    <SlideUp role="status" className={s.root({ className })}>
      <View aria-hidden className={s.indicator()} />
      <View className={s.body()}>
        <Text className={s.title()}>{title}</Text>
        {description ? <Text className={s.description()}>{description}</Text> : null}
      </View>
    </SlideUp>
  );
}
