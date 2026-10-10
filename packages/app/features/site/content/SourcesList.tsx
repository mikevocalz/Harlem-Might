import type { SourceRef } from '@acme/app/content';
import { Link, List, ListItem, Section, Text, Time } from '@acme/ui/html';
import { MightsHeading } from '@acme/ui/mights';
import { storyDate } from '../stories/story-format.ts';
import { safeHttpUrl } from './safe-url.ts';

// The sources block for walks and stories. A source without a URL is still
// listed (an interview, a printed book); it just has nothing to open.
export function SourcesList({ sources, headingId = 'sources' }: { sources: readonly SourceRef[]; headingId?: string }) {
  if (sources.length === 0) return null;
  return (
    <Section aria-labelledby={headingId} className="flex max-w-content-detail flex-col gap-4 border-t border-rule-hairline pt-8">
      <MightsHeading level={2} size="title" id={headingId}>
        Sources
      </MightsHeading>
      <List className="flex flex-col gap-3">
        {sources.map((source, i) => {
          const url = safeHttpUrl(source.url);
          return (
            <ListItem key={`${source.label}-${i}`} className="text-small text-text">
              {url ? (
                <Link href={url} className="mights-focus text-primary underline underline-offset-4 hover:no-underline">
                  {source.label}
                </Link>
              ) : (
                source.label
              )}
              {source.accessedAt ? (
                <Text className="text-text-muted">
                  {' '}
                  (read <Time dateTime={source.accessedAt}>{storyDate(source.accessedAt)}</Time>)
                </Text>
              ) : null}
            </ListItem>
          );
        })}
      </List>
    </Section>
  );
}
