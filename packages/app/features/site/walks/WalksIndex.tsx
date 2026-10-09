import type { WalkRecord } from '@acme/app/content';
import { List, ListItem, Section } from '@acme/ui/html';
import { MapAttribution, MightsEditorialImage, MightsHeading, MightsMapImage, MightsNotchCard, MightsPlaceBento, MightsText, routes } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { locatePlace } from '../content/place-link.ts';
import { walkMapView, walkSummaryLine } from './walk-facts.ts';

// B6. References (structure only): Tripadvisor itinerary
// (mobbin.com/flows/7a396ca0-1212-47fb-982b-136b2be0dc56) and Viator full
// itinerary (mobbin.com/flows/422bb020-daa3-41b6-bfb4-95ef8b60ac56): one
// featured route with its map, the rest as text-first rows.

/** One featured walk plus up to four others in the bento; the rest is a plain list. */
const BENTO_MAX = 5;

function WalkModule({ walk, featured, headingLevel }: { walk: WalkRecord; featured: boolean; headingLevel: 2 | 3 }) {
  // Only the featured walk draws a map: one Mapbox raster per index, not one per walk.
  const image = walk.images[0];
  const view = !image && featured ? walkMapView(walk.stops, locatePlace) : null;
  const facts = walkSummaryLine(walk);
  return (
    <View className="flex flex-1 flex-col">
      {image ? (
        <View className="shrink-0 border-b border-rule-hairline">
          <MightsEditorialImage
            image={image}
            screenId={`walks-${walk.slug}`}
            ratio={featured ? 'wide' : 'standard'}
            sizes={featured ? '(min-width: 768px) 58vw, 100vw' : '(min-width: 768px) 33vw, 100vw'}
            priority={featured}
            interactiveCredit={false}
          />
        </View>
      ) : view ? (
        <View className="h-64 shrink-0 border-b border-rule-hairline md:min-h-80 md:flex-1">
          <MightsMapImage
            center={view.center}
            zoom={view.zoom}
            width={960}
            height={600}
            sizes="(min-width: 768px) 58vw, 100vw"
            pins={view.pins}
            alt={`Map of the stops on ${walk.title}`}
          />
        </View>
      ) : null}
      <View className="flex flex-col gap-2 p-5">
        <MightsHeading level={headingLevel} size={featured ? 'title' : 'card'}>
          {walk.title}
        </MightsHeading>
        {facts ? <MightsText size="small">{facts}</MightsText> : null}
        <MightsText size="small" tone="default" className={featured ? '' : 'line-clamp-3'}>
          {walk.summary}
        </MightsText>
      </View>
    </View>
  );
}

export function WalksIndex({ walks }: { walks: readonly WalkRecord[] }) {
  // A bento needs a dominant module and at least one support; one walk is a plain card.
  if (walks.length < 2) {
    const walk = walks[0];
    if (!walk) return null;
    const hasMap = !walk.images[0] && walkMapView(walk.stops, locatePlace) !== null;
    return (
      <View className="flex max-w-content-screen flex-col gap-2">
        <MightsNotchCard href={routes.walk(walk.slug)}>
          <WalkModule walk={walk} featured headingLevel={2} />
        </MightsNotchCard>
        {hasMap ? <MapAttribution /> : null}
      </View>
    );
  }
  const inBento = walks.slice(0, BENTO_MAX);
  const rest = walks.slice(BENTO_MAX);
  const featuredHasMap = !walks[0]!.images[0] && walkMapView(walks[0]!.stops, locatePlace) !== null;
  return (
    <View className="flex flex-col gap-16">
      <View className="flex flex-col gap-2">
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
      </View>
      {rest.length > 0 ? (
        <Section aria-labelledby="more-walks" className="flex flex-col gap-6">
          <MightsHeading level={2} size="title" id="more-walks">
            More walks
          </MightsHeading>
          <List className="flex max-w-content-screen flex-col gap-4">
            {rest.map((walk) => (
              <ListItem key={walk.id} className="flex flex-col">
                <MightsNotchCard href={routes.walk(walk.slug)}>
                  <WalkModule walk={walk} featured={false} headingLevel={3} />
                </MightsNotchCard>
              </ListItem>
            ))}
          </List>
        </Section>
      ) : null}
    </View>
  );
}
