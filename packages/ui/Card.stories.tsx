import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { Text } from './Text';

const meta = { title: 'UI/Card', component: Card } satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Elevated: Story = {
  render: () => (
    <Card><Text>Cards group related content on a raised surface.</Text></Card>
  ),
};
export const Flat: Story = {
  render: () => (
    <Card elevation="flat"><Text>Flat card with border.</Text></Card>
  ),
};
export const Raised: Story = {
  render: () => (
    <Card elevation="raised"><Text>Raised card for overlays.</Text></Card>
  ),
};
