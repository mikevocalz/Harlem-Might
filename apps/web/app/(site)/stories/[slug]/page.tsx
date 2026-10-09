import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { StoryScreen } from '@acme/app/features/site/stories/StoriesScreen.tsx';
import { cachedStory as loadStory, cachedWalks } from '@/lib/cached-content';

// No generateStaticParams: the build has no content database, and with Cache
// Components an empty list is a build error. Stories render at request time.
// The shell reads the pathname outside Suspense, which a runtime slug can't
// prerender, so the segment renders blocking at request time.
export const instant = false;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadStory(slug);
  if (result.status !== 'ok') return { title: 'Story' };
  const { title, dek, author, images, archive } = result.data;
  const imageUrl = images[0]?.url ?? archive[0]?.url;
  const imageAlt = images[0]?.altText ?? archive[0]?.alt;
  return {
    title,
    description: dek,
    authors: [{ name: author }],
    openGraph: imageUrl ? { images: [{ url: imageUrl, alt: imageAlt }] } : undefined,
  };
}

export default function StoryPage({ params }: Params) {
  return (
    <Suspense>
      <StoryContent params={params} />
    </Suspense>
  );
}

async function StoryContent({ params }: Params) {
  const { slug } = await params;
  const [result, walks] = await Promise.all([loadStory(slug), cachedWalks()]);
  if (result.status === 'not-found') notFound();
  // A failed walk read only drops the "walk that passes here" module; the story still renders.
  return <StoryScreen slug={slug} result={result} walks={walks.status === 'ok' ? walks.data : []} />;
}
