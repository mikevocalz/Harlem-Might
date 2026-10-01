'use client';
import { Pressable, View } from './tw';
import { Text } from './Text';
import type { MenuProps } from './Menu.types';

/**
 * Web menu, drawn in the kit's language.
 *
 * `details`/`summary` gives open-on-click, close-on-outside-click and Escape
 * for free, with the correct semantics — no state, no listeners, no focus trap
 * to get wrong.
 */
export function Menu({ children, actions, onAction, title, className }: MenuProps) {
  return (
    <details className={`relative ${className ?? ''}`}>
      <summary className="cursor-pointer list-none">{children}</summary>
      <View className="absolute right-0 top-full z-10 mt-1 min-w-48 gap-1 rounded-md border-2 border-border bg-surface-raised p-1 shadow-card">
        {title ? (
          <Text className="px-2 py-1 text-xs font-semibold uppercase text-text-muted">{title}</Text>
        ) : null}
        {actions.map((action) => (
          <Pressable
            key={action.id}
            role="menuitem"
            aria-disabled={action.disabled}
            onPress={() => !action.disabled && onAction(action.id)}
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
