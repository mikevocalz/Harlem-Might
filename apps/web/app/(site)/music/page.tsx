import type { Metadata } from 'next';
import { MightsText } from '@acme/ui/mights';
import { H1, Section } from '@acme/ui/tw';

export const metadata: Metadata = {
  title: 'Music',
  description: 'Discover the musicians and musical heritage of Harlem.',
};

export default function MusicPage() {
  return (
    <Section aria-labelledby="music-title" className="mx-auto max-w-5xl px-6 py-16">
      <H1 id="music-title" className="text-4xl font-semibold">Harlem Music</H1>
      <MightsText>Artist biographies and featured performances will appear after editorial verification.</MightsText>
    </Section>
  );
}
