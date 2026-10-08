import type { StoryRecord } from '@acme/app/content';
import { MightsFigure, MightsText } from '@acme/ui/mights';
import { archiveCaption, storyDates, storyParagraphs } from './story-format';

// Long-form body: Newsreader at the prose step, ~65ch measure, no UI boxes
// between paragraphs. The first archive image leads; the rest follow the
// paragraph they are closest to, spread evenly through the text.

export function StoryByline({ story }: { story: StoryRecord }) {
  const { published, updated } = storyDates(story);
  return (
    <MightsText size="small" className="max-w-content-prose">
      By <span className="font-semibold text-text">{story.author}</span>
      {published && story.publishedAt ? (
        <>
          . Published <time dateTime={story.publishedAt}>{published}</time>
        </>
      ) : null}
      {updated ? (
        <>
          {published ? ', updated ' : '. Updated '}
          <time dateTime={story.updatedAt}>{updated}</time>
        </>
      ) : null}
      .
    </MightsText>
  );
}

export function StoryArticle({ story }: { story: StoryRecord }) {
  const paragraphs = storyParagraphs(story.body);
  const [lead, ...inline] = story.archive;
  // Paragraph index after which each remaining image is placed.
  const step = inline.length > 0 ? Math.max(1, Math.floor(paragraphs.length / (inline.length + 1))) : 0;
  const after = new Map<number, typeof inline>();
  inline.forEach((item, i) => {
    // Short bodies can put several images after the same paragraph; keep them all.
    const at = Math.max(0, Math.min(paragraphs.length - 1, step * (i + 1) - 1));
    after.set(at, [...(after.get(at) ?? []), item]);
  });

  return (
    <article className="flex flex-col gap-10">
      {lead ? <MightsFigure src={lead.url} alt={lead.alt} caption={archiveCaption(lead)} priority className="max-w-content-wide" /> : null}
      <div className="flex max-w-content-prose flex-col gap-6">
        {paragraphs.map((text, i) => {
          const figures = after.get(i) ?? [];
          return (
            <div key={i} className="flex flex-col gap-6">
              <MightsText tone="default" className="font-serif text-prose">
                {text}
              </MightsText>
              {figures.map((figure) => (
                <MightsFigure key={figure.url} src={figure.url} alt={figure.alt} caption={archiveCaption(figure)} ratio="standard" />
              ))}
            </div>
          );
        })}
      </div>
    </article>
  );
}
