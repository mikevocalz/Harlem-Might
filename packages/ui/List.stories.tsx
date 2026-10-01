import type { Meta, StoryObj } from '@storybook/react-vite';
import { List, ListItem } from './List';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { View } from './tw';

const meta = {
  title: 'UI/List',
  component: List,
  args: { children: null },
} satisfies Meta<typeof List>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Roster: Story = {
  render: () => (
    <View className="max-w-content-form p-4">
      <List>
        <ListItem
          leading={<Avatar name="Maya Rodriguez" size="sm" />}
          trailing={<Badge label="Owner" tone="primary" />}
          supportingText="Soprano · joined 2019"
          onPress={() => {}}
        >
          Maya Rodriguez
        </ListItem>
        <ListItem
          leading={<Avatar name="Daniel Okafor" size="sm" />}
          trailing={<Badge label="Admin" tone="accent" />}
          supportingText="Tenor · joined 2021"
          onPress={() => {}}
        >
          Daniel Okafor
        </ListItem>
        <ListItem
          leading={<Avatar name="Priya Raman" size="sm" />}
          trailing={<Badge label="Invited" />}
          supportingText="Alto"
        >
          Priya Raman
        </ListItem>
      </List>
    </View>
  ),
};

export const PlainRows: Story = {
  render: () => (
    <View className="max-w-content-form p-4">
      <List>
        <ListItem supportingText="9:00 AM · Main hall">Tuesday standup</ListItem>
        <ListItem supportingText="6:30 PM · Rehearsal room">Sectional practice</ListItem>
        <ListItem supportingText="Saturday · 4:00 PM">Dress rehearsal</ListItem>
      </List>
    </View>
  ),
};
