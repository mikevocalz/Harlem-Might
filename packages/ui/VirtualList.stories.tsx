import type { Meta, StoryObj } from '@storybook/react-vite';
import { VirtualList } from './VirtualList';
import { Avatar } from './Avatar';
import { Text } from './Text';
import { View } from './tw';

const PEOPLE = Array.from({ length: 5000 }, (_, i) => ({
  id: String(i),
  name: `Person ${i + 1}`,
  role: ['Viewer', 'Editor', 'Admin'][i % 3] as string,
}));

const meta = {
  title: 'UI/VirtualList',
  component: VirtualList,
  args: { data: PEOPLE, renderItem: () => null },
} satisfies Meta<typeof VirtualList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FiveThousandRows: Story = {
  render: () => (
    <View className="max-w-content-form p-4">
      <VirtualList
        data={PEOPLE}
        keyExtractor={(p) => p.id}
        estimatedItemSize={64}
        className="h-96 rounded-card border border-border/60 bg-surface-raised shadow-card"
        renderItem={({ item }) => (
          <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
            <Avatar name={item.name} size="sm" />
            <View className="flex-1">
              <Text className="font-medium">{item.name}</Text>
              <Text variant="caption" tone="muted">{item.role}</Text>
            </View>
          </View>
        )}
      />
    </View>
  ),
};
