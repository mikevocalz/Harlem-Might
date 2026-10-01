import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider } from './Slider';
import { View } from './tw';

const meta = {
  title: 'UI/Slider',
  component: Slider,
  args: { value: 0.4, onValueChange: () => {}, label: 'Playback volume' },
} satisfies Meta<typeof Slider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const States: Story = {
  render: () => (
    <View className="max-w-content-form gap-5 p-4">
      <Slider label="Playback volume" value={0.4} onValueChange={() => {}} />
      <Slider label="Rehearsal length" value={45} min={15} max={120} step={15} onValueChange={() => {}} />
      <Slider label="Locked" value={0.8} onValueChange={() => {}} disabled />
    </View>
  ),
};
