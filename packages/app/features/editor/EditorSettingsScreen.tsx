'use client';
import { useMemo, useRef } from 'react';
import { Container, Switch, Text as KitText } from '@acme/ui';
// Gesture Handler's ScrollView, not React Native's: `blocksExternalGesture`
// can only block a handler RNGH knows about, and a plain RN scroller has none —
// which is why the drag lost every vertical gesture to it.
import { ScrollView } from 'react-native-gesture-handler';
import { Pressable, Text, View } from '@acme/ui/tw';
import {
  CAPABILITY_BY_ID,
  GROUP_LABEL,
  type Capability,
  type CapabilityGroup,
} from './capabilities.ts';
import { iconFor } from './icon-map.ts';
import { ReorderRow } from './reorder-row';
import { SETTINGS_ROWS, visibleToolbarIds } from './preferences.ts';
import { useEditorPreferences } from './preferences.store';

/** Row height, in dp. The drag maths converts travel into index steps. */
const ROW_HEIGHT = 56;

/**
 * Editor settings.
 *
 * Two jobs, deliberately separated on screen: ARRANGE the buttons that are on
 * the toolbar, and CHOOSE which advanced capabilities exist at all. Mixing them
 * into one list made it impossible to tell whether dragging a switched-off row
 * meant anything.
 */
export function EditorSettingsScreen() {
  const preferences = useEditorPreferences((state) => state.preferences);
  const move = useEditorPreferences((state) => state.move);
  const toggle = useEditorPreferences((state) => state.toggle);
  const reset = useEditorPreferences((state) => state.reset);

  const visible = visibleToolbarIds(preferences);

  const grouped = useMemo(() => {
    const groups = new Map<CapabilityGroup, Capability[]>();
    for (const capability of SETTINGS_ROWS) {
      const list = groups.get(capability.group) ?? [];
      list.push(capability);
      groups.set(capability.group, list);
    }
    return [...groups.entries()];
  }, []);

  /**
   * The screen owns its scrolling, rather than the route wrapping it, so the
   * drag gesture has a ref to block. Without that the ScrollView claims every
   * vertical drag and rows never move.
   */
  const scrollRef = useRef(null);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
    >
    <Container width="detail" className="flex-1 gap-8 py-6">
      <View className="gap-1">
        <KitText variant="title">Editor</KitText>
        <Text className="text-sm text-text-muted md:text-base">
          Drag to arrange the toolbar. Switch on the extras you want.
        </Text>
      </View>

      <View className="gap-3">
        <Text className="text-xs font-semibold uppercase text-text-muted md:text-sm">
          Toolbar order
        </Text>
        <View style={{ height: visible.length * ROW_HEIGHT }}>
          {visible.map((id, index) => {
            const capability = CAPABILITY_BY_ID[id];
            if (capability === undefined) return null;
            const Icon = iconFor(capability.icon);

            return (
              <ReorderRow
                key={id}
                label={capability.label}
                index={index}
                count={visible.length}
                rowHeight={ROW_HEIGHT}
                onMove={move}
                scrollRef={scrollRef}
              >
                <Icon size={18} className="text-text" />
                <Text className="flex-1 text-base text-text">{capability.label}</Text>
                <Text className="text-xs text-text-muted">{index + 1}</Text>
              </ReorderRow>
            );
          })}
        </View>
      </View>

      {grouped.map(([group, capabilities]) => (
        <View key={group} className="gap-3">
          <Text className="text-xs font-semibold uppercase text-text-muted md:text-sm">
            {GROUP_LABEL[group]}
          </Text>
          <View className="gap-3 rounded-card border-2 border-border bg-surface-raised p-4 shadow-card">
            {capabilities.map((capability) => (
              <Switch
                key={capability.id}
                label={capability.label}
                value={preferences.enabled.includes(capability.id)}
                onChange={() => toggle(capability.id)}
              />
            ))}
          </View>
        </View>
      ))}

      <Pressable
        role="button"
        aria-label="Reset toolbar to defaults"
        onPress={reset}
        className="min-h-11 items-center justify-center rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none"
      >
        <Text className="text-base font-medium text-text">Reset to defaults</Text>
      </Pressable>
    </Container>
    </ScrollView>
  );
}
