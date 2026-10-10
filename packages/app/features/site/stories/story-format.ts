import type { ArchiveItem, StoryRecord } from '@acme/app/content';

// Pure formatting for stories. The body is plain text with paragraphs split
// by blank lines (records.ts:StoryRecord.body).

export function storyParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, ' ').trim())
    .filter((p) => p.length > 0);
}

/** Rights line under an archive image. Says who allows the reuse, never just "©". */
export function rightsLine(item: Pick<ArchiveItem, 'rights' | 'rightsHolder' | 'license'>): string {
  switch (item.rights) {
    case 'owned':
      return 'Harlem Might';
    case 'licensed':
      return item.rightsHolder ? `Licensed from ${item.rightsHolder}` : 'Licensed';
    case 'venue_supplied':
      return item.rightsHolder ? `Courtesy of ${item.rightsHolder}` : 'Courtesy of the venue';
    case 'open_license':
      return item.license ?? 'Open license';
    case 'public_domain':
      return 'Public domain';
  }
}

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** Caption, credit and rights in one line for MightsFigure. */
export function archiveCaption(item: Pick<ArchiveItem, 'caption' | 'credit' | 'rights' | 'rightsHolder' | 'license'>): string {
  return [item.caption?.trim(), item.credit.trim(), rightsLine(item)]
    .filter((part): part is string => Boolean(part))
    .map(sentence)
    .join(' ');
}

/** "Oct 3, 2026" in New York time. */
export function storyDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  );
}

/**
 * Byline dates: the publish date, plus "updated" only when the edit landed on
 * a later New York day, so a same-day typo fix does not read as a revision.
 */
export function storyDates(story: Pick<StoryRecord, 'publishedAt' | 'updatedAt'>): { published?: string; updated?: string } {
  const published = story.publishedAt ? storyDate(story.publishedAt) : undefined;
  const updated = storyDate(story.updatedAt);
  if (!published) return { updated };
  return updated === published ? { published } : { published, updated };
}

/** The story's own images, then its places' photos, in order. */
export const storyPhotos = (story: StoryRecord) => [...story.images, ...story.places.flatMap((p) => p.images ?? [])];

/**
 * One photo per story for a page of cards, never the same photo twice: each
 * story takes its first own photo (then its places') that no earlier story
 * took. Pure, so it is safe under React's double render.
 */
export function assignStoryPhotos(stories: readonly StoryRecord[]) {
  const used = new Set<string | number>();
  return new Map(
    stories.map((story) => {
      const photo = storyPhotos(story).find((p) => !used.has(p.id));
      if (photo) used.add(photo.id);
      return [story.id, photo] as const;
    }),
  );
}
