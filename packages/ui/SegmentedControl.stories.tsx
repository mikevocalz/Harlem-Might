import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './SegmentedControl';
import { View } from './tw';

const RANGE = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;

// Generic component: a bare Meta, as with DataTable — `typeof SegmentedControl`
// cannot be pinned to one option type.
const meta: Meta = { title: 'UI/SegmentedControl' };
export default meta;
type Story = StoryObj;

export const Selection: Story = {
  render: () => (
    <View className="max-w-content-form gap-4 p-4">
      <SegmentedControl options={RANGE} value="week" onChange={() => {}} />
      <SegmentedControl options={RANGE} value="year" onChange={() => {}} />
      <SegmentedControl
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
        ]}
        value="unread"
        onChange={() => {}}
      />
    </View>
  ),
};
