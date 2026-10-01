'use client';

import { SegmentedControl as ExpoSegmentedControl } from '@expo/ui/community/segmented-control';
import { View } from './tw';
import type { SegmentedControlProps } from './SegmentedControl.types';

/** Native segmented selection, powered by SwiftUI / Jetpack Compose. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  return (
    <View className={className}>
      <ExpoSegmentedControl
        values={options.map((option) => option.label)}
        selectedIndex={selectedIndex}
        onChange={(event) => {
          const next = options[event.nativeEvent.selectedSegmentIndex];
          if (next) onChange(next.value);
        }}
      />
    </View>
  );
}
