'use client';
import { Pressable, View } from './tw';
import { Text } from './Text';
import type { ListProps, ListItemProps } from './List.types';

/**
 * Web list: a bordered slab of rows separated by rules, matching Card. Pull to
 * refresh has no web equivalent, so `onRefresh` is accepted and ignored to keep
 * one prop set across platforms.
 */
export function List({ children, onRefresh: _onRefresh, className }: ListProps) {
  return (
    <View
      role="list"
      className={`overflow-hidden rounded-card border-2 border-border bg-surface-raised shadow-card ${className ?? ''}`}
    >
      {children}
    </View>
  );
}

export function ListItem({
  children, onPress, leading, trailing, supportingText, className,
}: ListItemProps) {
  const content = (
    <View className="min-h-11 flex-row items-center gap-3 px-4 py-3">
      {leading}
      <View className="flex-1">
        <Text className="text-base text-text">{children}</Text>
        {supportingText ? (
          <Text className="text-sm text-text-muted">{supportingText}</Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return <View role="listitem" className={`border-b-2 border-border/20 ${className ?? ''}`}>{content}</View>;
  }

  return (
    <Pressable
      role="listitem"
      onPress={onPress}
      className={`border-b-2 border-border/20 transition-colors duration-fast hover:bg-surface-sunken motion-reduce:transition-none ${className ?? ''}`}
    >
      {content}
    </Pressable>
  );
}
