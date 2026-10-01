import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircuitButton, GlyphCity, GridCard, GridFloor, GridScene } from './index';
import { Text, View } from './tw';

const meta = { title: 'Future Grid' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const UniversalSkiaBackdrops: Story = {
  render: () => (
    <View className="gap-6 bg-black p-6">
      <View className="h-[360px] overflow-hidden border border-cyan-300/20">
        <GridFloor>
          <View className="flex-1 items-center justify-center">
            <Text className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200">Skia Grid Floor</Text>
          </View>
        </GridFloor>
      </View>
      <View className="h-[360px] overflow-hidden border border-cyan-300/20">
        <GridScene>
          <View className="flex-1 items-center justify-center">
            <Text className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-200">Skia Grid Scene</Text>
          </View>
        </GridScene>
      </View>
      <View className="h-[360px] overflow-hidden border border-cyan-300/20 bg-black">
        <GridScene showCeiling={false}>
          <GlyphCity className="absolute inset-x-0 bottom-0 h-[78%]" variant="megacity" />
        </GridScene>
      </View>
    </View>
  ),
};

export const ControlsAndCards: Story = {
  render: () => (
    <View className="min-h-[520px] gap-5 bg-black p-8">
      <View className="flex-row flex-wrap gap-3">
        <CircuitButton>Enter Grid</CircuitButton>
        <CircuitButton tone="orange" variant="solid">Start Race</CircuitButton>
      </View>
      <View className="gap-4 md:flex-row">
        <GridCard className="flex-1" eyebrow="Node 01" title="Spatial gateway">
          <Text className="text-sm leading-6 text-white/60">One futuristic surface for Next, Expo, Storybook, and headset entry UI.</Text>
        </GridCard>
        <GridCard className="flex-1" eyebrow="Race telemetry" title="Light-cycle arena" tone="orange">
          <Text className="text-sm leading-6 text-white/60">Cyan and orange grid language, restrained glow, readable controls, and high-contrast data.</Text>
        </GridCard>
      </View>
    </View>
  ),
};
