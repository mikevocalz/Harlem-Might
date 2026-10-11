import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cachedMusicArtists } from '@/lib/cached-content';
import { MusicIndexScreen } from '@acme/app/features/music/MusicIndexScreen.tsx';
import { ContentLoader } from '@acme/app/features/site/content/ContentLoader.tsx';

export const metadata: Metadata = {
  title: 'Harlem Music',
  description: 'The artists who made Harlem a stage and a sound — sourced profiles with licensed portraits and featured recordings.',
};

// Suspense like /stories: the cached read can miss at build time (no database in CI), and
// Next refuses to prerender a page that awaits it outside a boundary.
export default function MusicPage() {
  return (
    <Suspense fallback={<ContentLoader label="Checking for published artists" />}>
      <MusicIndexContent />
    </Suspense>
  );
}

async function MusicIndexContent() {
  return <MusicIndexScreen result={await cachedMusicArtists()} />;
}
