import { createFileRoute } from '@tanstack/react-router';
import { PublicSectionPage } from '@/components/public-section-page';

export const Route = createFileRoute('/walks')({
  head: () => ({ meta: [{ title: 'Walks — Harlem Mights' }] }),
  component: WalksPage,
});

function WalksPage() {
  return (
    <PublicSectionPage
      headline="Take the long way."
      intro="Walks connect places into a story without turning the neighborhood into a checklist. Time, distance, accessibility and sources stay visible."
      items={[
        { title: 'Harlem Renaissance', body: 'Homes, libraries, theaters, publishing, murals and the blocks that connected writers, artists and audiences.' },
        { title: 'Jazz after dark', body: 'Active venues and historical-only sites can live in the same route without pretending the old room is still there.' },
        { title: 'Architecture and stoops', body: 'Brownstone rows, historic districts, civic buildings and the details worth looking up from the sidewalk to notice.' },
      ]}
      closing="Any walk can hand the next stop to the same 2D route session and, on supported devices, continue into AR."
    />
  );
}
