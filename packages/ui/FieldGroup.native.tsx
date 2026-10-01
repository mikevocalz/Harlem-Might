'use client';
import { FieldGroup as ExpoFieldGroup, Host } from '@expo/ui';
import type { FieldGroupProps, FieldSectionProps } from './FieldGroup.types';

/**
 * Grouped settings list, rendered by the platform.
 *
 * `@expo/ui`'s universal FieldGroup draws the grouped-list chrome each platform
 * expects — inset rounded sections on iOS, Material list grouping on Android —
 * including the separators and the leading/middle/trailing corner treatment
 * that are tedious and easy to get subtly wrong by hand.
 *
 * It must sit inside a `Host`, and its children are native views: rows are
 * `@expo/ui` controls (Switch, Picker, ListItem), not kit components, because
 * a native list cannot lay out a React Native subtree.
 */
export function FieldGroup({ children, ...props }: FieldGroupProps) {
  return (
    <Host matchContents>
      <ExpoFieldGroup {...props}>{children}</ExpoFieldGroup>
    </Host>
  );
}

FieldGroup.Section = function FieldSection({ children, ...props }: FieldSectionProps) {
  return <ExpoFieldGroup.Section {...props}>{children}</ExpoFieldGroup.Section>;
};

FieldGroup.SectionHeader = ExpoFieldGroup.SectionHeader;
FieldGroup.SectionFooter = ExpoFieldGroup.SectionFooter;
