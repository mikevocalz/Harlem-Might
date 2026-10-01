import type { Meta, StoryObj } from '@storybook/react-vite';
import { Collapsible } from './Collapsible';
import { Text } from './Text';
import { View } from './tw';

const meta = {
  title: 'UI/Collapsible',
  component: Collapsible,
  args: {
    label: 'Rehearsal notes',
    isOpen: true,
    onOpenChange: () => {},
    children: (
      <Text variant="caption" tone="muted">
        Run the second verse a cappella before the full band comes back in.
      </Text>
    ),
  },
} satisfies Meta<typeof Collapsible>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="max-w-content-form gap-3 p-4">
      <Collapsible label="Rehearsal notes" isOpen onOpenChange={() => {}}>
        <Text variant="caption" tone="muted">
          Run the second verse a cappella before the full band comes back in.
        </Text>
      </Collapsible>
      <Collapsible label="Travel details" isOpen={false} onOpenChange={() => {}}>
        <Text variant="caption" tone="muted">
          Coach leaves the church at 6:15 AM.
        </Text>
      </Collapsible>
    </View>
  ),
};
