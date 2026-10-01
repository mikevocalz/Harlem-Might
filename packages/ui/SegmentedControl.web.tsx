'use client';

import { Pressable, View } from './tw';
import { Text } from './Text';
import type { SegmentedControlProps } from './SegmentedControl.types';

/** Semantic web fork; all actual DOM is emitted by @acme/ui/html. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <View
      role="tablist"
      className={`flex-row gap-1 rounded-md border-2 border-border bg-surface-sunken p-1 ${className ?? ''}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="tab"
            aria-selected={isActive}
            onPress={() => onChange(option.value)}
            className={`min-h-9 items-center justify-center rounded-sm px-3 py-1.5 transition-colors duration-fast md:px-4 md:py-2 motion-reduce:transition-none ${
              isActive ? 'bg-primary' : 'hover:bg-surface-raised'
            }`}
          >
            <Text
              className={`text-sm font-medium md:text-base ${
                isActive ? 'text-on-primary' : 'text-text-muted'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
