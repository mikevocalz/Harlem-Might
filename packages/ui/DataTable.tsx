'use client';
import { tv, type VariantProps } from 'tailwind-variants';
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from './primitives';
import { ScrollView, View, Text, Pressable } from './tw';

const dataTable = tv({
  slots: {
    root:
      'w-full overflow-hidden rounded-xl border border-border bg-surface-raised shadow-card',
    titleBar:
      'flex-row items-center justify-between gap-3 border-b border-border bg-surface-raised px-4 py-3',
    title: 'font-semibold text-text',
    headRow: 'flex-row border-b border-border bg-surface-sunken/70',
    headCell:
      'flex-1 border-r border-border/70 px-4 py-3 text-left text-xs font-semibold text-text-muted last:border-r-0',
    headButton:
      'min-h-8 flex-row items-center justify-between gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40',
    sortGlyph: 'text-[10px] font-semibold text-primary',
    row:
      'flex-row border-b border-border/70 border-l-2 border-l-transparent bg-surface-raised transition-colors duration-fast last:border-b-0 hover:border-l-primary hover:bg-sky-50/45 motion-reduce:transition-none',
    rowStriped: 'odd:bg-surface-sunken/30',
    cell:
      'flex-1 justify-center border-r border-border/60 px-4 py-3 text-sm text-text last:border-r-0',
    empty: 'items-center justify-center px-6 py-12',
    emptyText: 'text-sm text-text-muted',
    skeleton: 'h-4 w-4/5 rounded-md bg-surface-sunken',
  },
  variants: {
    density: {
      compact: {
        headCell: 'px-3 py-2',
        cell: 'px-3 py-2',
      },
      comfortable: {},
    },
  },
  defaultVariants: { density: 'comfortable' },
});

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

export type ColumnDef<T extends RowData, TValue = unknown> =
  TanStackColumnDef<typeof features, T, TValue>;

export interface DataTableProps<T extends RowData>
  extends VariantProps<typeof dataTable> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  title?: string;
  sortable?: boolean;
  striped?: boolean;
  loading?: boolean;
  loadingRows?: number;
  emptyText?: string;
  minWidth?: number;
  className?: string;
}

export function DataTable<T extends RowData>({
  data,
  columns,
  title,
  sortable = true,
  striped = false,
  loading = false,
  loadingRows = 5,
  emptyText = 'No records yet.',
  minWidth = 760,
  density,
  className,
}: DataTableProps<T>) {
  const store = useInstanceStore<{ sorting: SortingState }>(() => ({ sorting: [] }));
  const sorting = useStore(store, (state) => state.sorting);
  const onSortingChange = (updater: Updater<SortingState>) =>
    store.setState((state) => ({
      sorting: typeof updater === 'function' ? updater(state.sorting) : updater,
    }));

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting },
    onSortingChange,
    enableSorting: sortable,
  });

  const styles = dataTable({ density });
  const headerGroups = table.getHeaderGroups();
  const leafColumnCount = headerGroups.at(-1)?.headers.length ?? columns.length;

  return (
    <View className={styles.root({ className })}>
      {title ? (
        <View className={styles.titleBar()}>
          <Text className={styles.title()}>{title}</Text>
          <Text className="text-xs tabular-nums text-text-muted">
            {loading ? 'Updating…' : `${data.length} records`}
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal className="w-full">
        <Table className="w-full flex-col" style={{ minWidth }}>
          <TableHeader>
            {headerGroups.map((headerGroup) => (
              <TableRow key={headerGroup.id} className={styles.headRow()}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const label = header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext());

                  return (
                    <TableHeaderCell key={header.id} className={styles.headCell()}>
                      {sortable && header.column.getCanSort() ? (
                        <Pressable
                          onPress={() => header.column.toggleSorting()}
                          aria-label={`Sort by ${header.column.id}`}
                          className={styles.headButton()}
                        >
                          <Text className="text-xs font-semibold text-text-muted">{label}</Text>
                          <Text className={styles.sortGlyph()}>
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
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
            {loading
              ? Array.from({ length: loadingRows }, (_, rowIndex) => (
                  <TableRow key={`loading-${rowIndex}`} className={styles.row()}>
                    {Array.from({ length: leafColumnCount }, (_, cellIndex) => (
                      <TableCell key={`loading-${rowIndex}-${cellIndex}`} className={styles.cell()}>
                        <View className={styles.skeleton()} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`${styles.row()} ${striped ? styles.rowStriped() : ''}`}
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className={styles.cell()}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </ScrollView>

      {!loading && data.length === 0 ? (
        <View className={styles.empty()}>
          <Text className={styles.emptyText()}>{emptyText}</Text>
        </View>
      ) : null}
    </View>
  );
}
