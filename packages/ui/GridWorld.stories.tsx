import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircuitButton } from './future/CircuitButton';
import { GridCard } from './future/GridCard';
import { GlyphCity } from './backgrounds/GlyphCity';
import { GridFloor } from './backgrounds/GridFloor';
import { GridScene } from './backgrounds/GridScene';
import { Text, View } from './tw';

const meta = {
  title: 'Spatial/Grid World',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gateway: Story = {
  render: () => (
    <View className="h-screen min-h-[720px] bg-black">
      <GridScene
        className="flex-1"
        gap={0.07}
        speed={0.42}
        lineColor="#00f3ff"
        glowColor="#00f3ff"
      >
        <View pointerEvents="none" className="absolute inset-x-0 bottom-0 h-[58%]">
          <GlyphCity
            className="flex-1"
            variant="megacity"
            colorPrimary="#00f3ff"
            colorSecondary="#ff8a00"
            colorTertiary="#fff6cf"
            opacity={0.72}
          />
        </View>

        <View className="mx-auto flex-1 w-full max-w-6xl justify-between gap-6 px-6 py-10">
          <View className="max-w-3xl gap-4">
            <Text className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
              Harlem Might / System 01
            </Text>
            <Text className="text-4xl font-bold uppercase tracking-[0.04em] text-white md:text-6xl">
              Enter the Grid
            </Text>
            <Text className="max-w-2xl text-base leading-7 text-white/60">
              Universal Tailwind 4 product UI over a Skia-rendered procedural world,
              with the immersive handoff owned by Viro/OpenXR.
            </Text>
            <View className="flex-row flex-wrap gap-3">
              <CircuitButton>Enter VR Grid</CircuitButton>
              <CircuitButton tone="orange" variant="solid">Start Cycle Race</CircuitButton>
            </View>
          </View>

          <View className="gap-3 md:flex-row">
            <GridCard className="flex-1" eyebrow="Render" title="Skia / CanvasKit">
              <Text className="text-sm leading-6 text-white/55">
                The same Grid Scene and Glyph City drawing code runs on Expo and web.
              </Text>
            </GridCard>
            <GridCard className="flex-1" eyebrow="Motion" title="Viro Game Loop" tone="orange">
              <Text className="text-sm leading-6 text-white/55">
                Fixed-step racing, analog input, collisions, scoring and OpenXR entry.
              </Text>
            </GridCard>
          </View>
        </View>
      </GridScene>
    </View>
  ),
};

export const BackgroundSystems: Story = {
  render: () => (
    <View className="min-h-screen gap-6 bg-black p-6">
      <View className="h-[420px] overflow-hidden border border-cyan-300/20">
        <GridScene>
          <View className="absolute inset-x-0 bottom-0 h-2/3">
            <GlyphCity className="flex-1" variant="downtown" opacity={0.78} />
          </View>
        </GridScene>
      </View>
      <View className="h-[360px] overflow-hidden border border-orange-300/20">
        <GridFloor lineColor="#ff8a00" glowColor="#ff8a00">
          <View className="flex-1 items-center justify-center">
            <Text className="text-xl font-bold uppercase tracking-[0.25em] text-orange-100">
              Floor primitive
            </Text>
          </View>
        </GridFloor>
      </View>
    </View>
  ),
};

export const FutureControls: Story = {
  render: () => (
    <View className="min-h-screen gap-6 bg-[#020407] p-8">
      <View className="flex-row flex-wrap gap-3">
        <CircuitButton>Enter Grid</CircuitButton>
        <CircuitButton tone="orange">Diagnostics</CircuitButton>
        <CircuitButton variant="solid">Confirm</CircuitButton>
        <CircuitButton tone="orange" variant="solid">Race</CircuitButton>
      </View>
      <View className="gap-4 md:flex-row">
        <GridCard className="flex-1" eyebrow="Node A" title="System online">
          <Text className="text-sm text-white/55">Cyan information surface.</Text>
        </GridCard>
        <GridCard className="flex-1" eyebrow="Node B" title="Race program" tone="orange">
          <Text className="text-sm text-white/55">Orange action surface.</Text>
        </GridCard>
      </View>
    </View>
  ),
};
