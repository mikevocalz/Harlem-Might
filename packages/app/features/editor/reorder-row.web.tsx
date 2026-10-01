'use client';
import { Pressable, View } from '@acme/ui/tw';
import { GripVertical } from '@acme/ui/icons';
import type { ReorderRowProps } from './reorder-row.types.ts';

/**
 * Web fork — the handle reorders from the keyboard and mounts no gesture.
 *
 * Same call as the schedule's `event-drag.web`: react-native-gesture-handler
 * and Reanimated stay out of the Next bundle, which lists neither in
 * `transpilePackages` and has no GestureHandlerRootView to host them.
 *
 * Arrow Up / Arrow Down on the focused handle moves the row one place, which is
 * also the only route a keyboard user has through a drag list.
 */
export function ReorderRow({ children, label, index, count, rowHeight, onMove }: ReorderRowProps) {
  return (
    <View style={{ position: 'absolute', top: index * rowHeight, left: 0, right: 0 }}>
      <View className="mb-2 h-12 flex-row items-center gap-3 rounded-md border-2 border-border bg-surface-raised px-3">
        <Pressable
          role="button"
          aria-label={`Reorder ${label}`}
          onKeyDown={(nativeEvent) => {
            const key = (nativeEvent as { key?: string }).key;
            if (key !== 'ArrowUp' && key !== 'ArrowDown') return;
            (nativeEvent as { preventDefault?: () => void }).preventDefault?.();
            const step = key === 'ArrowDown' ? 1 : -1;
            const target = Math.min(Math.max(index + step, 0), count - 1);
            if (target !== index) onMove(index, target);
          }}
          className="h-11 w-8 items-center justify-center"
        >
          <GripVertical size={18} className="text-text-muted" />
        </Pressable>

        {children}
      </View>
    </View>
  );
}
