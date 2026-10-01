'use client';
import Animated from 'react-native-reanimated';
import { Text, View } from '@acme/ui/tw';
import type { StickyHeader } from './use-sticky-header.ts';

export interface PaneListHeaderProps {
  title: string;
  /** Context line — a count, a filter, whatever the list is currently showing. */
  subtitle?: string;
  header: StickyHeader;
  /** Controls rendered at the trailing edge (toggles, filters). */
  children?: React.ReactNode;
}

/**
 * The list pane's auto-hiding title bar.
 *
 * Absolutely positioned so retracting it does not reflow the list underneath —
 * a header that takes layout space would make every row jump as it hides. The
 * scroll view compensates with top padding equal to this height.
 *
 * `Animated.View` here, not the kit's MotionView: the style comes from a
 * Reanimated shared value driven by the scroll handler on the UI thread.
 */
export function PaneListHeader({ title, subtitle, header, children }: PaneListHeaderProps) {
  return (
    <Animated.View
      onLayout={(event) => header.onHeaderLayout(event.nativeEvent.layout.height)}
      style={header.headerStyle}
      className="absolute left-0 right-0 top-0 z-10 flex-row items-center gap-2 border-b-2 border-border bg-surface px-4 py-3"
    >
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-text md:text-lg">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="text-xs text-text-muted md:text-sm">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </Animated.View>
  );
}
