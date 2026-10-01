'use client';

import { Slider as ExpoSlider } from '@expo/ui';
import { View } from './tw';
import { Text } from './Text';
import type { SliderProps } from './Slider.types';

/**
 * Web uses Expo UI's universal slider. Its web implementation owns the real
 * range input, so raw HTML never leaks out of the UI package's platform layer.
 */
export function Slider({
  value, onValueChange, min = 0, max = 1, step, disabled, label, className,
}: SliderProps) {
  return (
    <View className={`gap-2 ${className ?? ''}`}>
      {label ? <Text className="text-sm font-medium text-text md:text-base">{label}</Text> : null}
      <ExpoSlider
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </View>
  );
}
