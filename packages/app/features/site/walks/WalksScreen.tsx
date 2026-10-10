import { getHarlemArchivalImage, type WalkRecord } from "@acme/app/content";
import { View } from "@acme/ui/tw";
import {
  MightsButton,
  MightsEditorialImage,
  MightsHeading,
  MightsPage,
  MightsPlaceBento,
  MightsText,
  routes,
} from "@acme/ui/mights";
import { ContentNotice } from "../content/ContentNotice.tsx";
import { SourcesList } from "../content/SourcesList.tsx";
import { WalksIndex } from "./WalksIndex.tsx";
import { WalkStops } from "./WalkStops.tsx";
import { walkFactModules } from "./walk-facts.ts";
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

/** One walk, shared by the site page and app route. */
export function WalkScreen({
  slug,
  result,
}: {
  slug: string;
  result: ScreenResult<WalkRecord> | { status: "not-found" } | undefined;
}) {
  if (!result)
    return (
      <MightsPage title="Walk">
        <MightsText>Loading the walk.</MightsText>
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
      </MightsPage>
    );
  }
  const walk = result.data;
  const facts = walkFactModules(walk);
  return (
    <MightsPage
      title={walk.title}
      lead={walk.summary}
      crumbs={[
        { label: "Walks", href: routes.walks() },
        { label: walk.title, href: routes.walk(walk.slug) },
      ]}
    >
      {facts.length >= 2 ? (
        <MightsPlaceBento variant="compact" headingLevel={2} modules={facts} />
      ) : facts.length === 1 ? (
        <MightsText tone="default">
          {facts[0]!.label}: {facts[0]!.value}
          {facts[0]!.note ? `. ${facts[0]!.note}` : ""}
        </MightsText>
      ) : null}
      <View className="flex-row flex-wrap gap-3">
        <MightsButton href={routes.explore()} variant="secondary">
          Open the map
        </MightsButton>
      </View>
      {walk.accessibility ? (
        <View className="gap-2 border-l-2 border-rule-rail pl-4">
          <MightsHeading level={2} size="card">
            Getting around
          </MightsHeading>
          <MightsText tone="default">{walk.accessibility.note}</MightsText>
        </View>
      ) : null}
      {walk.images.length ? (
        <View className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {walk.images.map((image, index) => (
            <View
              key={image.id}
              className={index === 0 ? "md:col-span-7" : "md:col-span-5"}
            >
              <MightsEditorialImage
                image={image}
                screenId={`walk-${walk.slug}`}
                ratio={index === 0 ? "wide" : "standard"}
                priority={index === 0}
              />
            </View>
          ))}
        </View>
      ) : null}
      <WalkStops stops={walk.stops} />
      <SourcesList sources={walk.sources} />
    </MightsPage>
  );
}
