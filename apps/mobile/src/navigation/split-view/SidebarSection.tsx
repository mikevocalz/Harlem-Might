'use client';
import { MotionView } from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { ChevronRight } from '@acme/ui/icons';
import { haptics } from '@acme/ui/haptics';
import { TRANSITIONS } from './transitions.ts';

export interface SidebarSectionProps {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rail mode: icons only, no labels and no disclosure. */
  rail?: boolean;
  children: React.ReactNode;
}

/**
 * A collapsible group in the sidebar.
 *
 * The chevron rotates rather than swapping glyphs, and `transformOrigin` is
 * passed UNCONDITIONALLY — Legend Motion adds a hook for it internally, so
 * setting it only sometimes changes hook order between renders and crashes.
 *
 * Legend Motion rather than Reanimated: this is a declarative state change, not
 * a gesture. Rotation is native-driven, so it is safe on a node of its own.
 *
 * In rail mode the section header disappears entirely instead of collapsing to
 * a truncated label — at 16rem there is no room for text, and a clipped word is
 * worse than none.
 */
export function SidebarSection({
  label,
  open,
  onOpenChange,
  rail,
  children,
}: SidebarSectionProps) {
  if (rail) {
    return <View className="gap-2">{children}</View>;
  }

  return (
    <View className="gap-1">
      <Pressable
        role="button"
        aria-label={label}
        aria-expanded={open}
        onPress={() => {
          haptics.selection();
          onOpenChange(!open);
        }}
        className="min-h-11 flex-row items-center gap-1.5 rounded-md px-1 py-1.5 transition-colors duration-fast hover:bg-surface-sunken motion-reduce:transition-none"
      >
        <MotionView
          animate={{ rotate: open ? '90deg' : '0deg' }}
          transition={TRANSITIONS.disclosure}
          transformOrigin={{ x: '50%', y: '50%' }}
        >
          <ChevronRight size={14} className="text-text-muted" />
        </MotionView>
        <Text className="flex-1 text-xs font-semibold uppercase text-text-muted md:text-sm">
          {label}
        </Text>
      </Pressable>

      {/* Mounted only when open: a sidebar group is a list of navigable rows,
          and keeping them mounted-but-hidden would leave them in the
          accessibility tree and reachable by keyboard while invisible. */}
      {open ? <View className="gap-2 pl-2">{children}</View> : null}
    </View>
  );
}
