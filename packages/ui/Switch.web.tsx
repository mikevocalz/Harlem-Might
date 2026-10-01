'use client';

import { haptics } from './haptics';
import { Pressable, View } from './tw';
import { Text } from './Text';
import type { SwitchProps } from './Switch.types';

export function Switch({ value, onChange, label, disabled, className }: SwitchProps) {
  return (
    <View
      className={`w-full flex-row items-center justify-between gap-3 ${disabled ? 'opacity-50' : ''} ${className ?? ''}`}
    >
      <Text className="min-w-0 flex-1">{label}</Text>
      <Pressable
        role="switch"
        aria-checked={value}
        aria-label={label}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => {
          if (disabled) return;
          haptics.selection();
          onChange(!value);
        }}
        className={`relative h-7 w-12 shrink-0 rounded-md border-2 transition-colors duration-base ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 ${
          value ? 'border-border-strong bg-primary' : 'border-border bg-surface-sunken'
        }`}
      >
        <View
          className={`absolute left-0 top-[2px] h-5 w-5 rounded-sm border-2 transition-transform duration-base ease-out motion-reduce:transition-none ${
            value
              ? 'translate-x-[22px] border-border-strong bg-ink-950'
              : 'translate-x-[2px] border-border bg-surface-raised'
          }`}
        />
      </Pressable>
    </View>
  );
}
