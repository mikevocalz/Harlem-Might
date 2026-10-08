import type { Metadata } from 'next';
import { MightsJsonLd } from '@acme/ui/mights';
import { ProductHome } from '../../components/site/ProductHome';

export const metadata: Metadata = {
  title: { absolute: 'Harlem Might — see the block, know the story' },
  description: "Harlem's places on one map, each with why it matters and where it sits on the block.",
};

export default function HomePage() {
  return (
    <>
      <MightsJsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Harlem Might',
          potentialAction: {
            '@type': 'SearchAction',
            target: '/explore?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <ProductHome />
    </>
  );
}
