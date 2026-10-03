import type { Metadata } from 'next';
import { getHarlemPlacePreview } from '@acme/app/features/explore/explore.store.ts';
import { Section, View } from '@acme/ui/tw';
import { MightsAccentFrame, MightsButton, MightsMapImage, MightsPage, MightsText, MapAttribution, routes } from '@acme/ui/mights';

export const metadata: Metadata = {
  title: 'Preview AR',
  description: 'How Harlem Might places labels on the buildings they belong to.',
};

const apollo = getHarlemPlacePreview('apollo-theater')!;

export default function ArPage() {
  return (
    <MightsPage title="Preview AR" lead="Hold up your phone on the block and each label sits on the building it belongs to.">
      <Section className="grid grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-6">
        <View className="md:col-span-7">
          <MightsAccentFrame tone="cobalt" className="p-3">
            <View className="aspect-[4/3] overflow-hidden">
              <MightsMapImage
                center={apollo.lngLat!}
                zoom={18.6}
                pitch={60}
                bearing={-29}
                width={960}
                height={720}
                pins={[{ lngLat: apollo.lngLat! }]}
                alt="Street-level map view of the Apollo Theater on West 125th Street"
              />
            </View>
          </MightsAccentFrame>
          <MapAttribution className="mt-2 block" />
        </View>
        <View className="flex flex-col gap-6 md:col-span-4 md:col-start-9">
          <MightsText>
            AR runs in the Harlem Might app. It uses the same place records as the map, so the label you see in the
            street is the place you opened on the map, with its history and hours attached.
          </MightsText>
          <MightsText>Nothing here asks for your camera. The browser shows the map; the app does the rest.</MightsText>
          <View className="flex flex-wrap gap-3">
            <MightsButton href={routes.download()}>Get the app</MightsButton>
            <MightsButton href={routes.explore()} variant="secondary">
              Open the map
            </MightsButton>
          </View>
        </View>
      </Section>
    </MightsPage>
  );
}
