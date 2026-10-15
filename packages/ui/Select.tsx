'use client';
import { tv } from './tv';
import { Select as PrimitiveSelect } from './primitives';
import { FormField } from './FormField';

const field = tv({
  slots: {
    select:
      'rounded-lg border-2 border-border bg-surface-raised px-3.5 py-2.5 text-base text-text ' +
      'placeholder:text-text-muted/70 transition-all duration-fast ' +
      'focus:shadow-card focus:outline-none motion-reduce:transition-none',
  },
  variants: {
    error: { true: { select: 'border-danger focus:border-danger' } },
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
    <FormField label={label} hint={hint} error={error} className={containerClassName}>
      <PrimitiveSelect
        aria-label={label}
        disabled={disabled}
        className={s.select({ className })}
        {...selectProps}
      />
    </FormField>
  );
}
