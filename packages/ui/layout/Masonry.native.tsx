'use client';
import { Children, type ReactNode } from 'react';
import { View } from '../tw';
import { useInstanceStore, useStore } from '../use-instance-store';
import { masonryColumnCount } from './masonry-layout';

/** Native columns follow the available container, including fold/unfold and split screen. */
export function Masonry({ children }: { children: ReactNode }) {
  const store = useInstanceStore(() => ({ width: 0 }));
  const width = useStore(store, (s) => s.width);
  const items = Children.toArray(children);
  const count = Math.min(items.length || 1, masonryColumnCount(width));
  return (
    <View
      className="w-full flex-row items-start gap-4"
      onLayout={(event) => store.setState({ width: event.nativeEvent.layout.width })}
    >
      {Array.from({ length: count }, (_, column) => (
        <View key={column} className="min-w-0 flex-1 gap-4">
          {items.filter((_, index) => index % count === column)}
        </View>
      ))}
    </View>
  );
}
