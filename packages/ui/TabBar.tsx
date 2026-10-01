import { tv } from 'tailwind-variants';
import { Nav } from './primitives';
import { View, Text, Pressable } from './tw';

// Presentational bottom tab bar — active state and handlers come in via props
// (the nav shell owns routing).
const tabBar = tv({
  slots: {
    root: 'flex-row items-center border-t-2 border-border bg-surface-raised',
    tab: 'flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 transition-colors duration-fast hover:bg-surface-sunken motion-reduce:transition-none',
    label: 'text-xs font-medium',
    icon: '',
    emphasis: '-mt-6 h-14 w-14 items-center justify-center rounded-md border-2 border-border-strong bg-accent shadow-raised',
  },
  variants: {
    active: {
      true: { label: 'font-bold text-text', icon: 'text-text' },
      false: { label: 'text-text-muted', icon: 'text-text-muted' },
    },
  },
  defaultVariants: { active: false },
});

export interface TabBarTab {
  key: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
}

export interface TabBarProps {
  tabs: TabBarTab[];
  /** Key of a center tab rendered as a raised circular accent button. */
  emphasizedKey?: string;
  className?: string;
}

export function TabBar({ tabs, emphasizedKey, className }: TabBarProps) {
  const s = tabBar();
  return (
    <Nav role="tablist" aria-label="Main navigation" className={s.root({ className })}>
      {tabs.map((tab) => {
        const active = !!tab.active;
        const emphasized = tab.key === emphasizedKey;
        return (
          <Pressable
            key={tab.key}
            role="tab"
            aria-label={tab.label}
            aria-selected={active}
            onPress={tab.onPress}
            className={s.tab()}
          >
            {emphasized ? (
              <View className={s.emphasis()}>{tab.icon}</View>
            ) : (
              <View className={s.icon({ active })}>{tab.icon}</View>
            )}
            <Text className={s.label({ active })}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </Nav>
  );
}
