import type { Meta, StoryObj } from '@storybook/react-vite';
import { BottomSheet, SheetSurface } from './BottomSheet';
import { Button } from './Button';
import { Text } from './tw';

const meta = {
  title: 'UI/BottomSheet',
  component: BottomSheet,
  args: {
    open: true,
    onClose: () => {},
    title: 'Session details',
    children: null,
  },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// RN Modal portals outside the story canvas — the inline surface stories below
// are the reliable visual reference; this one exercises the modal wiring.
export const Open: Story = {
  args: {
    children: <Text className="text-base text-text-muted">Everything you need for the session, in one place.</Text>,
  },
};

export const Surface: Story = {
  render: () => (
    <SheetSurface title="Session details">
      <Text className="text-base text-text-muted">
        Everything you need for the session, in one place.
      </Text>
      <Button title="I&apos;ll be there" fullWidth className="mt-4" onPress={() => {}} />
    </SheetSurface>
  ),
};

export const SurfaceWithoutTitle: Story = {
  render: () => (
    <SheetSurface>
      <Text className="text-base text-text">Share this concert with a friend.</Text>
    </SheetSurface>
  ),
};
