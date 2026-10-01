'use client';
/**
 * PLATFORM FORK — virtualized list on web via @tanstack/react-virtual.
 * The scroll container is a real overflow div (behavioral, like ScrollView);
 * give it a height via className (e.g. "h-96").
 */
import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  /** Estimated row height in px (rows self-measure after mount). */
  estimatedItemSize?: number;
  /** Scroll container classes — must size the container (e.g. "h-96"). */
  className?: string;
  onEndReached?: () => void;
}

export function VirtualList<T>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize = 56,
  className,
  onEndReached,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const endFiredAt = useRef(-1);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemSize,
    overscan: 8,
  });
  const items = virtualizer.getVirtualItems();

  const lastVisible = items[items.length - 1]?.index ?? -1;
  useEffect(() => {
    if (!onEndReached) return;
    if (lastVisible >= data.length - 1 && endFiredAt.current !== data.length) {
      endFiredAt.current = data.length;
      onEndReached();
    }
  }, [lastVisible, data.length, onEndReached]);

  return (
    <div ref={parentRef} className={`overflow-y-auto ${className ?? ''}`}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((vi) => {
          const item = data[vi.index] as T;
          return (
            <div
              key={keyExtractor?.(item, vi.index) ?? vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
            >
              {renderItem({ item, index: vi.index })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
