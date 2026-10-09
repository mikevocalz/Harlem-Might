import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getHarlemArchivalImage } from '@acme/app/content';
import { cachedWalks } from '@/lib/cached-content';
import { MightsButton, MightsPage, MightsText, routes } from '@acme/ui/mights';
import { ContentNotice } from '@acme/app/features/site/content/ContentNotice.tsx';
import { WalksIndex } from '@acme/app/features/site/walks/WalksIndex.tsx';

const archiveImage = getHarlemArchivalImage('nypl-shoeshiners-lenox-avenue-1939');

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
  const result = await cachedWalks();
  if (result.status === 'unavailable') {
    return (
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
        Our records didn’t answer, so we can’t say which walks are published. Try again in a moment, or start from a
        place on the map.
      </ContentNotice>
    );
  }
  if (result.data.length === 0) {
    return (
      <ContentNotice
        title="No walks published yet"
        image={archiveImage}
        actions={<MightsButton href={routes.explore()}>Open the map</MightsButton>}
      >
        The first routes are being researched now. Until they are published, start from a place on the map and walk out
        from there.
      </ContentNotice>
    );
  }
  return <WalksIndex walks={result.data} />;
}
