'use client';
// Web fork — the site header owns navigation; no in-content menu trigger.
export interface MenuButtonProps {
  className?: string;
  outerClassName?: string;
  iconSize?: number;
}

// Web has no drawer — the nav is always visible.
export function MenuButton(_props: MenuButtonProps = {}) {
  return null;
}
