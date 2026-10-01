import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './Switch';
import { View } from './tw';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  args: { value: false, onChange: () => {}, label: 'Rehearsal reminders' },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="gap-3 p-4">
      <Switch value={false} onChange={() => {}} label="Off" />
      <Switch value onChange={() => {}} label="On" />
      <Switch value={false} onChange={() => {}} label="Disabled" disabled />
    </View>
  ),
};
