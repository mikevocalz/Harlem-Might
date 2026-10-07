import { createFileRoute } from '@tanstack/react-router';
import { PublicSectionPage } from '@/components/public-section-page';

export const Route = createFileRoute('/explore')({
  head: () => ({ meta: [{ title: 'Explore Harlem — Harlem Might' }] }),
  component: ExplorePage,
});

function ExplorePage() {
  return (
    <PublicSectionPage
      headline="Start with a block."
      intro="Move the map, search a place or choose a category. Harlem Might keeps the story, source and real entrance attached to the location."
      items={[
        { title: 'Map and list together', body: 'The map is the spatial view; the list is the equally complete accessible view. Filters and ordering stay in sync.' },
        { title: 'A place is more than a pin', body: 'Open hours, why it matters, archival context, nearby places and source history live behind the same canonical Place ID.' },
        { title: 'Navigate only when you ask', body: 'Normal browsing comes from the Harlem Might catalogue. Paid routing starts only after you choose Walk there.' },
      ]}
      closing="The full split-pane map, Rive information panel and image rail land after the catalogue APIs and Nitro Mapbox AR integration are connected."
    />
  );
}
