import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from './Toast';
import { View } from './tw';

const meta = {
  title: 'UI/Toast',
  component: Toast,
  args: { title: 'Downloaded', description: 'Total Praise · Alto part is available offline.' },
} satisfies Meta<typeof Toast>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <View className="max-w-content-form gap-3 p-4">
      <Toast variant="info" title="Update available" description="A new version is ready to install." />
      <Toast variant="success" title="RSVP saved" />
      <Toast variant="error" title="Upload failed" description="Check your connection and retry." />
    </View>
  ),
};
