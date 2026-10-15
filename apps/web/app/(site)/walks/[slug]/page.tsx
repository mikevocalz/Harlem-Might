import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { WalkScreen } from '@acme/app/features/site/walks/WalksScreen.tsx';
import { cachedWalk as loadWalk } from '@/lib/cached-content';

// No generateStaticParams: the build has no content database, and with Cache
// Components an empty list is a build error. Every walk renders at request time.
// The shell reads the pathname outside Suspense, which a runtime slug can't
// prerender, so the segment renders blocking at request time.
export const instant = false;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadWalk(slug);
  if (result.status !== 'ok') return { title: 'Walk' };
  return { title: result.data.title, description: result.data.summary };
}

export default function WalkPage({ params }: Params) {
  return (
    <Suspense>
      <WalkContent params={params} />
    </Suspense>
  );
}

async function WalkContent({ params }: Params) {
  const { slug } = await params;
  const result = await loadWalk(slug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'unavailable' && result.reason === 'query-failed') {
    console.error('walk read failed', slug);
  }
  return <WalkScreen slug={slug} result={result} />;
}
