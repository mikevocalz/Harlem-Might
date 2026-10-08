import type { ComponentProps, ComponentType } from 'react';
import { Pressable } from '@acme/ui/tw';

/**
 * The kit's `Pressable` with `ref` in its props type. The type comes from the
 * web fork's anchor, which omits `ref`; on native, React 19 passes `ref` as a
 * plain prop and the native fork spreads it onto React Native's `Pressable`,
 * so the host view reaches `focusTargetRef` (focus-registry.ts).
 */
export const FocusPressable = Pressable as ComponentType<
  ComponentProps<typeof Pressable> & { ref?: (node: never) => void }
>;
