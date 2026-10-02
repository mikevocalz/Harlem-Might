'use client';

import { GridScene, Text } from '@acme/ui';
import { Pressable, View } from '@acme/ui/tw';
import {
  HARLEM_PLACE_PREVIEWS,
  useExplore,
  type HarlemPlacePreview,
} from './explore.store';

export interface ExploreMapPaneProps {
  onSelectPlace: (place: HarlemPlacePreview) => void;
  onShowPlaces?: () => void;
}

export function ExploreMapPane({
  onSelectPlace,
  onShowPlaces,
}: ExploreMapPaneProps) {
  const selectedPlaceId = useExplore((state) => state.selectedPlaceId);

  return (
    <View className="relative flex-1 overflow-hidden bg-surface-sunken">
      <View className="absolute inset-0">
        <GridScene
          className="flex-1"
          horizon={0.57}
          gap={0}
          speed={0.12}
          lineColor="#B6C0BA"
          glowColor="#0E8FA3"
          backgroundColor="#E5E9E5"
          opacity={0.36}
          showCeiling={false}
        />
      </View>

      <View className="absolute left-3 right-3 top-3 flex-row items-center justify-between gap-3">
        <View className="max-w-[72%] rounded-xl border border-border bg-surface-raised/94 px-3 py-2 shadow-card">
          <Text className="text-xs font-semibold text-text">Harlem spatial workspace</Text>
          <Text className="mt-0.5 text-[11px] leading-4 text-text-muted">
            Preview geometry only · canonical coordinates come from Payload/PostGIS
          </Text>
        </View>

        {onShowPlaces ? (
          <Pressable
            onPress={onShowPlaces}
            className="rounded-lg border border-border bg-surface-raised/94 px-3 py-2 shadow-card"
            aria-label="Show places"
          >
            <Text className="text-xs font-semibold text-primary">Places</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="absolute inset-0">
        {HARLEM_PLACE_PREVIEWS.map((place, index) => {
          const selected = selectedPlaceId === place.id;
          return (
            <Pressable
              key={place.id}
              onPress={() => onSelectPlace(place)}
              aria-label={'Select ' + place.name + ' on map'}
              style={{
                position: 'absolute',
                left: String(place.previewPoint.x) + '%',
                top: String(place.previewPoint.y) + '%',
                transform: [{ translateX: -18 }, { translateY: -18 }],
              }}
              className={
                'h-9 w-9 items-center justify-center rounded-full border-2 shadow-card ' +
                (selected
                  ? 'border-primary bg-primary'
                  : index % 3 === 0
                    ? 'border-accent bg-surface-raised'
                    : 'border-focus bg-surface-raised')
              }
            >
              <Text className={'text-[10px] font-bold ' + (selected ? 'text-on-primary' : 'text-text')}>
                {index + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="absolute bottom-3 left-3 right-3 rounded-xl border border-border bg-surface-raised/94 p-3 shadow-card">
        <Text className="text-xs font-semibold text-primary">Nitro Mapbox AR handoff</Text>
        <Text className="mt-1 text-xs leading-5 text-text-muted">
          This first workspace deliberately does not fake live Mapbox. The next integration
          replaces preview geometry with canonical PostGIS points and the shared Nitro Mapbox AR
          map/route surface.
        </Text>
      </View>
    </View>
  );
}
