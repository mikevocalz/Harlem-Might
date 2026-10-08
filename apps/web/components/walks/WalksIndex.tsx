import type { WalkRecord } from '@acme/app/content';
import { MapAttribution, MightsHeading, MightsMapImage, MightsNotchCard, MightsPlaceBento, MightsText, routes } from '@acme/ui/mights';
import { locatePlace } from '../content/place-link';
import { walkMapView, walkSummaryLine } from './walk-facts';

// B6. References (structure only): Tripadvisor itinerary
// (mobbin.com/flows/7a396ca0-1212-47fb-982b-136b2be0dc56) and Viator full
// itinerary (mobbin.com/flows/422bb020-daa3-41b6-bfb4-95ef8b60ac56): one
// featured route with its map, the rest as text-first rows.

/** One featured walk plus up to four others in the bento; the rest is a plain list. */
const BENTO_MAX = 5;

function WalkModule({ walk, featured, headingLevel }: { walk: WalkRecord; featured: boolean; headingLevel: 2 | 3 }) {
  // Only the featured walk draws a map: one Mapbox raster per index, not one per walk.
  const view = featured ? walkMapView(walk.stops, locatePlace) : null;
  const facts = walkSummaryLine(walk);
  return (
    <div className="flex flex-1 flex-col">
      {view ? (
        <div className="h-64 shrink-0 border-b border-rule-hairline md:min-h-80 md:flex-1">
          <MightsMapImage
            center={view.center}
            zoom={view.zoom}
            width={960}
            height={600}
            sizes="(min-width: 768px) 58vw, 100vw"
            pins={view.pins}
            alt={`Map of the stops on ${walk.title}`}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2 p-5">
        <MightsHeading level={headingLevel} size={featured ? 'title' : 'card'}>
          {walk.title}
        </MightsHeading>
        {facts ? <MightsText size="small">{facts}</MightsText> : null}
        <MightsText size="small" tone="default" className={featured ? '' : 'line-clamp-3'}>
          {walk.summary}
        </MightsText>
      </div>
    </div>
  );
}

export function WalksIndex({ walks }: { walks: readonly WalkRecord[] }) {
  // A bento needs a dominant module and at least one support; one walk is a plain card.
  if (walks.length < 2) {
    const walk = walks[0];
    if (!walk) return null;
    const hasMap = walkMapView(walk.stops, locatePlace) !== null;
    return (
      <div className="flex max-w-content-screen flex-col gap-2">
        <MightsNotchCard href={routes.walk(walk.slug)}>
          <WalkModule walk={walk} featured headingLevel={2} />
        </MightsNotchCard>
        {hasMap ? <MapAttribution /> : null}
      </div>
    );
  }
  const inBento = walks.slice(0, BENTO_MAX);
  const rest = walks.slice(BENTO_MAX);
  const featuredHasMap = walkMapView(walks[0]!.stops, locatePlace) !== null;
  return (
    <div className="flex flex-col gap-16">
    <div className="flex flex-col gap-2">
      <MightsPlaceBento
        headingLevel={2}
        motionKey="walks"
        modules={inBento.map((walk, i) => ({
          kind: 'custom' as const,
          id: String(walk.id),
          href: routes.walk(walk.slug),
          content: <WalkModule walk={walk} featured={i === 0} headingLevel={2} />,
        }))}
      />
      {featuredHasMap ? <MapAttribution /> : null}
    </div>
      {rest.length > 0 ? (
        <section aria-labelledby="more-walks" className="flex flex-col gap-6">
          <MightsHeading level={2} size="title" id="more-walks">
            More walks
          </MightsHeading>
          <ul className="flex max-w-content-screen flex-col gap-4">
            {rest.map((walk) => (
              <li key={walk.id} className="flex flex-col">
                <MightsNotchCard href={routes.walk(walk.slug)}>
                  <WalkModule walk={walk} featured={false} headingLevel={3} />
                </MightsNotchCard>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
