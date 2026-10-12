'use client';
import { tv } from './tv';
import { PasteWrapper, type PasteEventPayload } from './paste-wrapper';
import { View, Text as TWText } from './tw';
import { Textarea as PrimitiveTextarea } from './primitives';
import { FormField } from './FormField';

const field = tv({
  slots: {
    input:
      'min-h-24 rounded-lg border-2 border-border bg-surface-raised px-3.5 py-2.5 text-base text-text ' +
      'placeholder:text-text-muted/70 transition-all duration-fast ' +
      'focus:shadow-card focus:outline-none motion-reduce:transition-none',
  },
  variants: {
    error: { true: { input: 'border-danger focus:border-danger' } },
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
    <FormField label={label} hint={hint} error={error} className={containerClassName}>
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
    </FormField>
  );
}
