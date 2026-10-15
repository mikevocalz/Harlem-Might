import type { ReactNode } from 'react';
import { Text, View } from '../tw';

export interface GridCardProps {
  /** Compatibility fallback for label; label takes precedence, including an empty string. */
  eyebrow?: string;
  /** Preferred contextual label, rendered without changing its case. */
  label?: string;
  title: string;
  children?: ReactNode;
  /** Prefer semantic tones. orange aliases accent; cyan retains the focus color. */
  tone?: 'primary' | 'accent' | 'verdigris' | 'cyan' | 'orange';
  className?: string;
}

const toneClasses = {
  primary: {
    rail: 'bg-primary',
    label: 'text-primary',
    corner: 'border-primary/60',
  },
  accent: {
    rail: 'bg-accent',
    label: 'text-accent',
    corner: 'border-accent/60',
  },
  verdigris: {
    rail: 'bg-forest-600',
    label: 'text-forest-700 dark:text-forest-300',
    corner: 'border-forest-600/60',
  },
  // Public compatibility tones; internal callers use semantic names.
  cyan: {
    rail: 'bg-focus',
    label: 'text-focus',
    corner: 'border-focus/60',
  },
  orange: {
    rail: 'bg-accent',
    label: 'text-accent',
    corner: 'border-accent/60',
  },
} as const;

export function GridCard({
  eyebrow,
  label,
  title,
  children,
  tone = 'primary',
  className,
}: GridCardProps) {
  const style = toneClasses[tone];
  const contextLabel = label ?? eyebrow;

  return (
    <View
      className={`relative overflow-hidden rounded-card border border-border bg-surface-raised p-5 shadow-card ${className ?? ''}`}
    >
      <View className={`absolute left-0 top-0 h-0.5 w-20 ${style.rail}`} />
      <View
        pointerEvents="none"
        className={`absolute right-0 top-0 h-7 w-7 border-r border-t ${style.corner}`}
      />
      {contextLabel ? (
        <Text className={`mb-2 text-xs font-semibold ${style.label}`}>
          {contextLabel}
        </Text>
      ) : null}
      <Text className="text-lg font-semibold tracking-[-0.02em] text-text md:text-xl">
        {title}
      </Text>
      {children ? <View className="mt-3 gap-2">{children}</View> : null}
    </View>
  );
}
