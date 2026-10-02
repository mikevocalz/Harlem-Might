import { Link, createFileRoute } from '@tanstack/react-router';
import { Card, GridScene, Heading, MightsParallax, Text } from '@acme/ui';
import { MightsSightlineHero } from '@acme/spatial';
import { Main, Section, View } from '@acme/ui/tw';
import { listPages, type CmsStatus } from '@/lib/payload';
import { PageCard } from '@/components/page-card';
import { CmsOffline } from '@/components/cms-offline';

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
      <View className="relative min-h-[78vh] overflow-hidden border-b border-border">
        <View className="absolute inset-0 opacity-75">
          <GridScene
            className="flex-1"
            horizon={0.5}
            gap={0}
            speed={0.32}
            lineColor="#A9B4AE"
            glowColor="#1F4FE0"
            backgroundColor="#EEF0EC"
            opacity={0.42}
            showCeiling={false}
          />
        </View>

        <Section className="relative mx-auto w-full max-w-screen-2xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:flex-row lg:items-center lg:py-28">
          <View className="max-w-3xl flex-1 gap-5">
            <Text className="self-start rounded-full border border-border bg-surface-raised/90 px-3 py-1.5 text-xs font-medium text-text-muted shadow-card">
              A spatial guide to Harlem
            </Text>
            <Heading level={1} size="display-2xl" className="max-w-4xl tracking-[-0.045em] text-text">
              See Harlem in layers.
            </Heading>
            <Text className="max-w-3xl text-base leading-7 text-text-muted md:text-xl md:leading-9">
              Every block here holds more than one Harlem. Find the places people talk about,
              the stories behind them, and the way to walk there.
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-3">
              <Link
                to="/explore"
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-card transition-colors duration-150 hover:bg-primary-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
              >
                Explore Harlem
              </Link>
              <Link
                to="/ar"
                className="rounded-lg border border-border-strong bg-surface-raised px-5 py-3 text-sm font-semibold text-text shadow-card transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40"
              >
                See how AR works
              </Link>
            </View>
            <Text className="pt-2 text-xs text-text-muted">
              Built from local knowledge, public records and verified sources.
            </Text>
          </View>

          <MightsParallax className="min-h-[360px] flex-1 lg:min-h-[520px]" distance={88}>
            <View className="relative min-h-[360px] flex-1 overflow-hidden rounded-[28px] border border-border bg-surface-raised/75 shadow-raised lg:min-h-[520px]">
              <MightsSightlineHero style={{ flex: 1, minHeight: 360 }} />
              <View className="pointer-events-none absolute bottom-4 left-4 right-4 flex-row items-center justify-between rounded-xl border border-border bg-surface-raised/90 px-4 py-3 shadow-card">
                <View className="gap-0.5">
                  <Text className="text-xs font-semibold text-primary">Mights Sightline</Text>
                  <Text className="text-xs text-text-muted">Spatial glasses + pocket compute</Text>
                </View>
                <Text className="text-xs font-semibold text-text">Map → route → AR</Text>
              </View>
            </View>
          </MightsParallax>
        </Section>
      </View>

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
