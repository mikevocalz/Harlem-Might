import { createFileRoute } from '@tanstack/react-router';
import { Card, Heading, Text } from '@acme/ui';
import { Main, Section, View } from '@acme/ui/tw';
import { listPages, type CmsStatus } from '@/lib/payload';
import { PageCard } from '@/components/page-card';
import { CmsOffline } from '@/components/cms-offline';
import { SightlineHero } from '@/components/sightline-hero';

const TITLE = 'Harlem Mights — see Harlem in layers';
const DESCRIPTION =
  'A spatial guide to Harlem: places, history, food, culture, walks, events and AR navigation built from a first-party catalogue.';

export const Route = createFileRoute('/')({
  loader: () => listPages(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: LandingPage,
});

const CHAPTERS = [
  {
    title: 'Start with a block.',
    body: 'Move the map, pick a place, and keep the story attached to the location instead of reducing Harlem to a list of pins.',
  },
  {
    title: 'Look up. The history is already there.',
    body: 'Carry a walking route from the map into AR, resolve the real entrance, and surface the story where it happened.',
  },
  {
    title: 'The same corner. Another century.',
    body: 'Registered archival layers make then-and-now comparisons spatial, sourced and connected to the exact place.',
  },
] as const;

function LandingPage() {
  const { pages, status } = Route.useLoaderData();

  return (
    <Main className="flex-1 bg-surface">
      <SightlineHero />

      <Section className="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-14 sm:px-6 md:py-20">
        <View className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CHAPTERS.map((chapter, index) => (
            <Card
              key={chapter.title}
              elevation={index === 0 ? 'raised' : 'flat'}
              className="min-h-60 gap-4 border-border bg-surface-raised p-6"
            >
              <Text className="text-xs font-semibold tabular-nums text-primary">
                {String(index + 1).padStart(2, '0')}
              </Text>
              <Heading level={2} size="title" className="text-text">
                {chapter.title}
              </Heading>
              <Text className="text-sm leading-6 text-text-muted md:text-base md:leading-7">
                {chapter.body}
              </Text>
            </Card>
          ))}
        </View>
      </Section>

      <Section className="mx-auto w-full max-w-screen-2xl gap-6 px-4 py-14 sm:px-6 md:py-20">
        <View className="max-w-3xl gap-2">
          <Heading level={2} size="display-sm" className="text-text">
            Stories from the catalogue
          </Heading>
          <Text className="text-sm leading-6 text-text-muted md:text-base">
            Published editorial pages from Payload appear here while the full place, story and tour collections are built.
          </Text>
        </View>
        <CmsRail pages={pages} status={status} />
      </Section>
    </Main>
  );
}

function CmsRail({
  pages,
  status,
}: {
  pages: Awaited<ReturnType<typeof listPages>>['pages'];
  status: CmsStatus;
}) {
  if (!status.ok) return <CmsOffline detail={status.detail} />;

  if (pages.length === 0) {
    return (
      <View className="rounded-xl border border-border bg-surface-raised px-6 py-10 shadow-card">
        <Text className="text-sm text-text-muted">
          The editorial catalogue is connected and ready for its first published story.
        </Text>
      </View>
    );
  }

  return (
    <View className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pages.map((page) => (
        <PageCard key={page.id} page={page} />
      ))}
    </View>
  );
}
