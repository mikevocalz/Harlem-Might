import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { listStories } from '@acme/payload/server';
import { MightsButton, MightsPage, MightsText, routes } from '@acme/ui/mights';
import { StoriesIndex } from '@/components/stories/StoriesIndex';
import { ContentNotice } from '@/components/content/ContentNotice';

export const metadata: Metadata = {
  title: 'Stories',
  description: 'The history behind Harlem blocks, attached to the places where it happened.',
};

export default function StoriesPage() {
  return (
    <MightsPage
      title="Stories"
      lead="The history behind a block, kept on the block where it happened. Every story names its sources."
    >
      <Suspense fallback={<MightsText>Checking for published stories.</MightsText>}>
        <StoriesContent />
      </Suspense>
    </MightsPage>
  );
}

async function StoriesContent() {
  // Read at request time: the build has no content database, and a build-time
  // "unavailable" must never be baked into the static shell.
  await connection();
  const result = await listStories();
  if (result.status === 'unavailable') {
    if (result.reason === 'query-failed') console.error('stories read failed', result.error);
    return (
      <ContentNotice
        title="We couldn’t check for stories right now"
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
    );
  }
  if (result.data.length === 0) {
    return (
      <ContentNotice title="No stories published yet" actions={<MightsButton href={routes.explore()}>Open the map</MightsButton>}>
        Each story will be sourced and attached to the place where it happened. Until the first ones are published, start
        from a place on the map.
      </ContentNotice>
    );
  }
  return <StoriesIndex stories={result.data} />;
}
