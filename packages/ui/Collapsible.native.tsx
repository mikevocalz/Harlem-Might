'use client';
import { Collapsible as ExpoCollapsible, Host } from '@expo/ui';
import type { CollapsibleProps } from './Collapsible.types';

/**
 * Disclosure section, rendered by `@expo/ui`.
 *
 * Controlled rather than self-managing: the open state belongs to the caller,
 * so a sidebar's expanded rows survive the pane collapsing to zero width, and
 * several sections can be coordinated (accordion behaviour) without the
 * component owning state it cannot see.
 *
 * Its children are native views, so this hosts `@expo/ui` content — not kit
 * components, which a native container cannot lay out.
 */
export function Collapsible({ label, isOpen, onOpenChange, children }: CollapsibleProps) {
  return (
    <Host matchContents>
      <ExpoCollapsible label={label} isOpen={isOpen} onOpenChange={onOpenChange}>
        {children}
      </ExpoCollapsible>
    </Host>
  );
}
