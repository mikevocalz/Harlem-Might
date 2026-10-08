import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { StoryRecord, WalkRecord } from '@acme/app/content';
import { listWalks } from '@acme/payload/server';
import { MightsButton, MightsPage, routes } from '@acme/ui/mights';
import { StoryArticle, StoryByline } from '@/components/stories/StoryArticle';
import { StoryRelated } from '@/components/stories/StoryRelated';
import { loadStory } from '@/components/stories/load';
import { ContentNotice } from '@/components/content/ContentNotice';
import { SourcesList } from '@/components/content/SourcesList';

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
  const { title, dek, author, archive } = result.data;
  return {
    title,
    description: dek,
    authors: [{ name: author }],
    openGraph: archive[0] ? { images: [{ url: archive[0].url, alt: archive[0].alt }] } : undefined,
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
  const [result, walks] = await Promise.all([loadStory(slug), listWalks()]);
  if (result.status === 'not-found') notFound();
  if (result.status === 'unavailable') {
    if (result.reason === 'query-failed') console.error('story read failed', slug, result.error);
    return (
      <MightsPage title="Story" crumbs={[{ label: 'Stories', href: routes.stories() }]}>
        <ContentNotice
          title="We couldn’t load this story right now"
          actions={
            <>
              <MightsButton href={routes.story(slug)}>Try again</MightsButton>
              <MightsButton href={routes.stories()} variant="secondary">
                All stories
              </MightsButton>
            </>
          }
        >
          The story may well be there; we couldn’t reach our records to check. Try again in a moment.
        </ContentNotice>
      </MightsPage>
    );
  }
  // A failed walk read only drops the "walk that passes here" module; the story still renders.
  return <Story story={result.data} walks={walks.status === 'ok' ? walks.data : []} />;
}

function Story({ story, walks }: { story: StoryRecord; walks: readonly WalkRecord[] }) {
  return (
    <MightsPage
      title={story.title}
      lead={story.dek}
      crumbs={[
        { label: 'Stories', href: routes.stories() },
        { label: story.title, href: routes.story(story.slug) },
      ]}
    >
      <StoryByline story={story} />
      <StoryArticle story={story} />
      <StoryRelated story={story} walks={walks} />
      <SourcesList sources={story.sources} />
    </MightsPage>
  );
}
