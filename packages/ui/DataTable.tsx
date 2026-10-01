'use client';
import { tv } from 'tailwind-variants';
import {
  createSortedRowModel,
  flexRender,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef as TanStackColumnDef,
  type RowData,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useInstanceStore, useStore } from './use-instance-store';
import {
  Table, TableHeader, TableBody, TableRow, TableCell, TableHeaderCell,
} from './primitives';
import { View, Text, Pressable } from './tw';

const dataTable = tv({
  slots: {
    root: 'w-full overflow-hidden rounded-card border-2 border-border bg-surface-raised shadow-card',
    headRow: 'flex-row border-b-2 border-border-strong bg-surface-sunken',
    headCell: 'flex-1 p-3 text-left text-sm font-semibold text-text',
    headButton: 'flex-row items-center gap-1.5',
    sortGlyph: 'text-xs text-text-muted',
    row: 'flex-row border-b-2 border-border transition-colors duration-fast hover:bg-surface-sunken motion-reduce:transition-none',
    cell: 'flex-1 justify-center p-3 text-sm text-text',
  },
});

// V9 requires the feature set to be explicit. Keep it module-stable so every
// table instance shares the same feature definition and only sorting code is
// bundled.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

export type ColumnDef<T extends RowData, TValue = unknown> =
  TanStackColumnDef<typeof features, T, TValue>;

export interface DataTableProps<T extends RowData> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Enable click-to-sort headers. */
  sortable?: boolean;
  className?: string;
}

// Headless @tanstack/react-table rendered through the semantic table
// primitives (real <table> on web, role-mapped views on native).
// Sorting state lives in a per-instance zustand store (repo rule).
export function DataTable<T extends RowData>({
  data,
  columns,
  sortable = true,
  className,
}: DataTableProps<T>) {
  const store = useInstanceStore<{ sorting: SortingState }>(() => ({ sorting: [] }));
  const sorting = useStore(store, (s) => s.sorting);
  const onSortingChange = (updater: Updater<SortingState>) =>
    store.setState((s) => ({
      sorting: typeof updater === 'function' ? updater(s.sorting) : updater,
    }));

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange,
    enableSorting: sortable,
  });

  const s = dataTable();
  return (
    <View className={s.root({ className })}>
      <Table className="w-full flex-col">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className={s.headRow()}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const label = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <TableHeaderCell key={header.id} className={s.headCell()}>
                    {sortable && header.column.getCanSort() ? (
                      <Pressable
                        onPress={() => header.column.toggleSorting()}
                        aria-label={`Sort by ${header.column.id}`}
                        className={s.headButton()}
                      >
                        <Text className="text-sm font-semibold">{label}</Text>
                        <Text className={s.sortGlyph()}>
                          {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
                        </Text>
                      </Pressable>
                    ) : (
                      label
                    )}
                  </TableHeaderCell>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className={s.row()}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={s.cell()}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </View>
  );
}
