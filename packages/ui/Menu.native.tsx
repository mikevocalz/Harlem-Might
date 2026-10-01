'use client';

import { MenuView } from '@expo/ui/community/menu';
import { View } from './tw';
import type { MenuProps } from './Menu.types';

/**
 * Native anchored menu backed by the operating system.
 * Expo UI maps this to SwiftUI Menu / ContextMenu and Jetpack Compose
 * DropdownMenu, so measurement, placement, dismissal and accessibility stay
 * with the platform rather than a hand-built React Native modal.
 */
export function Menu({ children, actions, onAction, title, className }: MenuProps) {
  return (
    <View className={className}>
      <MenuView
        title={title}
        actions={actions.map((action) => ({
          id: action.id,
          title: action.title,
          attributes: {
            destructive: action.destructive,
            disabled: action.disabled,
          },
        }))}
        onPressAction={(event) => onAction(event.nativeEvent.event)}
      >
        {children}
      </MenuView>
    </View>
  );
}
