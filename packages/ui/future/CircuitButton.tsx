'use client';

import type { ReactNode } from 'react';
import { Pressable, Text, View } from '../tw';

export interface CircuitButtonProps {
  children: ReactNode;
  onPress?: () => void;
  tone?: 'primary' | 'accent' | 'cyan' | 'orange';
  variant?: 'solid' | 'outline';
  className?: string;
}

const tones = {
  primary: {
    solid: 'border-primary bg-primary',
    outline: 'border-border-strong bg-surface-raised',
    solidText: 'text-on-primary',
    outlineText: 'text-primary',
    rail: 'bg-primary',
  },
  accent: {
    solid: 'border-accent bg-accent',
    outline: 'border-border-strong bg-surface-raised',
    solidText: 'text-on-accent',
    outlineText: 'text-accent',
    rail: 'bg-accent',
  },
  // Compatibility mappings for starter stories/call sites.
  cyan: {
    solid: 'border-focus bg-focus',
    outline: 'border-border-strong bg-surface-raised',
    solidText: 'text-text-inverse',
    outlineText: 'text-focus',
    rail: 'bg-focus',
  },
  orange: {
    solid: 'border-accent bg-accent',
    outline: 'border-border-strong bg-surface-raised',
    solidText: 'text-on-accent',
    outlineText: 'text-accent',
    rail: 'bg-accent',
  },
} as const;

export function CircuitButton({
  children,
  onPress,
  tone = 'primary',
  variant = 'outline',
  className,
}: CircuitButtonProps) {
  const style = tones[tone];
  const solid = variant === 'solid';

  return (
    <Pressable
      onPress={onPress}
      className={`relative min-h-11 overflow-hidden rounded-md border px-5 py-3 shadow-card transition-all duration-fast active:translate-x-px active:translate-y-px active:shadow-none motion-reduce:transition-none ${solid ? style.solid : style.outline} ${className ?? ''}`}
    >
      <View
        pointerEvents="none"
        className={`absolute left-0 top-0 h-0.5 w-9 ${style.rail}`}
      />
      <View
        pointerEvents="none"
        className={`absolute bottom-0 right-0 h-2 w-8 border-b border-r ${solid ? 'border-white/55' : 'border-border-strong/60'}`}
      />
      <Text
        className={`text-center text-sm font-semibold ${solid ? style.solidText : style.outlineText}`}
      >
        {children}
      </Text>
    </Pressable>
  );
}
