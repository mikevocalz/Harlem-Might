import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { ErrorMessage } from './ErrorMessage';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';
import { View } from './tw';

const meta = {
  title: 'UI/ErrorMessage',
  component: ErrorMessage,
  args: { message: 'Something went wrong — try again.' },
} satisfies Meta<typeof ErrorMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {};

// Story state — zustand always (repo rule).
const useErrorDemo = create<{ show: boolean; toggle: () => void }>((set) => ({
  show: true,
  toggle: () => set((s) => ({ show: !s.show })),
}));

export const CollapsesWhenEmpty: Story = {
  render: function Render() {
    const { show, toggle } = useErrorDemo();
    return (
      <View className="max-w-content-form gap-3 p-4">
        <Card className="gap-2">
          <Text variant="heading">Form footer</Text>
          <ErrorMessage message={show ? 'Something went wrong — try again.' : undefined} />
          <Text variant="caption" tone="muted">
            The alert renders nothing when message is empty — the row above collapses.
          </Text>
        </Card>
        <Button
          title={show ? 'Clear error' : 'Raise error'}
          variant="outline"
          size="sm"
          onPress={toggle}
        />
      </View>
    );
  },
};
