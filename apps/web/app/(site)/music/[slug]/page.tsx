import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MusicArtistScreen } from '@acme/app/features/music/MusicArtistScreen.tsx';
import { musicArtistOpenGraphPhoto } from '@acme/app/features/music/artist-photo-metadata.ts';
import { cachedMusicArtist as loadArtist } from '@/lib/cached-content';

// No generateStaticParams: the build has no content database, and with Cache
// Components an empty list is a build error. Artists render at request time.
export const instant = false;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadArtist(slug);
  if (result.status !== 'ok') return { title: 'Harlem Music' };
  const { name, shortBio } = result.data;
  const photo = musicArtistOpenGraphPhoto(result.data);
  return {
    title: name,
    description: shortBio,
    openGraph: photo ? { images: [photo] } : undefined,
  };
}

export default function MusicArtistPage({ params }: Params) {
  return (
    <Suspense>
      <MusicArtistContent params={params} />
    </Suspense>
  );
}

async function MusicArtistContent({ params }: Params) {
  const { slug } = await params;
  const result = await loadArtist(slug);
  if (result.status === 'not-found') notFound();
  return <MusicArtistScreen slug={slug} result={result} />;
}
