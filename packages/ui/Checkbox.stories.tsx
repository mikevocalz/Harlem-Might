import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';
import { View } from './tw';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  args: { checked: false, onChange: () => {}, label: 'Accept terms' },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="gap-3 p-4">
      <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
      <Checkbox checked onChange={() => {}} label="Checked" />
      <Checkbox checked={false} onChange={() => {}} label="Disabled" disabled />
      <Checkbox checked onChange={() => {}} label="Checked disabled" disabled />
    </View>
  ),
};
