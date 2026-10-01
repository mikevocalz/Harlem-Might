import { tv, type VariantProps } from 'tailwind-variants';
import { View, Text } from './tw';

const badge = tv({
  slots: {
    root: 'flex-row items-center gap-1 self-start rounded-sm border-2 border-border px-2.5 py-0.5',
    label: 'text-xs font-bold',
  },
  variants: {
    tone: {
      neutral: { root: 'bg-surface-sunken', label: 'text-text-muted' },
      primary: { root: 'bg-burgundy-100 dark:bg-burgundy-900/60', label: 'text-burgundy-800 dark:text-burgundy-100' },
      accent: { root: 'bg-ember-100 dark:bg-ember-900/40', label: 'text-ember-800 dark:text-ember-100' },
      success: { root: 'bg-ember-50 dark:bg-ember-900/30', label: 'text-ember-700 dark:text-ember-200' },
      inverse: { root: 'bg-ink-50/15', label: 'text-ink-50' },
      danger: { root: 'bg-danger', label: 'text-on-danger' },
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends VariantProps<typeof badge> {
  label: string;
  className?: string;
}

export function Badge({ label, tone, className }: BadgeProps) {
  const { root, label: labelCls } = badge({ tone });
  return (
    <View className={root({ className })}>
      <Text className={labelCls()}>{label}</Text>
    </View>
  );
}

