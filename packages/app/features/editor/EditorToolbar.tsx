'use client';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Settings2 } from '@acme/ui/icons';
import { CAPABILITY_BY_ID, type CapabilityContext, type EditorStateKey } from './capabilities.ts';
import { iconFor } from './icon-map.ts';
import { visibleToolbarIds } from './preferences.ts';
import { useEditorPreferences } from './preferences.store';

export interface EditorToolbarProps {
  context: CapabilityContext;
  /** Active formatting at the caret, from the editor's `onChangeState`. */
  activeState?: Partial<Record<EditorStateKey, { isActive: boolean }>>;
  /**
   * Opens editor settings. A CALLBACK rather than an href: solito's Link does
   * not navigate on native here — it resolves against a linking config
   * expo-router never populates — so the host passes its own router.
   */
  onOpenSettings?: () => void;
}

/**
 * The toolbar.
 *
 * A PURE PROJECTION of the registry and the user's preferences — it holds no
 * state of its own and decides nothing. Which buttons exist, their order, and
 * whether each is enabled all come from elsewhere; this only draws them and
 * calls `run`.
 *
 * It wraps onto a second row rather than scrolling horizontally: a scrolling
 * toolbar hides its own contents, and a user who has arranged their buttons
 * should be able to see all of them at once.
 */
export function EditorToolbar({ context, activeState, onOpenSettings }: EditorToolbarProps) {
  const preferences = useEditorPreferences((state) => state.preferences);
  const ids = visibleToolbarIds(preferences);

  return (
    <View className="flex-row flex-wrap items-center gap-1 rounded-md border-2 border-border bg-surface-sunken p-2">
      {ids.map((id) => {
        const capability = CAPABILITY_BY_ID[id];
        if (capability === undefined) return null;

        const Icon = iconFor(capability.icon);
        const isActive =
          capability.stateKey !== undefined &&
          activeState?.[capability.stateKey]?.isActive === true;
        const isEnabled = capability.isEnabled?.(context) ?? true;

        return (
          <Pressable
            key={id}
            role="button"
            aria-label={capability.label}
            aria-pressed={isActive}
            aria-disabled={!isEnabled}
            onPress={() => {
              if (isEnabled) void capability.run?.(context);
            }}
            className={`h-11 w-11 items-center justify-center rounded-md border-2 transition-colors duration-fast motion-reduce:transition-none ${
              isActive
                ? 'border-border bg-primary shadow-card'
                : 'border-transparent hover:bg-surface-raised active:bg-surface-raised'
            } ${isEnabled ? '' : 'opacity-40'}`}
          >
            <Icon size={18} className={isActive ? 'text-on-primary' : 'text-text'} />
          </Pressable>
        );
      })}

      {onOpenSettings ? (
        <>
          <View className="mx-1 h-6 w-px bg-border/30" />
          <Pressable
            role="button"
            aria-label="Editor settings"
            onPress={onOpenSettings}
            className="h-11 w-11 items-center justify-center rounded-md border-2 border-transparent transition-colors duration-fast hover:bg-surface-raised active:bg-surface-raised motion-reduce:transition-none"
          >
            <Settings2 size={18} className="text-text-muted" />
          </Pressable>
        </>
      ) : null}

      {ids.length === 0 ? (
        <Text className="px-2 py-1 text-sm text-text-muted">
          No buttons enabled — add some in editor settings.
        </Text>
      ) : null}
    </View>
  );
}
