'use client';

import { Text, View } from '@acme/ui/tw';
import { FocusPressable } from './FocusPressable';
import { placeStreetLine, type HarlemPlacePreview } from './explore.store';
import { useExploreType } from './explore-type';
import { focusTargetRef, rowFocusId } from './focus-registry';

export interface PlaceRowProps {
  place: HarlemPlacePreview;
  selected: boolean;
  onPress: () => void;
}

/**
 * One Discover row (design handoff §2): name and street, nothing else.
 * Category lives in the chips and in the accessible name. Selection is a
 * `selected` fill plus a 2px gold-dim leading rail and `selected` a11y state,
 * so it never depends on colour alone.
 */
export function PlaceRow({ place, selected, onPress }: PlaceRowProps) {
  const type = useExploreType();
  const mapped = place.lngLat != null;

  return (
    <FocusPressable
      ref={focusTargetRef(rowFocusId(place.id))}
      onPress={onPress}
      accessibilityState={{ selected }}
      aria-selected={selected}
      aria-label={`${place.name}, ${place.category}, ${place.area}.${selected ? ' Selected.' : ''}`}
      className={
        'min-h-16 flex-row overflow-hidden rounded-card border ' +
        (selected ? 'border-rule-rail bg-selected' : 'border-border-strong bg-surface')
      }
    >
      <View className={'w-rail ' + (selected ? 'bg-rule-rail' : 'bg-transparent')} />
      <View className="flex-1 justify-center gap-0.5 px-3 py-2">
        <Text className={type.title + ' font-semibold text-text'}>{place.name}</Text>
        <Text className={type.body + ' text-brownstone'}>
          {placeStreetLine(place)}
          {mapped ? '' : '. Not on the map yet'}
        </Text>
      </View>
    </FocusPressable>
  );
}
