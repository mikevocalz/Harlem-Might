import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog, DialogCard } from './Dialog';
import { Button } from './Button';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  args: {
    open: true,
    onClose: () => {},
    title: 'Discard changes?',
    description: 'Your edits have not been saved yet.',
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// RN Modal portals outside the story canvas — the inline surface stories below
// are the reliable visual reference; this one exercises the modal wiring.
export const Open: Story = {};

export const Surface: Story = {
  render: () => (
    <DialogCard
      title="Discard changes?"
      description="Your edits have not been saved yet."
      actions={
        <>
          <Button title="Stay" variant="ghost" onPress={() => {}} />
          <Button title="Leave" variant="danger" onPress={() => {}} />
        </>
      }
    />
  ),
};

export const SurfaceWithoutActions: Story = {
  render: () => (
    <DialogCard
      title="You&apos;re all set"
      description="Your voice part has been updated to Alto."
    />
  ),
};
