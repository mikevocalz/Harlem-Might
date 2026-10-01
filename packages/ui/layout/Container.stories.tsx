import type { Meta, StoryObj } from '@storybook/react-vite';
import { Container } from './Container';
import { View, Text } from '../tw';

const meta = {
  title: 'Layout/Container',
  component: Container,
} satisfies Meta<typeof Container>;
export default meta;
type Story = StoryObj<typeof meta>;

const Block = () => (
  <View className="rounded-card bg-surface-raised p-6 shadow-card">
    <Text className="text-text">
      Cards fill their container — the container owns the cap (§8.2).
    </Text>
  </View>
);

export const AllWidths: Story = {
  render: () => (
    <View className="gap-4 bg-surface py-6">
      {(['form', 'feed', 'prose', 'detail', 'wide'] as const).map((w) => (
        <Container key={w} width={w}>
          <Text className="pb-1 text-xs text-text-muted">width={`"${w}"`}</Text>
          <Block />
        </Container>
      ))}
    </View>
  ),
};
