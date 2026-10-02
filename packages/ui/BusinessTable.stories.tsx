import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { BusinessIdentity } from './BusinessIdentity';
import { DataTable, type ColumnDef } from './DataTable';
import { View, Text } from './tw';

type BusinessRow = {
  name: string;
  category: string;
  area: string;
  state: 'Verified' | 'Needs review' | 'Draft';
  freshness: string;
};

const ROWS: BusinessRow[] = [
  { name: 'Red Rooster Harlem', category: 'Restaurant', area: 'Central Harlem', state: 'Verified', freshness: '12 days' },
  { name: "Sylvia's Restaurant", category: 'Restaurant', area: 'Central Harlem', state: 'Needs review', freshness: '34 days' },
  { name: 'Apollo Theater', category: 'Performing arts', area: '125th Street', state: 'Verified', freshness: '7 days' },
  { name: 'Harlem Stage', category: 'Cultural institution', area: 'West Harlem', state: 'Draft', freshness: '—' },
];

const COLUMNS: ColumnDef<BusinessRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Business',
    cell: ({ row }) => (
      <BusinessIdentity
        name={row.original.name}
        detail={row.original.category}
        density="compact"
        size="sm"
      />
    ),
  },
  { accessorKey: 'area', header: 'Area' },
  {
    accessorKey: 'state',
    header: 'Status',
    cell: ({ getValue }) => {
      const value = String(getValue());
      const tone = value === 'Verified' ? 'success' : value === 'Draft' ? 'neutral' : 'accent';
      return <Badge label={value} tone={tone} />;
    },
  },
  {
    accessorKey: 'freshness',
    header: 'Last checked',
    cell: ({ getValue }) => <Text className="tabular-nums text-sm">{String(getValue())}</Text>,
  },
];

const meta: Meta = { title: 'UI/Data/BusinessTable' };
export default meta;
type Story = StoryObj;

export const Comfortable: Story = {
  render: () => (
    <View className="w-full max-w-5xl p-4">
      <DataTable title="Harlem businesses" data={ROWS} columns={COLUMNS} />
    </View>
  ),
};

export const Compact: Story = {
  render: () => (
    <View className="w-full max-w-5xl p-4">
      <DataTable title="Harlem businesses" data={ROWS} columns={COLUMNS} density="compact" striped />
    </View>
  ),
};

export const Loading: Story = {
  render: () => (
    <View className="w-full max-w-5xl p-4">
      <DataTable title="Harlem businesses" data={[]} columns={COLUMNS} loading />
    </View>
  ),
};
