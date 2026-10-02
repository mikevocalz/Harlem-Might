import { createFileRoute } from '@tanstack/react-router';
import {
  Badge,
  BusinessIdentity,
  DataTable,
  Heading,
  Text,
  type ColumnDef,
} from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';
import { listPlaces, type CmsPlace } from '@/lib/payload';
import { CmsOffline } from '@/components/cms-offline';

export const Route = createFileRoute('/admin/businesses')({
  loader: () => listPlaces(),
  head: () => ({ meta: [{ title: 'Businesses — Harlem Mights Admin' }] }),
  component: BusinessesAdmin,
});

const labelLifecycle = (value?: string | null) =>
  (value ?? 'unknown').replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());

const qualityTone = (state?: string | null) => {
  if (state === 'verified') return 'success' as const;
  if (state === 'needs_review') return 'warning' as const;
  return 'neutral' as const;
};

const columns: ColumnDef<CmsPlace, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Business / place',
    cell: ({ row }) => {
      const logo = row.original.logo;
      const logoUri = typeof logo === 'object' && logo ? logo.url : undefined;
      return (
        <BusinessIdentity
          name={row.original.name}
          logoUri={logoUri}
          detail={row.original.primaryCategory ?? row.original.kind ?? 'Place'}
          density="compact"
          size="sm"
        />
      );
    },
  },
  {
    accessorKey: 'primaryArea',
    header: 'Area',
    cell: ({ getValue }) => <Text className="text-sm">{String(getValue() ?? '—')}</Text>,
  },
  {
    accessorKey: 'lifecycle',
    header: 'Lifecycle',
    cell: ({ row }) => (
      <Badge
        label={labelLifecycle(row.original.lifecycle)}
        tone={row.original.lifecycle === 'open' ? 'success' : 'neutral'}
      />
    ),
  },
  {
    id: 'quality',
    header: 'Quality',
    accessorFn: (row) => row.dataQuality?.state ?? 'unverified',
    cell: ({ row }) => (
      <Badge
        label={labelLifecycle(row.original.dataQuality?.state)}
        tone={qualityTone(row.original.dataQuality?.state)}
      />
    ),
  },
  {
    id: 'reviewed',
    header: 'Last reviewed',
    accessorFn: (row) => row.dataQuality?.lastReviewedAt ?? '',
    cell: ({ row }) => (
      <Text className="text-sm tabular-nums text-text-muted">
        {row.original.dataQuality?.lastReviewedAt
          ? new Date(row.original.dataQuality.lastReviewedAt).toLocaleDateString()
          : 'Never'}
      </Text>
    ),
  },
];

function BusinessesAdmin() {
  const { places, status } = Route.useLoaderData();

  return (
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-10 sm:px-6">
        <View className="gap-2">
          <Text className="text-sm font-semibold text-primary">Admin / Catalogue</Text>
          <Heading level={1} size="display-sm" className="text-text">
            Businesses and places
          </Heading>
          <Text className="max-w-3xl text-sm leading-6 text-text-muted md:text-base">
            TanStack owns table state only. Every visible row, header, status badge and identity cell
            comes from the universal UI package.
          </Text>
        </View>

        {!status.ok ? (
          <CmsOffline detail={status.detail} />
        ) : (
          <DataTable
            title="Master catalogue"
            data={places}
            columns={columns}
            emptyText="No places are in the catalogue yet. Create the first canonical Place in Payload."
          />
        )}
      </Section>
    </Main>
  );
}
