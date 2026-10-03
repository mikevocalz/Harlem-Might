import type { Metadata } from 'next';
import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import { MightsBand, MightsButton, MightsPage, MightsPlaceBento, MightsText, routes } from '@acme/ui/mights';

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
      <MightsBand title="No walks published yet" action={<MightsButton href={routes.explore()}>Open the map</MightsButton>}>
        <MightsText>
          The first routes are being researched now. Until they are published, start from a place on the map and
          walk out from there.
        </MightsText>
        <MightsPlaceBento places={MAPPED_PLACES.slice(0, 3)} />
      </MightsBand>
    </MightsPage>
  );
}
