import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heading } from './Heading';
import { View } from './tw';

const meta = {
  title: 'UI/Heading',
  component: Heading,
  args: { children: 'The quick brown fox' },
} satisfies Meta<typeof Heading>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <View className="gap-3 p-4">
      <Heading level={1} size="display-xl">Display XL</Heading>
      <Heading level={2} size="display-lg">Display LG</Heading>
      <Heading level={2} size="display-md">Display MD</Heading>
      <Heading level={3} size="display-sm">Display SM</Heading>
      <Heading level={3} size="title" tone="accent">Title accent</Heading>
    </View>
  ),
};
