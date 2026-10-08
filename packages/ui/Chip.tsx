'use client';
import { tv } from './tv';
import { Pressable, Text } from './tw';

// Filter chip (design handoff §2). A chip FILTERS; it doesn't switch views,
// so it is a button with a selected state, never role="tab". The resting edge
// is border-strong (3.5:1 on surface-raised), because a 1.29:1 border is the
// only thing that tells a gaze user it is pressable. Height is the 48dp target
// token, in px so the rem polyfill can't shrink it.
const chip = tv({
  slots: {
    root:
      'min-h-target flex-row items-center justify-center gap-2 rounded-full border px-4 ' +
      'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus focus-visible:ring-offset-2',
    label: 'text-xr-label font-medium',
  },
  variants: {
    selected: {
      true: { root: 'border-primary bg-primary', label: 'text-on-primary' },
      false: { root: 'border-border-strong bg-surface', label: 'text-text' },
    },
  },
  defaultVariants: { selected: false },
});

export interface ChipProps {
  /** Visible text. Also the accessible name unless `aria-label` is given. */
  label: string;
  /** Whether this filter is applied. Announced as "selected". */
  selected: boolean;
  onPress: () => void;
  /** Number of results this filter would show. Rendered after the label. */
  count?: number;
  'aria-label'?: string;
  className?: string;
}

/**
 * A filter chip with a 48dp hit area and a real selected state.
 *
 * @example
 * <Chip label="Food" selected={category === 'Food'} onPress={() => setCategory('Food')} />
 */
export function Chip({ label, selected, onPress, count, className, ...a11y }: ChipProps) {
  const s = chip({ selected });
  return (
    <Pressable
      role="button"
      onPress={onPress}
      accessibilityState={{ selected }}
      aria-selected={selected}
      className={s.root({ className })}
      {...a11y}
    >
      <Text className={s.label()}>{label}</Text>
      {count === undefined ? null : <Text className={s.label()}>{count}</Text>}
    </Pressable>
  );
}
