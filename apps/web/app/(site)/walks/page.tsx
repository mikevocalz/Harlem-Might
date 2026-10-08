import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { listWalks } from '@acme/payload/server';
import { MightsButton, MightsPage, MightsText, routes } from '@acme/ui/mights';
import { ContentNotice } from '@/components/content/ContentNotice';
import { WalksIndex } from '@/components/walks/WalksIndex';

export const metadata: Metadata = {
  title: 'Walks',
  description: 'Walking routes through Harlem that connect places into one story.',
};

export default function WalksPage() {
  return (
    <MightsPage
      title="Walks"
      lead="Take the long way. Walks connect places into a story without turning the neighborhood into a checklist."
    >
      <Suspense fallback={<MightsText>Checking for published walks.</MightsText>}>
        <WalksContent />
      </Suspense>
    </MightsPage>
  );
}

async function WalksContent() {
  // Read at request time: the build has no content database, and a build-time
  // "unavailable" must never be baked into the static shell.
  await connection();
  const result = await listWalks();
  if (result.status === 'unavailable') {
    if (result.reason === 'query-failed') console.error('walks read failed', result.error);
    return (
      <ContentNotice
        title="We couldn’t check for walks right now"
        actions={
          <>
            <MightsButton href={routes.walks()}>Try again</MightsButton>
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </>
        }
      >
        Our records didn’t answer, so we can’t say which walks are published. Try again in a moment, or start from a
        place on the map.
      </ContentNotice>
    );
  }
  if (result.data.length === 0) {
    return (
      <ContentNotice title="No walks published yet" actions={<MightsButton href={routes.explore()}>Open the map</MightsButton>}>
        The first routes are being researched now. Until they are published, start from a place on the map and walk out
        from there.
      </ContentNotice>
    );
  }
  return <WalksIndex walks={result.data} />;
}
