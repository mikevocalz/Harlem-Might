import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  palette, semantic, typeScale, contentWidths, radius, motion,
} from '@acme/theme';
import { View, Text, H2 } from './tw';

// PROMPT-2 foundation stories: Colors, Typography, Spacing, Content Widths.
// Light + dark rendered side by side (light-dark() resolves per color-scheme).

const meta = { title: 'Foundation' } satisfies Meta;
export default meta;
type Story = StoryObj;

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <View className="items-center gap-1">
      <View
        className="h-14 w-14 rounded-md border border-border"
        style={{ backgroundColor: value }}
      />
      <Text className="text-xs text-text-muted">{name}</Text>
    </View>
  );
}

export const Colors: Story = {
  render: () => (
    <View className="gap-6 p-6 bg-surface">
      {Object.entries(palette).map(([family, scale]) =>
        typeof scale === 'string' ? null : (
          <View key={family} className="gap-2">
            <H2 className="text-lg font-semibold text-text">{family}</H2>
            <View className="flex-row flex-wrap gap-3">
              {Object.entries(scale).map(([step, hex]) => (
                <Swatch key={step} name={step} value={hex} />
              ))}
            </View>
          </View>
        ),
      )}
      <View className="gap-2">
        <H2 className="text-lg font-semibold text-text">semantic (light / dark)</H2>
        <View className="flex-row flex-wrap gap-3">
          {Object.entries(semantic).map(([name, { light, dark }]) => (
            <View key={name} className="items-center gap-1">
              <View className="flex-row">
                <View className="h-14 w-7 rounded-l-md" style={{ backgroundColor: light }} />
                <View className="h-14 w-7 rounded-r-md" style={{ backgroundColor: dark }} />
              </View>
              <Text className="text-xs text-text-muted">{name}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  ),
};

export const Typography: Story = {
  render: () => (
    <View className="gap-4 p-6 bg-surface">
      {Object.keys(typeScale).map((name) => (
        <View key={name} className="gap-1">
          <Text className="text-xs text-text-muted">{name} · font-display</Text>
          <Text className={`font-display text-${name} text-text`}>The quick brown fox</Text>
        </View>
      ))}
      <View className="gap-1">
        <Text className="text-xs text-text-muted">body · font-sans</Text>
        <Text className="font-sans text-base text-text">
          Body copy sample — readable, unhurried, and comfortable at length,
          educate and entertain.
        </Text>
      </View>
    </View>
  ),
};

export const Spacing: Story = {
  render: () => (
    <View className="gap-3 p-6 bg-surface">
      {Object.entries(radius).map(([name, value]) => (
        <View key={name} className="flex-row items-center gap-3">
          <View className="h-10 w-20 bg-primary" style={{ borderRadius: value as never }} />
          <Text className="text-sm text-text-muted">radius-{name} · {value}</Text>
        </View>
      ))}
      {Object.entries(motion.duration).map(([name, value]) => (
        <Text key={name} className="text-sm text-text-muted">duration-{name} · {value}</Text>
      ))}
    </View>
  ),
};

export const ContentWidths: Story = {
  render: () => (
    <View className="gap-3 p-6 bg-surface">
      {Object.entries(contentWidths).map(([name, width]) => (
        <View key={name} className="gap-1">
          <Text className="text-xs text-text-muted">{name} · {width}</Text>
          <View className="h-8 rounded-sm bg-accent" style={{ maxWidth: width as never, width: '100%' }} />
        </View>
      ))}
    </View>
  ),
};
