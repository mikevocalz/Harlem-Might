import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTable, type ColumnDef } from './DataTable';
import { Badge } from './Badge';
import { View } from './tw';

type Row = { name: string; role: string; status: 'Active' | 'Invited'; logins: number };

const ROWS: Row[] = [
  { name: 'Maya Rodriguez', role: 'Owner', status: 'Active', logins: 128 },
  { name: 'Daniel Okafor', role: 'Admin', status: 'Active', logins: 94 },
  { name: 'Priya Raman', role: 'Editor', status: 'Invited', logins: 12 },
  { name: 'Marcus Bell', role: 'Editor', status: 'Active', logins: 57 },
  { name: 'Elena Fischer', role: 'Viewer', status: 'Invited', logins: 3 },
];

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => (
      <Badge label={String(getValue())} tone={getValue() === 'Active' ? 'success' : 'neutral'} />
    ),
  },
  { accessorKey: 'logins', header: 'Logins' },
];

const meta: Meta = { title: 'UI/DataTable' };
export default meta;
type Story = StoryObj;

export const Sortable: Story = {
  render: () => (
    <View className="max-w-content-detail p-4">
      <DataTable data={ROWS} columns={COLUMNS} />
    </View>
  ),
};
