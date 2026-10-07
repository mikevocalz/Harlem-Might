import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircuitButton, GlyphCity, GridCard, GridFloor, GridScene } from './index';
import { Text, View } from './tw';

const meta = { title: 'Harlem Might/Future Foundations' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const UniversalSpatialBackdrops: Story = {
  render: () => (
    <View className="gap-6 bg-surface p-6">
      <View className="h-[360px] overflow-hidden rounded-card border border-border bg-surface-raised">
        <GridFloor
          lineColor="#A9B4AE"
          glowColor="#1F4FE0"
          backgroundColor="#EEF0EC"
          opacity={0.38}
        >
          <View className="flex-1 items-center justify-center">
            <Text className="rounded-full border border-border bg-surface-raised/90 px-3 py-1.5 text-xs font-semibold text-text-muted">
              Street-grid field
            </Text>
          </View>
        </GridFloor>
      </View>

      <View className="h-[360px] overflow-hidden rounded-card border border-border bg-surface-raised">
        <GridScene
          showCeiling={false}
          lineColor="#A9B4AE"
          glowColor="#1F4FE0"
          backgroundColor="#EEF0EC"
          opacity={0.42}
        >
          <View className="flex-1 items-center justify-center">
            <Text className="rounded-full border border-border bg-surface-raised/90 px-3 py-1.5 text-xs font-semibold text-primary">
              Spatial route scene
            </Text>
          </View>
        </GridScene>
      </View>

      <View className="h-[360px] overflow-hidden rounded-card border border-border bg-surface-raised">
        <GridScene
          showCeiling={false}
          lineColor="#A9B4AE"
          glowColor="#1F4FE0"
          backgroundColor="#EEF0EC"
          opacity={0.36}
        >
          <GlyphCity className="absolute inset-x-0 bottom-0 h-[78%] opacity-35" variant="megacity" />
        </GridScene>
      </View>
    </View>
  ),
};

export const ControlsAndCards: Story = {
  render: () => (
    <View className="min-h-[520px] gap-5 bg-surface p-6 md:p-8">
      <View className="flex-row flex-wrap gap-3">
        <CircuitButton>Explore Harlem</CircuitButton>
        <CircuitButton tone="accent" variant="solid">Enter AR</CircuitButton>
      </View>

      <View className="gap-4 md:flex-row">
        <GridCard className="flex-1" label="West 125th Street" title="A place is more than a pin">
          <Text className="text-sm leading-6 text-text-muted">
            Quiet technical rails and precise geometry carry the future-facing feel without turning the interface into a dark gamer dashboard.
          </Text>
        </GridCard>

        <GridCard
          className="flex-1"
          label="Navigation state"
          title="From the map to the sidewalk"
          tone="accent"
        >
          <Text className="text-sm leading-6 text-text-muted">
            Accent color appears when an action or live state needs attention; it is not permanent neon wallpaper.
          </Text>
        </GridCard>
      </View>
    </View>
  ),
};
