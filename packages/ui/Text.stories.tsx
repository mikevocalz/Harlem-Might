import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from './Text';
import { View } from './tw';

const meta = { title: 'UI/Text', component: Text } satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <View className="gap-2 p-4">
      <Text variant="display">Display</Text>
      <Text variant="title">Title</Text>
      <Text variant="heading">Heading</Text>
      <Text variant="body">Body — comfortable reading size for paragraphs.</Text>
      <Text variant="caption" tone="muted">Caption · muted</Text>
      <Text variant="label" tone="accent">Label · accent</Text>
    </View>
  ),
};
