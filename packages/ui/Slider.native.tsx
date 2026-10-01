'use client';
import { Host, Slider as ExpoSlider } from '@expo/ui';
import { View } from './tw';
import { Text } from './Text';
import type { SliderProps } from './Slider.types';

/**
 * Range control, rendered by `@expo/ui` (SwiftUI / Jetpack Compose).
 *
 * A slider is exactly the kind of control worth handing to the platform: the
 * drag physics, the accessibility actions and the haptic detents are behaviour
 * a hand-rolled version has to reimplement and usually gets subtly wrong.
 *
 * The label stays in JS so it keeps the kit's type scale and className styling;
 * only the track itself is native.
 */
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 1,
  step,
  disabled,
  label,
  className,
}: SliderProps) {
  return (
    <View className={`gap-2 ${className ?? ''}`}>
      {label ? <Text className="text-sm font-medium text-text md:text-base">{label}</Text> : null}
      <Host matchContents>
        <ExpoSlider
          value={value}
          onValueChange={onValueChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
        />
      </Host>
    </View>
  );
}
