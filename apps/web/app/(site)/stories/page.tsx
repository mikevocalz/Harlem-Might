import type { Metadata } from 'next';
import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import { MightsBand, MightsButton, MightsPage, MightsPlaceBento, MightsText, routes } from '@acme/ui/mights';

export const metadata: Metadata = {
  title: 'Stories',
  description: 'The history behind Harlem blocks, attached to the places where it happened.',
};

export default function StoriesPage() {
  return (
    <MightsPage title="Stories" lead="The history behind a block, kept on the block where it happened.">
      <MightsBand title="No stories published yet" action={<MightsButton href={routes.explore()}>Open the map</MightsButton>}>
        <MightsText>
          Each story will be sourced and attached to a place. Until the first ones are published, these places are
          where they begin.
        </MightsText>
        <MightsPlaceBento places={MAPPED_PLACES.slice(3, 6)} />
      </MightsBand>
    </MightsPage>
  );
}
