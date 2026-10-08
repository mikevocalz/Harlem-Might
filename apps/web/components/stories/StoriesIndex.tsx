import type { StoryRecord } from '@acme/app/content';
import { MightsHeading, MightsNotchCard, MightsPlaceBento, MightsText, routes, type BentoModule } from '@acme/ui/mights';
import { archiveCaption, storyDates } from './story-format';

// B8. References (structure only): KOBU three-up editorial row
// (mobbin.com/sites/sections/f5959421-5ded-4adb-98db-49143db77839) and
// Assembly Coffee journal lead (mobbin.com/sites/sections/2218a2ac-844a-42bc-b957-64ac22214a79):
// one feature with its picture, a few secondary headlines, author and date on each.

/** One feature plus up to four secondaries in the bento; the rest is a plain list. */
const BENTO_MAX = 5;

function StoryModule({ story, featured, headingLevel }: { story: StoryRecord; featured: boolean; headingLevel: 2 | 3 }) {
  const { published, updated } = storyDates(story);
  const date = published ?? updated;
  return (
    <div className="flex flex-1 flex-col gap-3 p-5">
      <MightsHeading level={headingLevel} size={featured ? 'title' : 'card'}>
        {story.title}
      </MightsHeading>
      {story.dek ? (
        <MightsText size={featured ? 'body' : 'small'} tone="default" className={featured ? '' : 'line-clamp-3'}>
          {story.dek}
        </MightsText>
      ) : null}
      <MightsText size="small" className="mt-auto">
        By {story.author}
        {date ? `, ${date}` : ''}
      </MightsText>
    </div>
  );
}

function StoryList({ stories, headingLevel }: { stories: readonly StoryRecord[]; headingLevel: 2 | 3 }) {
  return (
    <ul className="flex max-w-content-screen flex-col gap-4">
      {stories.map((story) => (
        <li key={story.id} className="flex flex-col">
          <MightsNotchCard href={routes.story(story.slug)}>
            <StoryModule story={story} featured={false} headingLevel={headingLevel} />
          </MightsNotchCard>
        </li>
      ))}
    </ul>
  );
}

export function StoriesIndex({ stories }: { stories: readonly StoryRecord[] }) {
  // Below two stories there is nothing to be dominant over: a plain list.
  if (stories.length < 2) return <StoryList stories={stories} headingLevel={2} />;

  const inBento = stories.slice(0, BENTO_MAX);
  const rest = stories.slice(BENTO_MAX);
  const modules: BentoModule[] = inBento.map((story, i) => ({
    kind: 'custom',
    id: String(story.id),
    href: routes.story(story.slug),
    content: <StoryModule story={story} featured={i === 0} headingLevel={2} />,
  }));
  const leadImage = inBento[0]!.archive[0];

  return (
    <div className="flex flex-col gap-16">
      {/* Story-dominant when the feature has an archive image; otherwise the feature's text leads. */}
      {leadImage ? (
        <MightsPlaceBento
          variant="story-dominant"
          headingLevel={2}
          motionKey="stories"
          lead={{ kind: 'figure', src: leadImage.url, alt: leadImage.alt, caption: archiveCaption(leadImage) }}
          modules={modules}
        />
      ) : (
        <MightsPlaceBento headingLevel={2} motionKey="stories" modules={modules} />
      )}
      {rest.length > 0 ? (
        <section aria-labelledby="more-stories" className="flex flex-col gap-6">
          <MightsHeading level={2} size="title" id="more-stories">
            More stories
          </MightsHeading>
          <StoryList stories={rest} headingLevel={3} />
        </section>
      ) : null}
    </div>
  );
}
