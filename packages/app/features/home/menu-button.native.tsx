'use client';
// Drawer trigger (liquid-glass pattern) — walks up to the drawer navigator
// and dispatches OPEN_DRAWER. No direct @react-navigation import (banned in
// SDK 57); the action object is dispatched by shape.
import { useNavigation } from 'expo-router';
import { PressScale } from '@acme/ui';
import { Menu } from '@acme/ui/icons';

export interface MenuButtonProps {
  /** Override the button box — the rail needs a larger, centred target. */
  className?: string;
  outerClassName?: string;
  iconSize?: number;
}

export function MenuButton({ className, outerClassName, iconSize = 20 }: MenuButtonProps = {}) {
  const navigation = useNavigation();

  const openDrawer = () => {
    let parent: typeof navigation | undefined = navigation;
    while (parent && parent.getState()?.type !== 'drawer') {
      parent = parent.getParent();
    }
    parent?.dispatch({ type: 'OPEN_DRAWER' });
  };

  return (
    <PressScale
      aria-label="Open menu"
      onPress={openDrawer}
      className={`items-center justify-center rounded-md border-2 border-border bg-surface-raised ${className ?? 'h-10 w-10'}`}
      outerClassName={outerClassName ?? 'self-start'}
    >
      <Menu size={iconSize} className="text-text-muted" />
    </PressScale>
  );
}
