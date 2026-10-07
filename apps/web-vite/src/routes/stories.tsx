import { createFileRoute } from '@tanstack/react-router';
import { PublicSectionPage } from '@/components/public-section-page';

export const Route = createFileRoute('/stories')({
  head: () => ({ meta: [{ title: 'Stories — Harlem Might' }] }),
  component: StoriesPage,
});

function StoriesPage() {
  return (
    <PublicSectionPage
      headline="History lives on the block."
      intro="Read Harlem through the places where the story happened—homes, stages, churches, restaurants, parks, storefronts and rooms that changed what came next."
      items={[
        { title: 'Then and now', body: 'Registered archival and present-day views stay attached to one address, with credits and rights information always visible.' },
        { title: 'People and places', body: 'A person can connect to many places and a place to many people, without flattening either into a trivia field.' },
        { title: 'Sources you can inspect', body: 'Historical claims keep their references. Disputed interpretations are attributed rather than silently rewritten as fact.' },
      ]}
      closing="Every story can return you to the map at the exact place being discussed."
    />
  );
}
