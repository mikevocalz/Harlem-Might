'use client';
import { View } from './tw';
import { Text } from './Text';
import type { FieldGroupProps, FieldSectionProps } from './FieldGroup.types';

/**
 * Web has no platform grouped list, so the kit draws one: a bordered slab per
 * section with the app's own eyebrow heading, matching Card.
 */
export function FieldGroup({ children }: FieldGroupProps) {
  return <View className="gap-6">{children}</View>;
}

FieldGroup.Section = function FieldSection({ children, title, titleUppercase = true }: FieldSectionProps) {
  return (
    <View className="gap-2">
      {title ? (
        <Text
          className={`text-xs font-semibold text-text-muted md:text-sm ${
            titleUppercase ? 'uppercase tracking-wide' : ''
          }`}
        >
          {title}
        </Text>
      ) : null}
      <View className="gap-3 rounded-card border-2 border-border bg-surface-raised p-4 shadow-card">
        {children}
      </View>
    </View>
  );
};

FieldGroup.SectionHeader = function FieldSectionHeader({ children }: { children?: React.ReactNode }) {
  return <Text className="text-xs font-semibold uppercase text-text-muted md:text-sm">{children}</Text>;
};

FieldGroup.SectionFooter = function FieldSectionFooter({ children }: { children?: React.ReactNode }) {
  return <Text className="text-xs text-text-muted md:text-sm">{children}</Text>;
};
