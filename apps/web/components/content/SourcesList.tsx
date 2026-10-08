import type { SourceRef } from '@acme/app/content';
import { MightsHeading } from '@acme/ui/mights';
import { storyDate } from '../stories/story-format';
import { safeHttpUrl } from './safe-url';

// The sources block for walks and stories. A source without a URL is still
// listed (an interview, a printed book); it just has nothing to open.
export function SourcesList({ sources, headingId = 'sources' }: { sources: readonly SourceRef[]; headingId?: string }) {
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex max-w-content-detail flex-col gap-4 border-t border-rule-hairline pt-8">
      <MightsHeading level={2} size="title" id={headingId}>
        Sources
      </MightsHeading>
      <ul className="flex flex-col gap-3">
        {sources.map((source, i) => {
          const url = safeHttpUrl(source.url);
          return (
            <li key={`${source.label}-${i}`} className="text-small text-text">
              {url ? (
                <a href={url} className="mights-focus text-primary underline underline-offset-4 hover:no-underline">
                  {source.label}
                </a>
              ) : (
                source.label
              )}
              {source.accessedAt ? (
                <span className="text-text-muted">
                  {' '}
                  (read <time dateTime={source.accessedAt}>{storyDate(source.accessedAt)}</time>)
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
