'use client';
/**
 * PLATFORM FORK — recycling list on native via @legendapp/list.
 */
import { LegendList } from '@legendapp/list/react-native';
import { View } from './tw';

export interface VirtualListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  /** Estimated row height in px. */
  estimatedItemSize?: number;
  /** Container classes — must size the container (e.g. "h-96" or "flex-1"). */
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
  return (
    <View className={className}>
      <LegendList
        data={data}
        renderItem={({ item, index }: { item: T; index: number }) => <>{renderItem({ item, index })}</>}
        keyExtractor={keyExtractor}
        estimatedItemSize={estimatedItemSize}
        onEndReached={onEndReached}
        recycleItems
        style={{ flex: 1 }}
      />
    </View>
  );
}
