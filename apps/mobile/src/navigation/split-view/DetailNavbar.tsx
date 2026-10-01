'use client';
import { useWindowDimensions } from 'react-native';
import { Text, View } from '@acme/ui/tw';
import { IconButton } from '@acme/ui';
import { ChevronLeft, X } from '@acme/ui/icons';
import { windowSizeClassForWidth } from './constants.ts';
import { isCollapsed } from './constants.ts';

export interface DetailNavbarProps {
  title: string;
  /** Dismisses the detail. Wired to Back on compact, to a close button above it. */
  onDismiss: () => void;
  children?: React.ReactNode;
}

/**
 * The detail pane's bar, whose contents differ by size class.
 *
 * When the pane is presented ALONE — compact, where the split view shows one
 * column at a time — it needs a back affordance, because there is nothing else
 * on screen to return to and the row that opened it is gone. When it sits
 * BESIDE its list, that back arrow would be a lie: the list never went away, so
 * the control is a close button instead.
 *
 * Same component either way rather than two screen variants: the reference
 * project swapped whole subtrees per size class, which remounts on rotation and
 * drops scroll position and selection with it.
 */
export function DetailNavbar({ title, onDismiss, children }: DetailNavbarProps) {
  const { width } = useWindowDimensions();
  const alone = isCollapsed(windowSizeClassForWidth(width));

  return (
    <View className="flex-row items-center gap-2">
      {alone ? (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Back"
          icon={<ChevronLeft className="text-text-muted" />}
          onPress={onDismiss}
        />
      ) : null}

      <Text className="flex-1 text-base font-semibold text-text md:text-lg lg:text-xl">
        {title}
      </Text>

      {children}

      {alone ? null : (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Close details"
          icon={<X className="text-text-muted" />}
          onPress={onDismiss}
        />
      )}
    </View>
  );
}
