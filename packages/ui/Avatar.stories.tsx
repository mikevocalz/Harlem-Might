import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';
import { View } from './tw';

const DEMO_LOGO =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="28" fill="#1F4FE0"/><path d="M38 42h22v28h40V42h22v76h-22V90H60v28H38z" fill="white"/></svg>',
  );

const meta = {
  title: 'UI/Identity/Avatar',
  component: Avatar,
  args: { name: 'Maya Rodriguez' },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PersonFallbacks: Story = {
  render: () => (
    <View className="flex-row items-end gap-3 p-4">
      <Avatar name="Maya Rodriguez" size="sm" />
      <Avatar name="Daniel Okafor" size="md" />
      <Avatar name="Priya Raman" size="lg" />
      <Avatar name="Marcus Bell" size="xl" />
    </View>
  ),
};

export const BusinessLogoAndFallback: Story = {
  render: () => (
    <View className="flex-row items-end gap-4 p-4">
      <Avatar name="Harlem Mights" imageUri={DEMO_LOGO} entity="business" size="lg" />
      <Avatar name="Red Rooster Harlem" entity="business" size="lg" />
      <Avatar name="Sylvia's Restaurant" entity="business" size="lg" />
    </View>
  ),
};
