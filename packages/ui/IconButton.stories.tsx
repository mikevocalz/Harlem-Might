import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { View } from './tw';

const meta = {
  title: 'UI/IconButton',
  component: IconButton,
  args: { icon: <Text>＋</Text>, 'aria-label': 'Add' },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <View className="flex-row gap-3 p-4">
      <IconButton icon={<Text className="text-on-primary">＋</Text>} aria-label="Primary" />
      <IconButton variant="ghost" icon={<Text>＋</Text>} aria-label="Ghost" />
      <IconButton variant="outline" icon={<Text>＋</Text>} aria-label="Outline" />
      <IconButton disabled icon={<Text className="text-on-primary">＋</Text>} aria-label="Disabled" />
    </View>
  ),
};
