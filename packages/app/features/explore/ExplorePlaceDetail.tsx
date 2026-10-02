'use client';

import { useEffect } from 'react';
import { Card, Heading, Text } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { getHarlemPlacePreview, useExplore } from './explore.store';

export function ExplorePlaceDetail({ placeId }: { placeId: string }) {
  const place = getHarlemPlacePreview(placeId);
  const selectPlace = useExplore((state) => state.selectPlace);

  useEffect(() => {
    if (place) selectPlace(place.id);
  }, [place, selectPlace]);

  if (!place) {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-6">
        <Text className="text-sm font-semibold text-text">Place not found</Text>
        <Text className="mt-1 text-center text-xs text-text-muted">
          This preview record is not in the current Harlem seed set.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-6 p-4 pb-28 md:p-6"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-3">
        <Text className="self-start rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs font-semibold text-primary">
          {place.category} · {place.area}
        </Text>
        <Heading level={1} size="display-md" className="tracking-[-0.035em] text-text">
          {place.name}
        </Heading>
        <Text className="max-w-3xl text-base leading-7 text-text-muted">
          {place.shortDescription}
        </Text>
      </View>

      <View className="min-h-64 overflow-hidden rounded-[24px] border border-border bg-surface-sunken">
        <View className="flex-1 items-center justify-center gap-2 p-8">
          <Text className="text-sm font-semibold text-text">Place media carousel</Text>
          <Text className="max-w-md text-center text-xs leading-5 text-text-muted">
            No stock placeholders. This slot accepts generated concept imagery only when labeled,
            or rights-cleared/venue/archival media from the catalogue.
          </Text>
        </View>
      </View>

      <Card className="gap-3 border-border bg-surface-raised p-5 md:p-6">
        <Text className="text-xs font-semibold text-primary">WHY IT MATTERS</Text>
        <Text className="text-base leading-7 text-text">{place.whyItMatters}</Text>
      </Card>

      <View className="flex-row flex-wrap gap-4">
        <Card className="min-w-64 flex-1 gap-3 border-border bg-surface-raised p-5">
          <Text className="text-xs font-semibold text-text-muted">TODAY</Text>
          <Heading level={2} size="title" className="text-text">
            Operational data
          </Heading>
          <Text className="text-sm leading-6 text-text-muted">
            Hours, open-now state, phone, official website, events and accessibility will come
            from verified canonical fields rather than being guessed in the UI.
          </Text>
        </Card>

        <Card className="min-w-64 flex-1 gap-3 border-border bg-surface-raised p-5">
          <Text className="text-xs font-semibold text-text-muted">MENU + TICKETS</Text>
          <Heading level={2} size="title" className="text-text">
            Source-aware actions
          </Heading>
          <Text className="text-sm leading-6 text-text-muted">
            {place.menuAvailable
              ? 'This seed is marked for menu support; image, PDF and official-web menu records plug into the secure viewer.'
              : 'Contextual links appear here only when the canonical record supplies them.'}
          </Text>
        </Card>
      </View>

      <Card className="gap-3 border-border bg-surface-raised p-5 md:p-6">
        <Text className="text-xs font-semibold text-primary">STORY</Text>
        <Heading level={2} size="title" className="text-text">
          History belongs in the detail, not the inspector.
        </Heading>
        <Text className="text-sm leading-6 text-text-muted md:text-base md:leading-7">
          This section will compose Payload Stories, people, archival media, landmarks and
          citations around the canonical Place ID. The Mights Panel remains free to stay fast,
          contextual and action-oriented.
        </Text>
      </Card>

      <Card className="gap-3 border-border bg-surface-raised p-5">
        <Text className="text-xs font-semibold text-text-muted">SOURCES + CORRECTIONS</Text>
        <Text className="text-sm leading-6 text-text-muted">
          Source provenance, verification dates and correction controls land here with the
          ingestion pipeline. A source-sensitive fact should never be implied by decorative UI.
        </Text>
      </Card>
    </ScrollView>
  );
}
