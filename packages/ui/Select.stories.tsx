import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';
import { View } from './tw';

const meta = {
  title: 'UI/Select',
  component: Select,
  args: { label: 'Role' },
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <Select label="Role" value="editor">
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
        <option value="owner">Owner</option>
      </Select>
      <Select label="Team" error="Choose a team." value="">
        <option value="">—</option>
        <option value="design">Design</option>
      </Select>
      <Select label="Locked" disabled value="editor">
        <option value="editor">Editor</option>
      </Select>
    </View>
  ),
};
