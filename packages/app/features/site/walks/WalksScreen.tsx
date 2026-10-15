import type { ReactNode } from 'react';
import { WalkJourney } from '../../journey/WalkJourney.tsx';
import { getHarlemArchivalImage, type WalkRecord } from "@acme/app/content";
import { Link, Time } from "@acme/ui/html";
import { View } from "@acme/ui/tw";
import {
  MapAttribution,
  MightsButton,
  MightsEditorialImage,
  MightsHeading,
  MightsMapImage,
  MightsNotchCard,
  MightsPage,
  MightsPlaceBento,
  MightsText,
  routes,
} from "@acme/ui/mights";
import { ContentNotice } from "../content/ContentNotice.tsx";
import { SourcesList } from "../content/SourcesList.tsx";
import { WalksIndex } from "./WalksIndex.tsx";
import { WalkStops } from "./WalkStops.tsx";
import { walkFactModules, walkMapView } from "./walk-facts.ts";
import { storyDate } from "../stories/story-format.ts";
import { safeHttpUrl } from "../content/safe-url.ts";
import type { ScreenResult } from "../stories/StoriesScreen.tsx";
import { ContentLoader } from "@acme/app/features/site/content/ContentLoader.tsx";

const archiveImage = getHarlemArchivalImage(
  "nypl-shoeshiners-lenox-avenue-1939",
);

/** The walks index, shared by the site page and app tab. Undefined means the read is still loading. */
export function WalksScreen({
  result,
}: {
  result: ScreenResult<readonly WalkRecord[]> | undefined;
}) {
  let body;
  if (!result) body = <ContentLoader label="Checking for published walks" />;
  else if (result.status === "unavailable") {
    body = (
      <ContentNotice
        title="We couldn’t check for walks right now"
        image={archiveImage}
        actions={
          <>
            <MightsButton href={routes.walks()}>Try again</MightsButton>
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </>
        }
      >
        Our records didn’t answer, so we can’t say which walks are published.
        Try again in a moment, or start from a place on the map.
      </ContentNotice>
    );
  } else if (result.data.length === 0) {
    body = (
      <ContentNotice
        title="No walks published yet"
        image={archiveImage}
        actions={
          <MightsButton href={routes.explore()}>Open the map</MightsButton>
        }
      >
        The first routes are being researched now. Until they are published,
        start from a place on the map and walk out from there.
      </ContentNotice>
    );
  } else body = <WalksIndex walks={result.data} />;

  return (
    <MightsPage
      title="Walks"
      lead="Take the long way. Walks connect places into a story without turning the neighborhood into a checklist."
    >
      {body}
    </MightsPage>
  );
}

// References (structure only): AllTrails trail overview facts block
// (mobbin.com/screens/fc4f4c20-dc64-4ee6-b5f9-a3f093e30db7) for the B7 strip,
// AllTrails route summary bar (mobbin.com/screens/f1f8dd32-766c-46e1-abd1-e72a8ebda5a7)
// for map plus facts, Viator itinerary (mobbin.com/flows/422bb020-daa3-41b6-bfb4-95ef8b60ac56)
// for the numbered stop list.
//
/** One walk, shared by the site page and app route. */
export function WalkScreen({
  slug,
  result,
  journeyActions,
}: {
  slug: string;
  journeyActions?: ReactNode;
  result: ScreenResult<WalkRecord> | { status: "not-found" } | undefined;
}) {
  if (!result)
    return (
      <MightsPage title="Walk">
        <MightsText>Loading the walk.</MightsText>
        <WalkJourney slug={slug} platformActions={journeyActions} />
      </MightsPage>
    );
  if (result.status === "not-found") {
    return (
      <MightsPage title="Walk">
        <ContentNotice
          title="This walk isn’t published"
          actions={<MightsButton href={routes.walks()}>All walks</MightsButton>}
        >
          It may have been moved or taken down. Every published walk is on the
          Walks page.
        </ContentNotice>
        <WalkJourney slug={slug} platformActions={journeyActions} />
      </MightsPage>
    );
  }
  if (result.status === "unavailable") {
    return (
      <MightsPage
        title="Walk"
        crumbs={[{ label: "Walks", href: routes.walks() }]}
      >
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
          The walk may well be there; we couldn’t reach our records to check.
          Try again in a moment.
        </ContentNotice>
        <WalkJourney slug={slug} platformActions={journeyActions} />
      </MightsPage>
    );
  }
  const walk = result.data;
  const facts = walkFactModules(walk);
  const view = walkMapView(walk.stops);
  const first = walk.stops[0];
  const firstPoint = first?.place?.lngLat;
  const firstName = first?.place?.name;
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
                <Link
                  href={accessSource}
                  className="mights-focus text-primary underline underline-offset-4 hover:no-underline"
                >
                  Source for this note
                </Link>
                {walk.accessibility.verifiedAt ? (
                  <>
                    , checked <Time dateTime={walk.accessibility.verifiedAt}>{storyDate(walk.accessibility.verifiedAt)}</Time>
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
              {firstPoint
                ? 'Pins mark the stops; the red pin is where the walk starts.'
                : 'Pins mark the located stops; the starting stop is not on the map.'}
              {view.located < walk.stops.length ? ` ${view.located} of ${walk.stops.length} stops are on the map.` : ''}
            </MightsText>
            <MapAttribution />
          </View>
        ) : null}
      </View>

      {walk.images.length ? (
        <View className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {walk.images.map((image, index) => (
            <View key={image.id} className={index === 0 ? 'md:col-span-7' : 'md:col-span-5'}>
              <MightsEditorialImage
                image={image}
                screenId={`walk-${walk.slug}`}
                ratio={index === 0 ? 'wide' : 'standard'}
                sizes={index === 0 ? '(min-width: 768px) 58vw, 100vw' : '(min-width: 768px) 42vw, 100vw'}
                priority={index === 0}
              />
            </View>
          ))}
        </View>
      ) : null}

      <WalkJourney slug={walk.slug} platformActions={journeyActions} />
      <WalkStops stops={walk.stops} />
      <SourcesList sources={walk.sources} />
    </MightsPage>
  );
}
