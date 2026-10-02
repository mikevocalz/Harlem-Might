import { createFileRoute } from '@tanstack/react-router';
import { PublicSectionPage } from '@/components/public-section-page';

export const Route = createFileRoute('/today')({
  head: () => ({ meta: [{ title: 'Today in Harlem — Harlem Mights' }] }),
  component: TodayPage,
});

function TodayPage() {
  return (
    <PublicSectionPage
      headline="What's on in Harlem today."
      intro="Performances, exhibitions, readings, community events and places worth making time for—organized around where they happen."
      items={[
        { title: 'Live events', body: 'Current event feeds stay separate from permanent place records so stale event data can expire without damaging the catalogue.' },
        { title: 'Open now', body: 'Operating hours are timestamped evidence, not a forever fact. Stale hours are called out instead of being presented with false confidence.' },
        { title: 'Nearby after', body: 'When an event ends, continue from the venue into nearby food, music, bookstores, parks or another story on the same block.' },
      ]}
    />
  );
}
