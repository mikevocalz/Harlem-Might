'use client';
import { Pressable, View } from './tw';
import { Text } from './Text';
import { ChevronRight } from './icons';
import type { CollapsibleProps } from './Collapsible.types';

/**
 * Web disclosure in the kit's own language: a bordered row that rotates its
 * chevron, matching the slab grammar used elsewhere.
 */
export function Collapsible({ label, isOpen, onOpenChange, children, className }: CollapsibleProps) {
  return (
    <View className={`gap-2 ${className ?? ''}`}>
      <Pressable
        role="button"
        aria-expanded={isOpen}
        onPress={() => onOpenChange(!isOpen)}
        className="min-h-11 flex-row items-center gap-2 rounded-md border-2 border-border bg-surface-raised px-3 py-2 transition-colors duration-fast hover:bg-surface-sunken motion-reduce:transition-none"
      >
        <ChevronRight
          size={18}
          className={`text-text-muted transition-transform duration-fast motion-reduce:transition-none ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
        <Text className="flex-1 text-base font-medium text-text">{label}</Text>
      </Pressable>
      {isOpen ? <View className="gap-2 pl-6">{children}</View> : null}
    </View>
  );
}
