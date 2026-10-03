import { MAPPED_PLACES } from '@acme/app/features/explore/explore.store.ts';
import { MightsBand, MightsPage, MightsPlaceBento, MightsSearchForm } from '@acme/ui/mights';

// One 404 body for unmatched URLs (global-not-found) and notFound() calls.
export function NotFoundContent() {
  return (
    <MightsPage title="There's nothing at this address" lead="Search for a place, or start from one of these.">
      <MightsSearchForm />
      <MightsBand title="Popular places">
        <MightsPlaceBento places={MAPPED_PLACES.slice(0, 3)} />
      </MightsBand>
    </MightsPage>
  );
}
