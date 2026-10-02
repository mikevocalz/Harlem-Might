/**
 * `/pages` — every published entry in the `pages` collection, straight off the
 * Payload REST API.
 *
 * SOT-KEYWORDS: web-vite pages index payload listing
 */
import { createFileRoute } from '@tanstack/react-router';
import { Heading, Text } from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';
import { listPages } from '@/lib/payload';
import { PageCard } from '@/components/page-card';
import { CmsOffline } from '@/components/cms-offline';

export const Route = createFileRoute('/pages/')({
  loader: () => listPages(),
  head: () => ({
    meta: [
      { title: 'Content — Harlem Might' },
      { name: 'description', content: 'Pages published in the Harlem Might CMS.' },
    ],
  }),
  component: PagesIndex,
});

function PagesIndex() {
  const { pages, status } = Route.useLoaderData();

  return (
    <Main className="flex-1">
      <Section className="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-16 sm:px-6">
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
            Harlem Might / Content
          </Text>
          <Heading level={1} size="display-sm" className="text-white">
            Published pages
          </Heading>
        </View>

        {!status.ok ? (
          <CmsOffline detail={status.detail} />
        ) : pages.length === 0 ? (
          <View className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] px-6 py-10">
            <Text className="text-sm text-cyan-100/60">
              Nothing published yet — create a page in the{' '}
              <a
                href="http://localhost:3000/admin"
                className="text-cyan-300 underline underline-offset-4"
              >
                Payload admin
              </a>{' '}
              and tick `published`.
            </Text>
          </View>
        ) : (
          <View className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <PageCard key={page.id} page={page} />
            ))}
          </View>
        )}
      </Section>
    </Main>
  );
}
