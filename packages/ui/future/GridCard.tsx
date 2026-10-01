import type { ReactNode } from 'react';
import { Text, View } from '../tw';

export interface GridCardProps {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  tone?: 'cyan' | 'orange';
  className?: string;
}

export function GridCard({ eyebrow, title, children, tone = 'cyan', className }: GridCardProps) {
  const accent = tone === 'cyan' ? '#00f3ff' : '#ff8a00';
  return (
    <View className={`relative overflow-hidden border bg-black/80 p-5 ${className ?? ''}`} style={{ borderColor: `${accent}55` }}>
      <View className="absolute left-0 top-0 h-px w-20" style={{ backgroundColor: accent }} />
      <View className="absolute right-0 top-0 h-7 w-px" style={{ backgroundColor: accent }} />
      {eyebrow ? (
        <Text className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: accent }}>
          {eyebrow}
        </Text>
      ) : null}
      <Text className="text-lg font-bold uppercase tracking-[0.08em] text-white">{title}</Text>
      {children ? <View className="mt-3 gap-2">{children}</View> : null}
    </View>
  );
}
