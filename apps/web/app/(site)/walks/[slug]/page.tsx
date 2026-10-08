import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { WalkRecord } from '@acme/app/content';
import { View } from '@acme/ui/tw';
import {
  MapAttribution,
  MightsButton,
  MightsHeading,
  MightsMapImage,
  MightsNotchCard,
  MightsPage,
  MightsPlaceBento,
  MightsText,
  routes,
} from '@acme/ui/mights';
import { ContentNotice } from '@/components/content/ContentNotice';
import { SourcesList } from '@/components/content/SourcesList';
import { WalkStops } from '@/components/walks/WalkStops';
import { loadWalk } from '@/components/walks/load';
import { linkPlace, locatePlace } from '@/components/content/place-link';
import { walkFactModules, walkMapView } from '@/components/walks/walk-facts';
import { storyDate } from '@/components/stories/story-format';
import { safeHttpUrl } from '@/components/content/safe-url';

// References (structure only): AllTrails trail overview facts block
// (mobbin.com/screens/fc4f4c20-dc64-4ee6-b5f9-a3f093e30db7) for the B7 strip,
// AllTrails route summary bar (mobbin.com/screens/f1f8dd32-766c-46e1-abd1-e72a8ebda5a7)
// for map plus facts, Viator itinerary (mobbin.com/flows/422bb020-daa3-41b6-bfb4-95ef8b60ac56)
// for the numbered stop list.
//
// No generateStaticParams: the build has no content database, and with Cache
// Components an empty list is a build error. Every walk renders at request time.
// The shell reads the pathname outside Suspense, which a runtime slug can't
// prerender, so the segment renders blocking at request time.
export const instant = false;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadWalk(slug);
  if (result.status !== 'ok') return { title: 'Walk' };
  return { title: result.data.title, description: result.data.summary };
}

export default function WalkPage({ params }: Params) {
  return (
    <Suspense>
      <WalkContent params={params} />
    </Suspense>
  );
}

async function WalkContent({ params }: Params) {
  const { slug } = await params;
  const result = await loadWalk(slug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'unavailable') {
    if (result.reason === 'query-failed') console.error('walk read failed', slug, result.error);
    return (
      <MightsPage title="Walk" crumbs={[{ label: 'Walks', href: routes.walks() }]}>
        <ContentNotice
          title="We couldn’t load this walk right now"
          actions={
            <>
              <MightsButton href={routes.walk(slug)}>Try again</MightsButton>
              <MightsButton href={routes.walks()} variant="secondary">
                All walks
              </MightsButton>
            </>
          }
        >
          The walk may well be there; we couldn’t reach our records to check. Try again in a moment.
        </ContentNotice>
      </MightsPage>
    );
  }
  return <Walk walk={result.data} />;
}

function Walk({ walk }: { walk: WalkRecord }) {
  const facts = walkFactModules(walk);
  const view = walkMapView(walk.stops, locatePlace);
  const first = walk.stops[0];
  const firstPoint = first?.place ? locatePlace(first.place.slug) : undefined;
  const firstName = linkPlace(first?.place)?.ref.name ?? first?.place?.name;
  // The note only exists with a source (records.ts), so an unsafe source URL hides the whole note.
  const accessSource = safeHttpUrl(walk.accessibility?.sourceUrl);

  return (
    <MightsPage
      title={walk.title}
      lead={walk.summary}
      crumbs={[
        { label: 'Walks', href: routes.walks() },
        { label: walk.title, href: routes.walk(walk.slug) },
      ]}
    >
      {/* B7 sits directly under the title on every width: the facts decide whether you go. */}
      {facts.length >= 2 ? (
        <MightsPlaceBento variant="compact" headingLevel={2} modules={facts} />
      ) : facts.length === 1 ? (
        <MightsText tone="default">
          {facts[0]!.label}: {facts[0]!.value}
          {facts[0]!.note ? `. ${facts[0]!.note}` : ''}
        </MightsText>
      ) : null}

      <View className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
        <View className="gap-6 md:col-span-5">
          <View className="flex-row flex-wrap gap-3">
            {firstPoint ? (
              <MightsButton
                external
                href={`https://www.google.com/maps/dir/?api=1&destination=${firstPoint[1]},${firstPoint[0]}&travelmode=walking`}
              >
                Directions to the first stop
              </MightsButton>
            ) : null}
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </View>
          {firstName ? <MightsText size="small">The walk starts at {firstName}.</MightsText> : null}
          {walk.accessibility && accessSource ? (
            <View className="gap-2 border-l-2 border-rule-rail pl-4">
              <MightsHeading level={2} size="card">
                Getting around
              </MightsHeading>
              <MightsText tone="default">{walk.accessibility.note}</MightsText>
              <MightsText size="small">
                <a
                  href={accessSource}
                  className="mights-focus text-primary underline underline-offset-4 hover:no-underline"
                >
                  Source for this note
                </a>
                {walk.accessibility.verifiedAt ? (
                  <>
                    , checked <time dateTime={walk.accessibility.verifiedAt}>{storyDate(walk.accessibility.verifiedAt)}</time>
                  </>
                ) : null}
              </MightsText>
            </View>
          ) : null}
        </View>
        {view ? (
          <View className="gap-2 md:col-span-7">
            <MightsNotchCard className="aspect-video">
              <MightsMapImage
                center={view.center}
                zoom={view.zoom}
                width={1120}
                height={630}
                sizes="(min-width: 768px) 58vw, 100vw"
                pins={view.pins}
                alt={`Map of the ${view.located} stops on ${walk.title}`}
                priority
              />
            </MightsNotchCard>
            <MightsText size="small">
              {/* The record has no route line yet, so the map shows stops, not the path. */}
              Pins mark the stops; the red pin is where the walk starts.
              {view.located < walk.stops.length ? ` ${view.located} of ${walk.stops.length} stops are on the map.` : ''}
            </MightsText>
            <MapAttribution />
          </View>
        ) : null}
      </View>

      <WalkStops stops={walk.stops} />
      <SourcesList sources={walk.sources} />
    </MightsPage>
  );
}
