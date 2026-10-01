import { tv, type VariantProps } from 'tailwind-variants';
import { View, Pressable } from './tw';
import { SlideUp } from './motion';

// §9 tab-bar accessory — a slot that docks above the tab bar (mini player,
// tonight's rehearsal, download progress). Presentational: content comes in as
// children. Legend Motion entrance/exit lands with the nav shell — for now
// only the NW transition covers opacity changes.
const accessory = tv({
  base:
    'w-full flex-row items-center gap-3 rounded-t-md border-t-2 border-border px-4 py-2 ' +
    'transition-opacity duration-base motion-reduce:transition-none',
  variants: {
    tone: {
      default: 'bg-surface-sunken',
      accent: 'bg-accent',
    },
  },
  defaultVariants: { tone: 'default' },
});

export interface TabBarAccessoryProps extends VariantProps<typeof accessory> {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  'aria-label'?: string;
}

export function TabBarAccessory({ children, onPress, tone, className, ...a11y }: TabBarAccessoryProps) {
  const cls = accessory({ tone, className });
  if (onPress) {
    return (
      <SlideUp>
        <Pressable role="button" onPress={onPress} className={cls} {...a11y}>
          {children}
        </Pressable>
      </SlideUp>
    );
  }
  return (
    <SlideUp className={cls} {...a11y}>
      {children}
    </SlideUp>
  );
}
