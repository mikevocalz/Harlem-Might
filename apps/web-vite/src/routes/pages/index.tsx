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
      { title: 'Stories and pages — Harlem Mights' },
      {
        name: 'description',
        content: 'Published stories and editorial pages from the Harlem Mights catalogue.',
      },
    ],
  }),
  component: PagesIndex,
});

function PagesIndex() {
  const { pages, status } = Route.useLoaderData();

  return (
    <Main className="flex-1 bg-surface">
      <Section className="mx-auto w-full max-w-screen-2xl gap-8 px-4 py-12 sm:px-6 md:py-16">
        <View className="max-w-4xl gap-3">
          <Heading level={1} size="display-md" className="tracking-[-0.035em] text-text">
            Published stories
          </Heading>
          <Text className="max-w-3xl text-base leading-7 text-text-muted">
            Editorial pages from the Harlem Mights catalogue, with sources and place context kept close to the story.
          </Text>
        </View>

        {!status.ok ? (
          <CmsOffline detail={status.detail} />
        ) : pages.length === 0 ? (
          <View className="rounded-xl border border-border bg-surface-raised px-6 py-10 shadow-card">
            <Text className="text-sm leading-6 text-text-muted">
              The editorial catalogue is connected and ready for its first published story.
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
