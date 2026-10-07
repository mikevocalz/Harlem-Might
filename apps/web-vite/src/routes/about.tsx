import { createFileRoute } from '@tanstack/react-router';
import { PublicSectionPage } from '@/components/public-section-page';

export const Route = createFileRoute('/about')({
  head: () => ({ meta: [{ title: 'About — Harlem Might' }] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicSectionPage
      headline="Built to know the difference between a pin and a place."
      intro="A coordinate can tell you where something is. Harlem Might is built to preserve why it matters, who is connected to it, what changed and where the information came from."
      items={[
        { title: 'Harlem first', body: 'The product balances resident usefulness with visitor discovery and keeps historical-only places visible instead of deleting them from memory.' },
        { title: 'Provenance by default', body: 'External APIs are evidence providers. Canonical records are curated, conflicts stay visible and every non-editorial fact can point back to a source.' },
        { title: 'Corrections are part of the product', body: 'Businesses, institutions and community members need a clear route to flag an error and send it into a curator review queue.' },
      ]}
    />
  );
}
