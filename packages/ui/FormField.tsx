import { tv } from 'tailwind-variants';
import { View } from './tw';
import { Label } from './primitives';
import { Text } from './Text';

// Extracted label + hint/error shell from TextField — presentational only;
// the control itself comes in as children (controlled by the parent).
const formField = tv({
  slots: {
    root: 'gap-1.5',
    label: 'text-sm font-medium text-text',
    message: 'text-sm text-danger',
  },
  variants: {
    disabled: { true: { root: 'opacity-50' } },
  },
});

export interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function FormField({ label, children, hint, error, disabled, className }: FormFieldProps) {
  const s = formField({ disabled });
  return (
    <View className={s.root({ className })}>
      <Label className={s.label()}>{label}</Label>
      {children}
      {error ? (
        <Text role="alert" className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text tone="muted" variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}
