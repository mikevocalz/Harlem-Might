import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { View } from './tw';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { title: 'Get started', onPress: () => {} },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Accent: Story = { args: { variant: 'accent', title: 'Get started' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', title: 'Remove' } };
export const Disabled: Story = { args: { disabled: true } };
export const Loading: Story = { args: { loading: true } };
export const Sizes: Story = {
  render: () => (
    <View className="flex-row items-end gap-3 p-4">
      <Button title="Small" size="sm" onPress={() => {}} />
      <Button title="Medium" size="md" onPress={() => {}} />
      <Button title="Large" size="lg" onPress={() => {}} />
    </View>
  ),
};
