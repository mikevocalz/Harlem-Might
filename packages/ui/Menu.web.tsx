'use client';
import { useEffect, useRef } from 'react';
import { Pressable, View } from './tw';
import { Text } from './Text';
import type { MenuProps } from './Menu.types';

/**
 * Web menu, drawn in the kit's language.
 *
 * `details`/`summary` gives the toggle semantics for free; the listeners below
 * add what the element doesn't do on its own — close on outside pointer,
 * Escape, and after an action is chosen (a menu that stays open after "Sign
 * out" reads as broken).
 */
export function Menu({ children, actions, onAction, title, menuSide = 'down', className }: MenuProps) {
  const root = useRef<HTMLDetailsElement>(null);
  const close = () => root.current?.removeAttribute('open');

  useEffect(() => {
    const onPointerDown = (event: Event) => {
      const el = root.current;
      if (el?.open && event.target instanceof Node && !el.contains(event.target)) {
        el.removeAttribute('open');
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') root.current?.removeAttribute('open');
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <details ref={root} className={`relative ${className ?? ''}`}>
      <summary className="cursor-pointer list-none">{children}</summary>
      <View
        className={`absolute z-10 min-w-48 gap-1 rounded-md border-2 border-border bg-surface-raised p-1 shadow-card ${
          menuSide === 'up' ? 'bottom-full left-0 mb-1' : 'right-0 top-full mt-1'
        }`}
      >
        {title ? (
          <Text className="px-2 py-1 text-xs font-semibold uppercase text-text-muted">{title}</Text>
        ) : null}
        {actions.map((action) => (
          <Pressable
            key={action.id}
            role="menuitem"
            aria-disabled={action.disabled}
            onPress={() => {
              if (action.disabled) return;
              close();
              onAction(action.id);
            }}
            className={`min-h-11 justify-center rounded-sm px-3 py-2 transition-colors duration-fast motion-reduce:transition-none ${
              action.disabled ? 'opacity-50' : 'hover:bg-surface-sunken'
            }`}
          >
            <Text
              className={`text-base ${action.destructive ? 'text-danger' : 'text-text'}`}
            >
              {action.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </details>
  );
}
