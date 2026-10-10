import type { WalkStop } from '@acme/app/content';
import { ListItem, OrderedList, Section, Text } from '@acme/ui/html';
import { MightsEditorialImage, MightsHeading, MightsNotchCard, MightsText } from '@acme/ui/mights';
import { View } from '@acme/ui/tw';
import { linkPlace } from '../content/place-link.ts';
import { stopAnchor } from './walk-facts.ts';

// The stop sequence. An ordered list, never a bento: order is the content.
// Each stop links to its place page (a stop has no page of its own) and
// carries an #stop-n anchor for in-walk position. No checkboxes or progress:
// a walk is an outing, not a checklist.

function StopBody({ stop }: { stop: WalkStop }) {
  const linked = linkPlace(stop.place);
  const image = stop.place?.images?.[0];
  const name = stop.place?.name ?? 'This stop is no longer in the catalogue';
  const street = linked ? (linked.preview.street ?? linked.preview.area) : null;
  return (
    <View className="flex flex-col">
      {image ? (
        <View className="shrink-0 border-b border-rule-hairline">
          <MightsEditorialImage
            image={image}
            screenId={`walk-stop-${stop.position}`}
            ratio="wide"
            sizes="(min-width: 768px) 42vw, 100vw"
            interactiveCredit={false}
          />
        </View>
      ) : null}
      <View className="flex gap-5 p-5">
        {/* The <OrderedList> already announces the position; the numeral is visual only. */}
        <Text aria-hidden className="w-10 shrink-0 font-sans text-title-lg font-bold text-primary tabular-nums">
          {stop.position}
        </Text>
        <View className="flex min-w-0 flex-col gap-1">
          <MightsHeading level={3} size="card">
            {name}
          </MightsHeading>
          {street ? <MightsText size="small">{street}</MightsText> : null}
          {stop.note ? (
            <MightsText size="small" tone="default" className="mt-2">
              {stop.note}
            </MightsText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function WalkStops({ stops }: { stops: readonly WalkStop[] }) {
  return (
    <Section aria-labelledby="stops" className="flex max-w-content-screen flex-col gap-6">
      <MightsHeading level={2} size="display-md" id="stops">
        Stops
      </MightsHeading>
      <OrderedList className="flex flex-col gap-4">
        {stops.map((stop) => {
          const linked = linkPlace(stop.place);
          return (
            <ListItem key={stop.position} id={stopAnchor(stop.position)} className="flex scroll-mt-24 flex-col">
              {linked ? (
                <MightsNotchCard href={linked.href}>
                  <StopBody stop={stop} />
                </MightsNotchCard>
              ) : (
                <MightsNotchCard>
                  <StopBody stop={stop} />
                </MightsNotchCard>
              )}
            </ListItem>
          );
        })}
      </OrderedList>
    </Section>
  );
}
