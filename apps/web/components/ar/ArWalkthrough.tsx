import { getHarlemPlacePreview } from '@acme/app/features/explore/explore.store.ts';
import { Figcaption, Figure, ListItem, OrderedList, Section, Text } from '@acme/ui/html';
import { View } from '@acme/ui/tw';
import {
  MapAttribution,
  MightsAccentFrame,
  MightsButton,
  MightsHeading,
  MightsLocationStamp,
  MightsMapImage,
  MightsText,
  routes,
} from '@acme/ui/mights';

// Map → sidewalk → camera view → place page, told on one real block. The frame
// is a static map, not a camera capture: no place-label AR scene exists, so the
// caption says there is nothing to capture. The steps describe what the view
// would do and say what it would not (no facade tracing, no saved anchors).
const APOLLO_ID = 'apollo-theater';
const apollo = getHarlemPlacePreview(APOLLO_ID)!;

const steps = [
  {
    title: 'On the map',
    body: 'You open the Apollo Theater on the map. That place record is what the AR view would read.',
  },
  {
    title: 'On the sidewalk',
    body: 'You walk to West 125th Street. The app would use your location to know which block you are on.',
  },
  {
    title: 'Through the camera',
    body: 'You hold up your phone and one label appears near the Apollo with its name. The label would sit near the building, not traced onto the facade, and it would be placed fresh each visit rather than saved.',
  },
  {
    title: 'Back to the story',
    body: 'You tap the label and get the same place page the map opens.',
  },
] as const;

export function ArWalkthrough() {
  return (
    <Section aria-labelledby="ar-walkthrough" className="flex flex-col gap-8 border-t border-rule-rail pt-6">
      <MightsHeading id="ar-walkthrough">How it would work on 125th Street</MightsHeading>
      <View className="grid grid-cols-1 items-start gap-10 md:grid-cols-12 md:gap-6">
        <Figure className="flex flex-col gap-2 md:col-span-7">
          <MightsAccentFrame tone="cobalt" className="p-3">
            <View className="relative aspect-4/3 overflow-hidden bg-surface-raised">
              <MightsMapImage
                center={apollo.lngLat!}
                zoom={18.6}
                pitch={60}
                bearing={-29}
                width={960}
                height={720}
                sizes="(min-width: 768px) 58vw, 100vw"
                pins={[{ lngLat: apollo.lngLat! }]}
                alt="Street-level map view of the Apollo Theater on West 125th Street"
              />
              <MightsLocationStamp
                name={apollo.name}
                street={apollo.street}
                href={routes.place(APOLLO_ID)}
                tone="dark"
                className="absolute bottom-3 left-3"
              />
            </View>
          </MightsAccentFrame>
          <View className="flex flex-row flex-wrap items-baseline justify-between gap-2">
            <Figcaption className="text-small text-text-muted">
              Map view at the Apollo Theater. AR is a concept, no capture yet.
            </Figcaption>
            <MapAttribution />
          </View>
        </Figure>
        <View className="flex flex-col gap-8 md:col-span-5">
          {/* A real sequence, so an ordered list; the numeral is visual only. */}
          <OrderedList className="flex flex-col gap-6">
            {steps.map((step, i) => (
              <ListItem key={step.title} className="flex gap-4">
                <Text aria-hidden className="w-6 shrink-0 font-sans text-title font-bold text-primary tabular-nums">
                  {i + 1}
                </Text>
                <View className="flex min-w-0 flex-col gap-1">
                  <MightsHeading level={3} size="card">
                    {step.title}
                  </MightsHeading>
                  <MightsText>{step.body}</MightsText>
                </View>
              </ListItem>
            ))}
          </OrderedList>
          <View className="flex flex-col gap-2 border-l-2 border-rule-rail pl-4">
            <MightsHeading level={3} size="card">
              Your camera
            </MightsHeading>
            <MightsText>
              The app would ask for the camera only when you open the AR view, never at install or on the map. Say no
              and the map and place pages work the same. This page never asks for it.
            </MightsText>
          </View>
          <View className="flex flex-row">
            <MightsButton href={routes.explore({ place: APOLLO_ID })}>Open the map</MightsButton>
          </View>
        </View>
      </View>
    </Section>
  );
}
