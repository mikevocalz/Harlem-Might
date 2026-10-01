import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';
import { View } from './tw';

const PHOTO = 'https://i.pravatar.cc/256?img=5';

const meta = { title: 'UI/Avatar', component: Avatar, args: { name: 'Maya Rodriguez' } } satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <View className="flex-row items-end gap-3 p-4">
      <Avatar name="Maya Rodriguez" size="sm" />
      <Avatar name="Maya Rodriguez" size="md" />
      <Avatar name="Maya Rodriguez" size="lg" />
      <Avatar name="Maya Rodriguez" size="xl" />
    </View>
  ),
};

export const WithImage: Story = {
  render: () => (
    <View className="flex-row items-end gap-3 p-4">
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="sm" />
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="md" />
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="lg" />
      <Avatar name="Maya Rodriguez" imageUri={PHOTO} size="xl" />
      <Avatar name="Fallback Initials" size="xl" />
    </View>
  ),
};
