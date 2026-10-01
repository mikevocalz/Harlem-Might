'use client';
import { tv } from 'tailwind-variants';
import { Host, Checkbox as ExpoCheckbox } from '@expo/ui';
import { haptics } from './haptics';
// Native control tint comes from theme tokens — the platform toolkit
// (SwiftUI / Compose via @expo/ui Host) cannot consume Tailwind classes.
import { semantic } from '@acme/theme';
import { View } from './tw';
import { Text } from './Text';

const checkboxRow = tv({
  slots: { root: 'flex-row items-center gap-2.5 self-start' },
  variants: { disabled: { true: { root: 'opacity-50' } } },
});

export interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

// Native fork — the platform's real control via @expo/ui (Material Checkbox on
// Android; SwiftUI Toggle on iOS, where a switch IS the checkbox idiom).
// The web fork renders a styled <button role="checkbox">.
export function Checkbox({ checked, onChange, label, disabled, className }: CheckboxProps) {
  const s = checkboxRow({ disabled });
  return (
    <View className={s.root({ className })}>
      <Host matchContents seedColor={semantic.primary.light}>
        <ExpoCheckbox
          value={checked}
          onValueChange={(v: boolean) => { if (disabled) return; haptics.selection(); onChange(v); }}
          disabled={disabled}
        />
      </Host>
      <Text className="text-base" aria-label={label}>{label}</Text>
    </View>
  );
}
