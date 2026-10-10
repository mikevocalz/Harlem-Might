import type { Metadata } from 'next';
import { MightsText } from '@acme/ui/mights';

export const metadata: Metadata = {
  title: 'Music',
  description: 'Discover the musicians and musical heritage of Harlem.',
};

export default function MusicPage() {
  return (
    <section aria-labelledby="music-title" className="mx-auto max-w-5xl px-6 py-16">
      <h1 id="music-title" className="text-4xl font-semibold">Harlem Music</h1>
      <MightsText>Artist biographies and featured performances will appear after editorial verification.</MightsText>
    </section>
  );
}
