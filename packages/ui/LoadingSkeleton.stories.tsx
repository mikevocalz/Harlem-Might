import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingSkeleton } from './LoadingSkeleton';
import { View } from './tw';

const meta = {
  title: 'UI/LoadingSkeleton',
  component: LoadingSkeleton,
} satisfies Meta<typeof LoadingSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <View className="max-w-content-feed gap-4 p-4">
      <LoadingSkeleton variant="line" count={3} />
      <LoadingSkeleton variant="card" />
      <LoadingSkeleton variant="avatar" />
    </View>
  ),
};
