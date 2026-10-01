import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toolbar } from './Toolbar';
import { Button } from './Button';
import { Text } from './tw';

const meta = {
  title: 'UI/Toolbar',
  component: Toolbar,
  args: { title: 'Repertoire' },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLeadingAndActions: Story = {
  args: {
    leading: <Text className="text-lg text-text">←</Text>,
    actions: (
      <>
        <Button title="Filter" variant="ghost" size="sm" onPress={() => {}} />
        <Button title="Add" variant="primary" size="sm" onPress={() => {}} />
      </>
    ),
  },
};

export const ActionsOnly: Story = {
  args: {
    title: undefined,
    actions: <Button title="Done" variant="ghost" size="sm" onPress={() => {}} />,
  },
};
