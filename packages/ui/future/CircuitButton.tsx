'use client';

import type { ReactNode } from 'react';
import { Pressable, Text, View } from '../tw';

export interface CircuitButtonProps {
  children: ReactNode;
  onPress?: () => void;
  tone?: 'cyan' | 'orange';
  variant?: 'solid' | 'outline';
  className?: string;
}

const tones = {
  cyan: '#00f3ff',
  orange: '#ff8a00',
} as const;

export function CircuitButton({
  children,
  onPress,
  tone = 'cyan',
  variant = 'outline',
  className,
}: CircuitButtonProps) {
  const accent = tones[tone];
  const solid = variant === 'solid';

  return (
    <Pressable
      onPress={onPress}
      className={`relative min-h-11 overflow-hidden px-5 py-3 active:opacity-80 ${className ?? ''}`}
      style={{
        borderWidth: 1,
        borderColor: accent,
        backgroundColor: solid ? accent : 'rgba(2,7,12,0.88)',
      }}
    >
      <View pointerEvents="none" className="absolute left-0 top-0 h-2 w-8" style={{ borderTopWidth: 2, borderLeftWidth: 2, borderColor: solid ? '#001014' : accent }} />
      <View pointerEvents="none" className="absolute bottom-0 right-0 h-2 w-8" style={{ borderBottomWidth: 2, borderRightWidth: 2, borderColor: solid ? '#001014' : accent }} />
      <Text className="text-center text-xs font-bold uppercase tracking-[0.22em]" style={{ color: solid ? '#001014' : accent }}>
        {children}
      </Text>
    </Pressable>
  );
}
