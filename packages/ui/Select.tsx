'use client';
import { tv } from 'tailwind-variants';
import { View } from './tw';
import { Select as PrimitiveSelect, Label } from './primitives';
import { Text } from './Text';

const field = tv({
  slots: {
    root: 'gap-1.5',
    label: 'text-sm font-medium text-text',
    select:
      'rounded-lg border-2 border-border bg-surface-raised px-3.5 py-2.5 text-base text-text ' +
      'placeholder:text-text-muted/70 transition-all duration-fast ' +
      'focus:shadow-card focus:outline-none motion-reduce:transition-none',
    message: 'text-sm',
  },
  variants: {
    error: { true: { select: 'border-danger focus:border-danger', message: 'text-danger' } },
    disabled: { true: { select: 'opacity-50' } },
  },
});

export interface SelectProps extends React.ComponentProps<typeof PrimitiveSelect> {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  containerClassName?: string;
}

export function Select({
  label, hint, error, disabled, className, containerClassName, ...selectProps
}: SelectProps) {
  const s = field({ error: !!error, disabled });
  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      <PrimitiveSelect
        aria-label={label}
        disabled={disabled}
        className={s.select({ className })}
        {...selectProps}
      />
      {error ? (
        <Text className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text tone="muted" variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}
