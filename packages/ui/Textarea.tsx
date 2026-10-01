'use client';
import { tv } from 'tailwind-variants';
import { PasteWrapper, type PasteEventPayload } from './paste-wrapper';
import { View, Text as TWText } from './tw';
import { Textarea as PrimitiveTextarea, Label } from './primitives';
import { Text } from './Text';

const field = tv({
  slots: {
    root: 'gap-1.5',
    label: 'text-sm font-medium text-text',
    input:
      'min-h-24 rounded-lg border-2 border-border bg-surface-raised px-3.5 py-2.5 text-base text-text ' +
      'placeholder:text-text-muted/70 transition-all duration-fast ' +
      'focus:shadow-card focus:outline-none motion-reduce:transition-none',
    message: 'text-sm',
  },
  variants: {
    error: { true: { input: 'border-danger focus:border-danger', message: 'text-danger' } },
    disabled: { true: { input: 'opacity-50' } },
  },
});

export interface TextareaProps extends React.ComponentProps<typeof PrimitiveTextarea> {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  containerClassName?: string;
  /** Rich paste (text / images / GIFs from the clipboard) via expo-paste-input — iOS, Android, and web. */
  onPaste?: (payload: PasteEventPayload) => void;
}

export function Textarea({
  label, hint, error, disabled, className, containerClassName, onPaste, ...inputProps
}: TextareaProps) {
  const s = field({ error: !!error, disabled });
  const input = (
    <PrimitiveTextarea
      aria-label={label}
      aria-invalid={!!error}
      editable={!disabled}
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
              className="absolute right-3 top-3 rounded-md border-2 border-border bg-surface-sunken px-1.5 py-0.5"
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
