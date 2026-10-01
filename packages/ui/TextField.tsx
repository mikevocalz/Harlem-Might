'use client';
import { tv } from 'tailwind-variants';
import { PasteWrapper, type PasteEventPayload } from './paste-wrapper';
import { View, Text as TWText } from './tw';
import { Input, Label } from './primitives';
import { Text } from './Text';

const field = tv({
  slots: {
    root: 'gap-1.5',
    label: 'text-sm font-medium text-text',
    // `w-full` is explicit because the field is an @expo/ui Host now, and a
    // Host sizes to its content — it no longer inherits a column's default
    // stretch, which is what left fields only as wide as their placeholder.
    input:
      'w-full min-h-11 justify-center rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 text-base text-text ' +
      'placeholder:text-text-muted/70 transition-all duration-fast ' +
      'focus:shadow-card focus:outline-none motion-reduce:transition-none',
    message: 'text-sm',
  },
  variants: {
    error: { true: { input: 'border-danger focus:border-danger', message: 'text-danger' } },
    disabled: { true: { input: 'opacity-50' } },
  },
});

export type { PasteEventPayload };

export interface TextFieldProps extends React.ComponentProps<typeof Input> {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  containerClassName?: string;
  /** Rich paste (text / images / GIFs from the clipboard) via expo-paste-input — iOS, Android, and web. */
  onPaste?: (payload: PasteEventPayload) => void;
}

export function TextField({
  label, hint, error, disabled, className, containerClassName, onPaste, ...inputProps
}: TextFieldProps) {
  const s = field({ error: !!error, disabled });
  const input = (
    <Input
      aria-label={label}
      aria-invalid={!!error}
      editable={!disabled}
      placeholderTextColor={undefined}
      className={s.input({ className: onPaste ? `pr-12 ${className ?? ''}` : className })}
      {...inputProps}
    />
  );
  return (
    <View className={s.root({ className: containerClassName })}>
      <Label className={s.label()}>{label}</Label>
      {onPaste ? (
        <PasteWrapper onPaste={onPaste}>
          <View className="relative">
            {input}
            <View
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border-2 border-border bg-surface-sunken px-1.5 py-0.5"
            >
              <TWText className="text-[10px] font-semibold tracking-wide text-text-muted">⌘V</TWText>
            </View>
          </View>
        </PasteWrapper>
      ) : input}
      {error ? (
        <Text className={s.message()}>{error}</Text>
      ) : hint ? (
        <Text tone="muted" variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}
