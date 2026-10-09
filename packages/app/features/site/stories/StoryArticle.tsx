import type { ArchiveItem, EditorialImage, StoryRecord } from '@acme/app/content';
import { Article, Text, Time } from '@acme/ui/html';
import { MightsEditorialImage, MightsFigure, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { archiveCaption, storyDates, storyParagraphs } from './story-format.ts';

// Long-form body: Newsreader at the prose step, ~65ch measure, no UI boxes
// between paragraphs. The first archive image leads; the rest follow the
// paragraph they are closest to, spread evenly through the text.

export function StoryByline({ story }: { story: StoryRecord }) {
  const { published, updated } = storyDates(story);
  return (
    <MightsText size="small" className="max-w-content-prose">
      By <Text className="font-semibold text-text">{story.author}</Text>
      {published && story.publishedAt ? (
        <>
          . Published <Time dateTime={story.publishedAt}>{published}</Time>
        </>
      ) : null}
      {updated ? (
        <>
          {published ? ', updated ' : '. Updated '}
          <Time dateTime={story.updatedAt}>{updated}</Time>
        </>
      ) : null}
      .
    </MightsText>
  );
}

type ArticleImage = { kind: 'editorial'; image: EditorialImage } | { kind: 'archive'; item: ArchiveItem };

const articleImages = (story: StoryRecord): ArticleImage[] => {
  const seen = new Set<string>();
  return [
    ...story.images.map((image): ArticleImage => ({ kind: 'editorial', image })),
    ...story.archive.map((item): ArticleImage => ({ kind: 'archive', item })),
  ].filter((entry) => {
    const url = entry.kind === 'editorial' ? entry.image.url : entry.item.url;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

function ArticleFigure({ entry, story, lead }: { entry: ArticleImage; story: StoryRecord; lead?: boolean }) {
  if (entry.kind === 'editorial') {
    return (
      <MightsEditorialImage
        image={entry.image}
        screenId={`story-${story.slug}`}
        ratio={lead ? 'wide' : 'standard'}
        sizes={lead ? '(min-width: 768px) 66vw, 100vw' : '(min-width: 768px) 40rem, 100vw'}
        priority={lead}
      />
    );
  }
  return (
    <MightsFigure
      src={entry.item.url}
      alt={entry.item.alt}
      caption={archiveCaption(entry.item)}
      ratio={lead ? 'wide' : 'standard'}
      priority={lead}
      className={lead ? 'max-w-content-wide' : undefined}
    />
  );
}

export function StoryArticle({ story }: { story: StoryRecord }) {
  const paragraphs = storyParagraphs(story.body);
  const [lead, ...inline] = articleImages(story);
  // Paragraph index after which each remaining image is placed.
  const step = inline.length > 0 ? Math.max(1, Math.floor(paragraphs.length / (inline.length + 1))) : 0;
  const after = new Map<number, ArticleImage[]>();
  inline.forEach((item, i) => {
    // Short bodies can put several images after the same paragraph; keep them all.
    const at = Math.max(0, Math.min(paragraphs.length - 1, step * (i + 1) - 1));
    after.set(at, [...(after.get(at) ?? []), item]);
  });

  return (
    <Article className="flex flex-col gap-10">
      {lead ? <ArticleFigure entry={lead} story={story} lead /> : null}
      <View className="flex max-w-content-prose flex-col gap-6">
        {paragraphs.map((text, i) => {
          const figures = after.get(i) ?? [];
          return (
            <View key={i} className="flex flex-col gap-6">
              <MightsText tone="default" className="font-serif text-prose">
                {text}
              </MightsText>
              {figures.map((figure) => (
                <ArticleFigure key={figure.kind === 'editorial' ? figure.image.url : figure.item.url} entry={figure} story={story} />
              ))}
            </View>
          );
        })}
      </View>
    </Article>
  );
}
