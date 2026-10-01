import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';
import { Text } from './Text';
import { Button } from './Button';

const meta = {
  title: 'UI/EmptyState',
  component: EmptyState,
  args: {
    icon: <Text className="text-4xl">🗂</Text>,
    title: 'Nothing here yet',
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
export const WithAction: Story = {
  args: {
    description: 'Content appears here once it has been added.',
    action: <Button title="Refresh" variant="outline" size="sm" onPress={() => {}} />,
  },
};
