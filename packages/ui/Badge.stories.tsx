import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { View } from './tw';

const meta = { title: 'UI/Badge', component: Badge, args: { label: 'Badge' } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <View className="flex-row flex-wrap gap-2 p-4">
      <Badge label="Neutral" />
      <Badge label="Primary" tone="primary" />
      <Badge label="Accent" tone="accent" />
      <Badge label="Success" tone="success" />
      <Badge label="Danger" tone="danger" />
    </View>
  ),
};
