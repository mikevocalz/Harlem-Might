'use client';
import { useWindowDimensions } from 'react-native';
import { MotionView } from '@acme/ui';
import { Pressable } from '@acme/ui/tw';
import {
  Columns2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from '@acme/ui/icons';
import { haptics } from '@acme/ui/haptics';
import { windowSizeClassForWidth } from './constants.ts';
import { resolvePaneVisibility, type TogglablePane } from './pane-overrides.ts';
import { usePaneOverrideStore } from './pane-overrides.store.ts';
import { TRANSITIONS } from './transitions.ts';

/** Each pane's pair of icons, closed state first. */
const ICONS = {
  primary: { open: PanelLeftOpen, close: PanelLeftClose },
  supplementary: { open: Columns2, close: Columns2 },
  inspector: { open: PanelRightOpen, close: PanelRightClose },
} as const;

const LABELS = {
  primary: { show: 'Show sidebar', hide: 'Hide sidebar' },
  supplementary: { show: 'Show list', hide: 'Hide list' },
  inspector: { show: 'Show inspector', hide: 'Hide inspector' },
} as const;

export interface PaneToggleProps {
  pane: TogglablePane;
  /** Layout shape, matching the value handed to `resolvePaneVisibility`. */
  columnCount: 1 | 2;
  className?: string;
}

/**
 * Explicit show/hide control for one pane.
 *
 * The button writes an override SCOPED TO THE CURRENT SIZE CLASS, so a user who
 * hides the list on a tablet still gets it on a phone, where it is the only
 * thing on screen. Precedence between this and the automatic policy lives in
 * `resolvePaneVisibility`, not here — this component only reports what is on
 * screen now and asks for the opposite.
 *
 * It renders nothing where the size class cannot show the pane at all: a
 * control that is visibly present but can never change anything is worse than
 * no control, and at compact the navigator owns which single pane is up.
 */
export function PaneToggle({ pane, columnCount, className }: PaneToggleProps) {
  const { width } = useWindowDimensions();
  const sizeClass = windowSizeClassForWidth(width);
  const overrides = usePaneOverrideStore((state) => state.overrides);
  const toggle = usePaneOverrideStore((state) => state.toggle);

  const visible = resolvePaneVisibility(sizeClass, columnCount, overrides)[pane];

  // If forcing it on changes nothing, this class cannot show the pane.
  const canToggle =
    visible ||
    resolvePaneVisibility(sizeClass, columnCount, {
      ...overrides,
      [sizeClass]: { ...overrides[sizeClass], [pane]: true },
    })[pane];

  if (!canToggle) return null;

  const Icon = visible ? ICONS[pane].close : ICONS[pane].open;

  return (
    <Pressable
      role="button"
      aria-label={visible ? LABELS[pane].hide : LABELS[pane].show}
      aria-expanded={visible}
      onPress={() => {
        haptics.selection();
        toggle(sizeClass, pane, visible);
      }}
      // A white slab on the primary field, so the control stays legible
      // against it; the icon takes the accent rather than ink, which is what
      // separates an action from the header's own text.
      className={`h-11 w-11 items-center justify-center rounded-md border-2 border-border bg-surface-raised transition-colors duration-fast hover:bg-surface-sunken active:bg-surface-sunken motion-reduce:transition-none ${className ?? ''}`}
    >
      {/* Rotation only — a native-driven property, so it never shares a node
          with the pane width animation on the JS thread. The supplementary
          pane reuses one icon for both states, so the half-turn is what
          communicates the change. */}
      <MotionView
        animate={{ rotate: visible ? '0deg' : '180deg' }}
        transition={TRANSITIONS.disclosure}
        transformOrigin={{ x: '50%', y: '50%' }}
      >
        <Icon size={20} className="text-accent" />
      </MotionView>
    </Pressable>
  );
}
