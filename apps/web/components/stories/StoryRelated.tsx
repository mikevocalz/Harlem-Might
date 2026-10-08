import type { StoryRecord, WalkRecord } from '@acme/app/content';
import { MightsHeading, MightsNotchCard, MightsPlaceBento, MightsText, routes, type BentoModule } from '@acme/ui/mights';
import { linkPlace, type LinkedPlace } from '../content/place-link';
import { walkSummaryLine } from '../walks/walk-facts';

// B9, end of article. References (structure only): Dropbox related articles
// (mobbin.com/sites/sections/3af6a5fe-ee5c-491d-871a-e2579f5efd05) and
// FARFETCH related articles (mobbin.com/sites/sections/101ac33b-ddd1-4501-bd37-326ed9c863bc).
// The place the story is about leads; a walk that passes through follows.
// Two or more real modules make a bento; one is a single card; none, nothing.

type Related = { kind: 'place'; place: LinkedPlace } | { kind: 'walk'; walk: WalkRecord };

/** Walks whose stops include one of the story's places. At most two. */
export function walksThrough(story: Pick<StoryRecord, 'places'>, walks: readonly WalkRecord[]): WalkRecord[] {
  const slugs = new Set(story.places.map((p) => p.slug));
  return walks.filter((w) => w.stops.some((s) => s.place && slugs.has(s.place.slug))).slice(0, 2);
}

function WalkBody({ walk }: { walk: WalkRecord }) {
  const facts = walkSummaryLine(walk);
  return (
    <div className="flex flex-1 flex-col gap-1 p-5">
      <MightsText size="small">A walk that passes here</MightsText>
      <MightsHeading level={3} size="card">
        {walk.title}
      </MightsHeading>
      {facts ? <MightsText size="small">{facts}</MightsText> : null}
    </div>
  );
}

export function StoryRelated({ story, walks }: { story: StoryRecord; walks: readonly WalkRecord[] }) {
  const items: Related[] = [
    ...story.places.flatMap((ref) => {
      const place = linkPlace(ref);
      return place ? [{ kind: 'place' as const, place }] : [];
    }),
    ...walksThrough(story, walks).map((walk) => ({ kind: 'walk' as const, walk })),
  ];
  // B9 is a small cluster: 2 to 3 modules.
  items.splice(3);
  if (items.length === 0) return null;

  const heading = (
    <MightsHeading level={2} size="title" id="story-related">
      Where this happened
    </MightsHeading>
  );

  if (items.length === 1) {
    const only = items[0]!;
    return (
      <section aria-labelledby="story-related" className="flex max-w-content-detail flex-col gap-6 border-t border-rule-hairline pt-8">
        {heading}
        {only.kind === 'place' ? (
          <MightsNotchCard href={only.place.href}>
            <div className="flex flex-col gap-1 p-5">
              <MightsHeading level={3} size="card">
                {only.place.preview.name}
              </MightsHeading>
              <MightsText size="small">{only.place.preview.street ?? only.place.preview.area}</MightsText>
              <MightsText size="small" tone="default" className="mt-2">
                {only.place.preview.shortDescription}
              </MightsText>
            </div>
          </MightsNotchCard>
        ) : (
          <MightsNotchCard href={routes.walk(only.walk.slug)}>
            <WalkBody walk={only.walk} />
          </MightsNotchCard>
        )}
      </section>
    );
  }

  const modules: BentoModule[] = items.map((item) =>
    item.kind === 'place'
      ? {
          kind: 'place',
          place: {
            id: item.place.preview.id,
            name: item.place.preview.name,
            area: item.place.preview.area,
            street: item.place.preview.street,
            shortDescription: item.place.preview.shortDescription,
            lngLat: item.place.preview.lngLat,
          },
        }
      : { kind: 'custom', id: `walk-${item.walk.id}`, href: routes.walk(item.walk.slug), content: <WalkBody walk={item.walk} /> },
  );

  return (
    <section aria-labelledby="story-related" className="flex flex-col gap-6 border-t border-rule-hairline pt-8">
      {heading}
      <MightsPlaceBento headingLevel={3} motionKey="story-related" modules={modules} />
    </section>
  );
}
