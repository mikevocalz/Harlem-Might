import { getHarlemArchivalImage, type StoryRecord, type UnavailableReason, type WalkRecord } from '@acme/app/content';
import { MightsButton, MightsEditorialImage, MightsPage, MightsText, routes } from '@acme/ui/mights';
import { ContentNotice } from '../content/ContentNotice.tsx';
import { SourcesList } from '../content/SourcesList.tsx';
import { StoriesArchiveStrip, StoriesIndex, StoryMedia } from './StoriesIndex.tsx';
import { StoryArticle, StoryByline } from './StoryArticle.tsx';
import { StoryRelated } from './StoryRelated.tsx';

/** A read the screen can render: rows, or "couldn't check" (never the empty copy for a failed read). */
export type ScreenResult<T> = { status: 'ok'; data: T } | { status: 'unavailable'; reason?: UnavailableReason };

const archiveImage = getHarlemArchivalImage('nypl-harlem-newspaper-stand-1939');
const heroImage = getHarlemArchivalImage('nypl-harlem-storefronts-1939');

const hero = heroImage ? (
  <MightsEditorialImage image={heroImage} screenId="stories-hero" ratio="wide" priority sizes="(min-width: 768px) 40vw, 100vw" />
) : undefined;

/** The Stories index, shared by the site page and the app tab. `result` undefined = still loading. */
export function StoriesScreen({ result }: { result: ScreenResult<readonly StoryRecord[]> | undefined }) {
  return (
    <MightsPage
      title="Stories"
      lead="The history behind a block, kept on the block where it happened. Every story names its sources."
      media={hero}
    >
      <StoriesBody result={result} />
    </MightsPage>
  );
}

function StoriesBody({ result }: { result: ScreenResult<readonly StoryRecord[]> | undefined }) {
  if (!result) return <MightsText>Checking for published stories.</MightsText>;
  if (result.status === 'unavailable') {
    return (
      <>
        <ContentNotice
          title="We couldn’t check for stories right now"
          image={archiveImage}
          actions={
            <>
              <MightsButton href={routes.stories()}>Try again</MightsButton>
              <MightsButton href={routes.explore()} variant="secondary">
                Open the map
              </MightsButton>
            </>
          }
        >
          Our records didn’t answer, so we can’t say which stories are published. Try again in a moment, or start from a
          place on the map.
        </ContentNotice>
        <StoriesArchiveStrip />
      </>
    );
  }
  if (result.data.length === 0) {
    return (
      <>
        <ContentNotice
          title="No stories published yet"
          image={archiveImage}
          actions={<MightsButton href={routes.explore()}>Open the map</MightsButton>}
        >
          Each story will be sourced and attached to the place where it happened. Until the first ones are published, start
          from a place on the map.
        </ContentNotice>
        <StoriesArchiveStrip />
      </>
    );
  }
  return (
    <>
      <StoriesIndex stories={result.data} />
      <StoriesArchiveStrip />
    </>
  );
}

/**
 * One story, shared by the site page and the app route. A story's own first
 * image leads the page; without one, the archive photograph does.
 */
export function StoryScreen({
  slug,
  result,
  walks,
}: {
  slug: string;
  result: ScreenResult<StoryRecord> | { status: 'not-found' } | undefined;
  walks: readonly WalkRecord[];
}) {
  if (!result) {
    return (
      <MightsPage title="Story" media={hero}>
        <MightsText>Loading the story.</MightsText>
      </MightsPage>
    );
  }
  if (result.status === 'not-found') {
    return (
      <MightsPage title="Story" media={hero}>
        <ContentNotice
          title="This story isn’t published"
          image={archiveImage}
          actions={<MightsButton href={routes.stories()}>All stories</MightsButton>}
        >
          It may have been moved or taken down. Every published story is on the Stories page.
        </ContentNotice>
      </MightsPage>
    );
  }
  if (result.status === 'unavailable') {
    return (
      <MightsPage title="Story" crumbs={[{ label: 'Stories', href: routes.stories() }]} media={hero}>
        <ContentNotice
          title="We couldn’t load this story right now"
          image={archiveImage}
          actions={
            <>
              <MightsButton href={routes.story(slug)}>Try again</MightsButton>
              <MightsButton href={routes.stories()} variant="secondary">
                All stories
              </MightsButton>
            </>
          }
        >
          The story may well be there; we couldn’t reach our records to check. Try again in a moment.
        </ContentNotice>
      </MightsPage>
    );
  }
  const story = result.data;
  // The lead image (a portrait for a person, the building for a place)
  // heads the page; the article carries the rest, so nothing shows twice.
  // A story without its own image opens on its place, else the archive.
  const [lead, ...rest] = story.images;
  return (
    <MightsPage
      title={story.title}
      lead={story.dek}
      crumbs={[
        { label: 'Stories', href: routes.stories() },
        { label: story.title, href: routes.story(story.slug) },
      ]}
      media={
        lead ? (
          <MightsEditorialImage image={lead} screenId={`story-${story.slug}`} ratio="standard" priority sizes="(min-width: 768px) 40vw, 100vw" />
        ) : (
          <StoryMedia story={story} />
        )
      }
    >
      <StoryByline story={story} />
      <StoryArticle story={{ ...story, images: rest }} />
      <StoryRelated story={story} walks={walks} />
      <SourcesList sources={story.sources} />
    </MightsPage>
  );
}

