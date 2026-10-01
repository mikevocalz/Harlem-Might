import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBarAccessory } from './TabBarAccessory';
import { View, Text } from './tw';

const meta = {
  title: 'UI/TabBarAccessory',
  component: TabBarAccessory,
  args: {
    children: (
      <Text className="text-sm text-text">
        Your download is ready to view
      </Text>
    ),
  },
} satisfies Meta<typeof TabBarAccessory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pressable: Story = {
  args: {
    onPress: () => {},
    'aria-label': 'Open the mini player',
    children: (
      <View className="flex-row items-center gap-3">
        <Text className="text-sm font-medium text-text">Now playing</Text>
        <Text className="text-sm text-text-muted">Ride On, King Jesus</Text>
      </View>
    ),
  },
};

export const AccentTone: Story = {
  args: {
    tone: 'accent',
    children: (
      <Text className="text-sm font-medium text-on-accent">
        Download in progress — 3 of 12 tracks
      </Text>
    ),
  },
};
